/**
 * WhatsApp Twilio Provider Implementation
 *
 * Wraps existing Twilio API code with the unified Provider interface.
 * This is a wrapper only - it delegates to existing implementations in src/twilio/.
 */

import { createClient } from "../../twilio/client.js";
import type { ListedMessage } from "../../twilio/messages.js";
import { listRecentMessages } from "../../twilio/messages.js";
import { stripWhatsAppPrefix, withWhatsAppPrefix } from "../../utils.js";
import type {
  DeliveryStatus,
  MessageHandler,
  Provider,
  ProviderConfig,
  ProviderMessage,
  SendOptions,
  SendResult,
  TwilioProviderConfig,
} from "../base/index.js";
import { capabilities } from "./capabilities.js";

/**
 * WhatsApp Twilio Provider
 *
 * Implements the Provider interface by wrapping existing Twilio API code.
 */
export class TwilioProvider implements Provider {
  readonly kind = "wa-twilio" as const;
  readonly capabilities = capabilities;

  private client: ReturnType<typeof createClient> | null = null;
  private config: TwilioProviderConfig | null = null;
  private messageHandler: MessageHandler | null = null;
  private listening = false;
  private stopMonitoringFn: (() => void) | null = null;
  private pollIntervalId: NodeJS.Timeout | null = null;

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async initialize(config: ProviderConfig): Promise<void> {
    if (config.kind !== "wa-twilio") {
      throw new Error(
        `TwilioProvider expects wa-twilio config, got ${config.kind}`,
      );
    }

    this.config = config;

    // Create Twilio client
    const auth =
      config.authToken != null
        ? { accountSid: config.accountSid, authToken: config.authToken }
        : config.apiKey && config.apiSecret
          ? {
              accountSid: config.accountSid,
              apiKey: config.apiKey,
              apiSecret: config.apiSecret,
            }
          : null;

    if (!auth) {
      throw new Error(
        "Twilio provider requires either authToken or apiKey+apiSecret",
      );
    }

    const env = {
      accountSid: config.accountSid,
      whatsappFrom: config.whatsappFrom,
      whatsappSenderSid: config.messagingServiceSid,
      auth,
    };

    this.client = createClient(env);
  }

  isConnected(): boolean {
    // For API providers, we're "connected" if the client exists and credentials are set
    return Boolean(this.client && this.config);
  }

  async disconnect(): Promise<void> {
    // Stop listening first
    if (this.listening) {
      await this.stopListening();
    }

    // Clear client
    this.client = null;
    this.config = null;
  }

  // ---------------------------------------------------------------------------
  // Outbound Messaging
  // ---------------------------------------------------------------------------

  async send(
    to: string,
    body: string,
    options?: SendOptions,
  ): Promise<SendResult> {
    if (!this.client || !this.config) {
      throw new Error("Provider not initialized");
    }

    const from = withWhatsAppPrefix(this.config.whatsappFrom);
    const toNumber = withWhatsAppPrefix(to);

    try {
      // Use messaging service SID if provided in options or config
      const messagingServiceSid =
        options?.providerOptions?.twilioMessagingServiceSid ??
        this.config.messagingServiceSid;

      const messageParams: {
        from?: string;
        messagingServiceSid?: string;
        to: string;
        body: string;
        mediaUrl?: string[];
      } = {
        to: toNumber,
        body,
      };

      // Add from or messagingServiceSid (mutually exclusive)
      if (messagingServiceSid) {
        messageParams.messagingServiceSid = messagingServiceSid;
      } else {
        messageParams.from = from;
      }

      // Add media URL if provided
      if (options?.media?.[0]?.url) {
        messageParams.mediaUrl = [options.media[0].url];
      }

      const message = await this.client.messages.create(messageParams);

      return {
        messageId: message.sid,
        status: "sent",
        providerMeta: {
          sid: message.sid,
          accountSid: this.config.accountSid,
        },
      };
    } catch (err) {
      return {
        messageId: "",
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async sendTyping(_to: string): Promise<void> {
    // Twilio API does not support typing indicators - this is a no-op
    // Silently ignore as per provider pattern
  }

  async getDeliveryStatus(messageId: string): Promise<DeliveryStatus> {
    if (!this.client) {
      throw new Error("Provider not initialized");
    }

    try {
      const message = await this.client.messages(messageId).fetch();
      const status = message.status ?? "unknown";

      // Map Twilio status to our normalized status
      let normalizedStatus: DeliveryStatus["status"];
      if (status === "delivered" || status === "sent") {
        normalizedStatus = "delivered";
      } else if (status === "read") {
        normalizedStatus = "read";
      } else if (
        status === "failed" ||
        status === "undelivered" ||
        status === "canceled"
      ) {
        normalizedStatus = "failed";
      } else {
        normalizedStatus = "sent"; // queued, sending, etc.
      }

      return {
        messageId,
        status: normalizedStatus,
        timestamp: message.dateUpdated?.getTime() ?? Date.now(),
        error:
          message.errorCode != null
            ? `${message.errorCode}: ${message.errorMessage ?? "Unknown error"}`
            : undefined,
        providerStatusCode: status,
      };
    } catch (err) {
      return {
        messageId,
        status: "unknown",
        timestamp: Date.now(),
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Inbound Messaging
  // ---------------------------------------------------------------------------

  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  async startListening(): Promise<void> {
    if (!this.config) {
      throw new Error("Provider not initialized");
    }

    if (!this.messageHandler) {
      throw new Error("Message handler not set. Call onMessage() first.");
    }

    if (this.listening) {
      throw new Error("Already listening");
    }

    const handler = this.messageHandler;

    // Start polling for messages
    // Use a simple polling approach similar to monitorTwilio but adapted for the provider pattern
    const pollIntervalSeconds = 5; // Default poll interval
    const lookbackMinutes = 5; // Look back 5 minutes for messages

    let lastSeenSid: string | undefined;

    const poll = async () => {
      try {
        const messages = await listRecentMessages(
          lookbackMinutes,
          50,
          this.client ?? undefined,
        );

        // Filter to inbound only
        const inbound = messages.filter((m) => m.direction === "inbound");

        // Sort newest first
        const newestFirst = [...inbound].sort(
          (a, b) =>
            (b.dateCreated?.getTime() ?? 0) - (a.dateCreated?.getTime() ?? 0),
        );

        // Process new messages (reverse iteration to process oldest first)
        for (let i = newestFirst.length - 1; i >= 0; i--) {
          const msg = newestFirst[i];
          if (!msg.sid) continue;
          if (lastSeenSid && msg.sid === lastSeenSid) continue;

          // Convert to ProviderMessage and call handler
          const providerMessage = this.convertTwilioMessageToProvider(msg);
          await handler(providerMessage);
        }

        // Update last seen SID
        if (newestFirst.length > 0) {
          lastSeenSid = newestFirst[0].sid;
        }
      } catch (err) {
        if (this.config?.verbose) {
          console.error(`Twilio polling failed: ${err}`);
        }
        // Continue polling even on errors
      }
    };

    // Mark as listening before starting poll
    this.listening = true;

    // Initial poll
    await poll();

    // Set up interval
    this.pollIntervalId = setInterval(poll, pollIntervalSeconds * 1000);

    // Store stop function
    this.stopMonitoringFn = () => {
      if (this.pollIntervalId) {
        clearInterval(this.pollIntervalId);
        this.pollIntervalId = null;
      }
    };
  }

  async stopListening(): Promise<void> {
    if (!this.listening) {
      return;
    }

    // Stop the polling interval
    if (this.stopMonitoringFn) {
      this.stopMonitoringFn();
      this.stopMonitoringFn = null;
    }

    this.listening = false;
  }

  // ---------------------------------------------------------------------------
  // Authentication & Session Management
  // ---------------------------------------------------------------------------

  async isAuthenticated(): Promise<boolean> {
    if (!this.client || !this.config) {
      return false;
    }

    try {
      // Test credentials by fetching account info
      const account = await this.client.api.v2010.accounts(
        this.config.accountSid,
      );
      await account.fetch();
      return true;
    } catch {
      return false;
    }
  }

  async login(): Promise<void> {
    // For API authentication, login is just validating credentials
    // This happens during initialize(), so we just check if authenticated
    const authenticated = await this.isAuthenticated();
    if (!authenticated) {
      throw new Error("Invalid Twilio credentials");
    }
  }

  async logout(): Promise<void> {
    // For API authentication, there's no session to logout
    // Just clear the client
    await this.disconnect();
  }

  async getSessionId(): Promise<string | null> {
    // Return the configured WhatsApp From number as the session identifier
    return this.config?.whatsappFrom ?? null;
  }

  // ---------------------------------------------------------------------------
  // Internal Helpers
  // ---------------------------------------------------------------------------

  /**
   * Convert Twilio ListedMessage to ProviderMessage format.
   */
  private convertTwilioMessageToProvider(msg: ListedMessage): ProviderMessage {
    // Strip whatsapp: prefix from phone numbers
    const from = msg.from ? stripWhatsAppPrefix(msg.from) : "";
    const to = msg.to ? stripWhatsAppPrefix(msg.to) : "";

    const providerMessage: ProviderMessage = {
      id: msg.sid,
      from,
      to,
      body: msg.body ?? "",
      timestamp: msg.dateCreated?.getTime() ?? Date.now(),
      provider: "wa-twilio",
      raw: msg, // Include original message for debugging
    };

    // Twilio doesn't provide display names in the basic message object
    // Would need to fetch contact details separately if needed

    // Note: Media URLs would need to be extracted from the message
    // This requires additional API calls to fetch media resources
    // For now, we'll skip media in the initial implementation

    return providerMessage;
  }
}
