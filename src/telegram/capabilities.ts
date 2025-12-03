import type { ProviderCapabilities } from "../providers/base/types.js";

/**
 * Telegram MTProto Provider Capabilities
 *
 * Declares what features the Telegram provider supports.
 */
export const capabilities: ProviderCapabilities = {
  // Telegram MTProto doesn't provide reliable delivery/read receipt tracking
  // Messages are sent optimistically without guaranteed delivery confirmation
  supportsDeliveryReceipts: false,
  supportsReadReceipts: true,

  // Full support for modern messaging features
  supportsTypingIndicator: true,
  supportsReactions: true,
  supportsReplies: true,
  supportsEditing: true,
  supportsDeleting: true,

  // Telegram has very generous file size limits (2GB)
  maxMediaSize: 2 * 1024 * 1024 * 1024, // 2GB

  // Telegram supports virtually all file types
  supportedMediaTypes: ["*/*"],

  // Telegram allows initiating conversations with any user
  canInitiateConversation: true,
};
