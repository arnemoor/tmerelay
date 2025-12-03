/**
 * Provider Interface Proposal for warelay
 *
 * This file contains the proposed TypeScript interfaces for the provider
 * abstraction layer. It is intended as a reference/specification document.
 *
 * All providers (Twilio, Web, Telegram) follow the same model:
 * - Personal account automation for 1-on-1 conversations
 * - `allowFrom` whitelist security model
 * - Unified message format
 *
 * Evidence: Analysis of existing code at:
 * - src/providers/provider.types.ts
 * - src/twilio/send.ts
 * - src/web/outbound.ts
 * - src/web/inbound.ts
 * - src/cli/deps.ts
 */

// =============================================================================
// PROVIDER TYPES
// =============================================================================

/**
 * Supported provider kinds.
 * Extend this union when adding new providers.
 */
export type ProviderKind = "wa-twilio" | "wa-web" | "telegram";

// =============================================================================
// MESSAGE TYPES
// =============================================================================

/**
 * Media attachment for messages.
 * Supports both URL-based (Twilio) and buffer-based (Web/Telegram) media.
 */
export interface ProviderMedia {
  /** Media type category */
  type: "image" | "video" | "audio" | "document" | "voice";

  /** Remote URL (for Twilio or download) */
  url?: string;

  /** Local buffer (for Web/Telegram direct send) */
  buffer?: Buffer;

  /** MIME type (e.g., "image/jpeg", "audio/ogg") */
  mimeType?: string;

  /** Original filename (for documents) */
  fileName?: string;

  /** File size in bytes */
  size?: number;

  /** Thumbnail buffer (for video/document previews) */
  thumbnail?: Buffer;
}

/**
 * Normalized inbound message from any provider.
 * This is the common format used by the auto-reply engine.
 */
export interface ProviderMessage {
  /** Unique message identifier (SID, message key, or message_id) */
  id: string;

  /** Sender identifier (normalized per provider) */
  from: string;

  /** Recipient identifier (usually your account) */
  to: string;

  /** Message text body */
  body: string;

  /** Unix timestamp in milliseconds */
  timestamp: number;

  /** Sender's display name if available */
  displayName?: string;

  /** Attached media */
  media?: ProviderMedia[];

  /** Provider-specific raw payload for advanced use cases */
  raw?: unknown;

  /** Which provider this message came from */
  provider: ProviderKind;
}

// =============================================================================
// SEND TYPES
// =============================================================================

/**
 * Options for sending a message.
 */
export interface SendOptions {
  /** Attach media to the message */
  media?: ProviderMedia[];

  /** Message ID to reply to (creates a threaded reply) */
  replyTo?: string;

  /** Send typing indicator before message */
  typing?: boolean;

  /** Provider-specific options */
  providerOptions?: {
    /** Twilio: Messaging Service SID override */
    twilioMessagingServiceSid?: string;
  };
}

/**
 * Result of sending a message.
 */
export interface SendResult {
  /** Message identifier from the provider */
  messageId: string;

  /** Immediate send status */
  status: "sent" | "queued" | "failed";

  /** Error message if status is "failed" */
  error?: string;

  /** Provider-specific metadata */
  providerMeta?: {
    /** Twilio: Message SID */
    sid?: string;

    /** Twilio: Account SID */
    accountSid?: string;

    /** Telegram: User ID */
    userId?: number;

    /** Web: JID */
    jid?: string;
  };
}

/**
 * Delivery status for a sent message.
 */
export interface DeliveryStatus {
  /** Message identifier */
  messageId: string;

  /** Current delivery status */
  status: "sent" | "delivered" | "read" | "failed" | "unknown";

  /** Status update timestamp */
  timestamp?: number;

  /** Error details if failed */
  error?: string;

  /** Provider-specific status code */
  providerStatusCode?: string | number;
}

// =============================================================================
// PROVIDER CAPABILITIES
// =============================================================================

/**
 * Declares what features a provider supports.
 * Used for graceful degradation and feature detection.
 */
export interface ProviderCapabilities {
  /** Can query delivery status */
  supportsDeliveryReceipts: boolean;

  /** Can receive read receipts */
  supportsReadReceipts: boolean;

  /** Can send typing/composing indicators */
  supportsTypingIndicator: boolean;

  /** Can add emoji reactions to messages */
  supportsReactions: boolean;

  /** Can reply to specific messages (threaded) */
  supportsReplies: boolean;

  /** Can edit sent messages */
  supportsEditing: boolean;

  /** Can delete sent messages */
  supportsDeleting: boolean;

  /** Maximum media size in bytes */
  maxMediaSize: number;

  /** Supported media MIME types */
  supportedMediaTypes: string[];

  /** Can initiate conversations */
  canInitiateConversation: boolean;
}

// =============================================================================
// PROVIDER CONFIGURATION
// =============================================================================

/**
 * Base configuration shared by all providers.
 */
export interface BaseProviderConfig {
  /** Verbose logging */
  verbose?: boolean;

  /** Custom logger instance */
  logger?: unknown;
}

/**
 * Twilio WhatsApp provider configuration.
 * Evidence: src/env.ts:L6-L15
 */
export interface TwilioProviderConfig extends BaseProviderConfig {
  kind: "wa-twilio";

  /** Twilio Account SID */
  accountSid: string;

  /** Twilio Auth Token (primary auth method) */
  authToken?: string;

  /** Twilio API Key (alternative auth) */
  apiKey?: string;

  /** Twilio API Secret (required with apiKey) */
  apiSecret?: string;

  /** WhatsApp sender number (e.g., "whatsapp:+1234567890") */
  whatsappFrom: string;

  /** Optional: Messaging Service SID for webhook configuration */
  messagingServiceSid?: string;
}

/**
 * WhatsApp Web provider configuration.
 * Evidence: src/web/session.ts:L22-L26
 */
export interface WebProviderConfig extends BaseProviderConfig {
  kind: "wa-web";

  /** Directory for Baileys auth state (default: ~/.warelay/credentials) */
  authDir?: string;

  /** Print QR code for login */
  printQr?: boolean;

  /** Reconnection policy */
  reconnect?: {
    initialMs?: number;
    maxMs?: number;
    factor?: number;
    jitter?: number;
    maxAttempts?: number;
  };
}

/**
 * Telegram MTProto provider configuration.
 * Uses personal account via MTProto client (like WhatsApp Web).
 */
export interface TelegramProviderConfig extends BaseProviderConfig {
  kind: "telegram";

  /** API ID from https://my.telegram.org/apps */
  apiId: number;

  /** API Hash from https://my.telegram.org/apps */
  apiHash: string;

  /** Directory for session storage (default: ~/.warelay/telegram/session) */
  sessionDir?: string;

  /** Security whitelist: usernames (@user) or user IDs (123456789) */
  allowFrom?: string[];
}

/**
 * Union of all provider configurations.
 */
export type ProviderConfig =
  | TwilioProviderConfig
  | WebProviderConfig
  | TelegramProviderConfig;

// =============================================================================
// INBOUND MESSAGE HANDLER
// =============================================================================

/**
 * Handler function for inbound messages.
 * Called by the provider when a new message is received.
 */
export type MessageHandler = (message: ProviderMessage) => Promise<void>;

/**
 * Handler context with reply helpers.
 * Extends ProviderMessage with convenience methods.
 */
export interface MessageContext extends ProviderMessage {
  /** Send typing indicator to this chat */
  sendTyping(): Promise<void>;

  /** Reply with text */
  reply(text: string): Promise<SendResult>;

  /** Reply with media */
  replyWithMedia(text: string, media: ProviderMedia[]): Promise<SendResult>;
}

/**
 * Enhanced message handler with context.
 */
export type MessageContextHandler = (ctx: MessageContext) => Promise<void>;

// =============================================================================
// PROVIDER INTERFACE
// =============================================================================

/**
 * Core provider interface.
 * All providers must implement this interface.
 */
export interface Provider {
  /** Provider type identifier */
  readonly kind: ProviderKind;

  /** Declared capabilities */
  readonly capabilities: ProviderCapabilities;

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Initialize the provider with configuration.
   * Must be called before any other methods.
   */
  initialize(config: ProviderConfig): Promise<void>;

  /**
   * Check if the provider is connected and ready.
   */
  isConnected(): boolean;

  /**
   * Gracefully disconnect and cleanup resources.
   */
  disconnect(): Promise<void>;

  // ---------------------------------------------------------------------------
  // Outbound Messaging
  // ---------------------------------------------------------------------------

  /**
   * Send a message to a recipient.
   *
   * @param to - Recipient identifier (phone, user ID, username)
   * @param body - Message text
   * @param options - Optional send options
   * @returns Send result with message ID
   */
  send(to: string, body: string, options?: SendOptions): Promise<SendResult>;

  /**
   * Send a typing/composing indicator.
   *
   * @param to - Chat/conversation identifier
   */
  sendTyping(to: string): Promise<void>;

  // ---------------------------------------------------------------------------
  // Inbound Messaging
  // ---------------------------------------------------------------------------

  /**
   * Register a handler for inbound messages.
   * Handler is called for each new message.
   *
   * @param handler - Async function to process messages
   */
  onMessage(handler: MessageHandler): void;

  /**
   * Start listening for inbound messages.
   * Activates persistent connection.
   */
  startListening(): Promise<void>;

  /**
   * Stop listening for inbound messages.
   */
  stopListening(): Promise<void>;

  // ---------------------------------------------------------------------------
  // Optional: Status Tracking
  // ---------------------------------------------------------------------------

  /**
   * Get delivery status for a sent message.
   * Only available if capabilities.supportsDeliveryReceipts is true.
   *
   * @param messageId - Message identifier from send()
   */
  getDeliveryStatus?(messageId: string): Promise<DeliveryStatus>;

  /**
   * Poll for delivery status until terminal state or timeout.
   *
   * @param messageId - Message identifier
   * @param timeoutMs - Maximum wait time
   * @param pollIntervalMs - Time between polls
   */
  waitForDelivery?(
    messageId: string,
    timeoutMs: number,
    pollIntervalMs: number
  ): Promise<DeliveryStatus>;
}

// =============================================================================
// PROVIDER FACTORY
// =============================================================================

/**
 * Provider constructor type.
 */
export type ProviderConstructor = new () => Provider;

/**
 * Provider registry for dynamic provider loading.
 */
export interface ProviderRegistry {
  /**
   * Register a provider implementation.
   */
  register(kind: ProviderKind, constructor: ProviderConstructor): void;

  /**
   * Create a provider instance.
   */
  create(config: ProviderConfig): Promise<Provider>;

  /**
   * Get list of registered provider kinds.
   */
  getAvailable(): ProviderKind[];

  /**
   * Check if a provider is registered.
   */
  has(kind: ProviderKind): boolean;
}

// =============================================================================
// IDENTIFIER NORMALIZATION
// =============================================================================

/**
 * Normalized identifier with display and raw forms.
 */
export interface NormalizedIdentifier {
  /** Which provider this identifier belongs to */
  provider: ProviderKind;

  /** Original identifier as provided */
  raw: string;

  /** Normalized form for internal use */
  normalized: string;

  /** Human-readable display form */
  display: string;
}

/**
 * Identifier normalizer interface.
 */
export interface IdentifierNormalizer {
  /**
   * Normalize an identifier for a specific provider.
   */
  normalize(provider: ProviderKind, raw: string): NormalizedIdentifier;

  /**
   * Convert between provider identifier formats.
   * Returns null if conversion is not possible.
   */
  convert?(
    from: NormalizedIdentifier,
    toProvider: ProviderKind
  ): NormalizedIdentifier | null;
}

// =============================================================================
// EXAMPLE CAPABILITIES (REFERENCE)
// =============================================================================

/**
 * Example: Twilio provider capabilities.
 * Evidence: Analysis of Twilio API features and src/twilio/send.ts
 */
export const TWILIO_CAPABILITIES: ProviderCapabilities = {
  supportsDeliveryReceipts: true,
  supportsReadReceipts: false, // Not exposed via API
  supportsTypingIndicator: true,
  supportsReactions: false,
  supportsReplies: false, // WhatsApp Business doesn't support threaded replies
  supportsEditing: false,
  supportsDeleting: false,
  maxMediaSize: 16 * 1024 * 1024, // 16MB
  supportedMediaTypes: [
    "image/jpeg",
    "image/png",
    "image/gif",
    "video/mp4",
    "audio/ogg",
    "audio/mpeg",
    "application/pdf",
  ],
  canInitiateConversation: true, // With template messages
};

/**
 * Example: Web provider capabilities.
 * Evidence: Analysis of Baileys features and src/web/inbound.ts
 */
export const WEB_CAPABILITIES: ProviderCapabilities = {
  supportsDeliveryReceipts: false, // Not reliably exposed
  supportsReadReceipts: false,
  supportsTypingIndicator: true,
  supportsReactions: true,
  supportsReplies: true,
  supportsEditing: false, // Baileys limitation
  supportsDeleting: true,
  maxMediaSize: 64 * 1024 * 1024, // 64MB
  supportedMediaTypes: [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "video/mp4",
    "audio/ogg",
    "audio/mpeg",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  canInitiateConversation: true,
};

/**
 * Example: Telegram MTProto provider capabilities.
 * Evidence: GramJS documentation and Telegram API docs
 */
export const TELEGRAM_CAPABILITIES: ProviderCapabilities = {
  supportsDeliveryReceipts: true, // MTProto provides this
  supportsReadReceipts: true, // MTProto provides this
  supportsTypingIndicator: true,
  supportsReactions: true,
  supportsReplies: true,
  supportsEditing: true,
  supportsDeleting: true,
  maxMediaSize: 2 * 1024 * 1024 * 1024, // 2GB
  supportedMediaTypes: [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "video/mp4",
    "audio/ogg",
    "audio/mpeg",
    "application/pdf",
    "application/zip",
  ],
  canInitiateConversation: true, // Personal account can initiate
};
