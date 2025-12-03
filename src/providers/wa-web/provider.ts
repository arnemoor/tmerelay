/**
 * WhatsApp Web Provider Implementation
 *
 * Wraps existing Baileys/WhatsApp Web code with the unified Provider interface.
 * This is a wrapper only - it delegates to existing implementations in src/web/.
 */

import type { makeWASocket } from "@whiskeysockets/baileys";
import { jidToE164, toWhatsappJid } from "../../utils.js";
import type { WebInboundMessage } from "../../web/inbound.js";
import { monitorWebInbox } from "../../web/inbound.js";
import { loginWeb } from "../../web/login.js";
import { sendMessageWeb } from "../../web/outbound.js";
import { createWaSocket, logoutWeb, webAuthExists } from "../../web/session.js";
import type {
  DeliveryStatus,
  MessageHandler,
  Provider,
  ProviderConfig,
  ProviderMessage,
  SendOptions,
  SendResult,
  WebProviderConfig,
} from "../base/index.js";
import { capabilities } from "./capabilities.js";

/**
 * WhatsApp Web Provider
 *
 * Implements the Provider interface by wrapping existing WhatsApp Web code.
 */
export class WebProvider implements Provider {
  readonly kind = "wa-web" as const;
  readonly capabilities = capabilities;

  private socket: ReturnType<typeof makeWASocket> | null = null;
  private config: WebProviderConfig | null = null;
  private messageHandler: MessageHandler | null = null;
  private listening = false;
  private listenerInstance: Awaited<ReturnType<typeof monitorWebInbox>> | null =
    null;

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async initialize(config: ProviderConfig): Promise<void> {
    if (config.kind !== "wa-web") {
      throw new Error(`WebProvider expects wa-web config, got ${config.kind}`);
    }

    this.config = config;

    // Create socket but don't wait for connection yet
    // The socket will connect automatically when needed
    this.socket = await createWaSocket(
      this.config.printQr ?? false,
      this.config.verbose ?? false,
    );
  }

  isConnected(): boolean {
    // Check if socket exists and connection state is open
    if (!this.socket) return false;

    // Baileys ConnectionState is not directly accessible, so we check if the socket exists
    // and has a user (which means it's authenticated)
    return Boolean(this.socket.user);
  }

  async disconnect(): Promise<void> {
    // Stop listening first
    if (this.listening) {
      await this.stopListening();
    }

    // Close socket if it exists
    if (this.socket) {
      try {
        this.socket.ws?.close();
      } catch (err) {
        // Ignore close errors
        if (this.config?.verbose) {
          console.error(`Socket close failed: ${err}`);
        }
      }
      this.socket = null;
    }

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
    if (!this.config) {
      throw new Error("Provider not initialized");
    }

    try {
      // sendMessageWeb expects E.164 format and handles JID conversion internally
      const result = await sendMessageWeb(to, body, {
        verbose: this.config.verbose ?? false,
        mediaUrl: options?.media?.[0]?.url, // Only support first media for now
      });

      return {
        messageId: result.messageId,
        status: "sent",
        providerMeta: {
          jid: result.toJid,
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

  async sendTyping(to: string): Promise<void> {
    if (!this.socket) {
      throw new Error("Provider not initialized");
    }

    const jid = toWhatsappJid(to);
    try {
      await this.socket.sendPresenceUpdate("composing", jid);
    } catch (err) {
      // Typing indicators are best-effort, don't throw
      if (this.config?.verbose) {
        console.error(`Failed to send typing indicator: ${err}`);
      }
    }
  }

  async getDeliveryStatus(messageId: string): Promise<DeliveryStatus> {
    // WhatsApp Web doesn't provide reliable delivery status tracking
    // through Baileys without setting up receipt listeners
    return {
      messageId,
      status: "unknown",
      timestamp: Date.now(),
    };
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

    // Start monitoring the inbox
    this.listenerInstance = await monitorWebInbox({
      verbose: this.config.verbose ?? false,
      onMessage: async (msg: WebInboundMessage) => {
        // Convert WebInboundMessage to ProviderMessage
        const providerMessage = this.convertWebMessageToProvider(msg);

        // Call the registered handler
        await handler(providerMessage);
      },
    });

    this.listening = true;
  }

  async stopListening(): Promise<void> {
    if (!this.listening) {
      return;
    }

    if (this.listenerInstance) {
      try {
        await this.listenerInstance.close();
      } catch (err) {
        if (this.config?.verbose) {
          console.error(`Failed to close listener: ${err}`);
        }
      }
      this.listenerInstance = null;
    }

    this.listening = false;
  }

  // ---------------------------------------------------------------------------
  // Authentication & Session Management
  // ---------------------------------------------------------------------------

  async isAuthenticated(): Promise<boolean> {
    return webAuthExists();
  }

  async login(): Promise<void> {
    if (!this.config) {
      throw new Error("Provider not initialized");
    }

    await loginWeb(this.config.verbose ?? false);
  }

  async logout(): Promise<void> {
    await logoutWeb();
  }

  async getSessionId(): Promise<string | null> {
    if (!this.socket?.user?.id) {
      return null;
    }

    // Extract E.164 from JID
    return jidToE164(this.socket.user.id);
  }

  // ---------------------------------------------------------------------------
  // Internal Helpers
  // ---------------------------------------------------------------------------

  /**
   * Convert WebInboundMessage to ProviderMessage format.
   */
  private convertWebMessageToProvider(msg: WebInboundMessage): ProviderMessage {
    const providerMessage: ProviderMessage = {
      id: msg.id ?? "",
      from: msg.from,
      to: msg.to,
      body: msg.body,
      timestamp: msg.timestamp ?? Date.now(),
      displayName: msg.pushName || msg.senderName,
      provider: "wa-web",
      raw: msg, // Include original message for debugging
    };

    // Add media if present
    if (msg.mediaPath || msg.mediaUrl) {
      providerMessage.media = [
        {
          type: this.inferMediaType(msg.mediaType),
          url: msg.mediaUrl,
          // Note: WebInboundMessage doesn't expose buffer directly,
          // but has a mediaPath for local files
          mimeType: msg.mediaType,
        },
      ];
    }

    return providerMessage;
  }

  /**
   * Infer media type category from MIME type.
   */
  private inferMediaType(
    mimeType?: string,
  ): "image" | "video" | "audio" | "document" | "voice" {
    if (!mimeType) return "document";

    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("video/")) return "video";
    if (mimeType.startsWith("audio/")) {
      // Check if it's a voice note (ogg with opus codec)
      if (mimeType.includes("ogg") || mimeType.includes("opus")) {
        return "voice";
      }
      return "audio";
    }

    return "document";
  }
}
