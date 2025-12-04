import type { ProviderCapabilities } from "../providers/base/types.js";

/**
 * Telegram MTProto Provider Capabilities
 *
 * Declares what features the Telegram provider supports through the Provider interface.
 * Note: Telegram's API supports many features that are not yet exposed via our Provider interface.
 */
export const capabilities: ProviderCapabilities = {
  // Telegram MTProto doesn't provide reliable delivery/read receipt tracking
  // Messages are sent optimistically without guaranteed delivery confirmation
  supportsDeliveryReceipts: false,
  supportsReadReceipts: false, // Not exposed via Provider interface

  // Typing indicator is supported
  supportsTypingIndicator: true,

  // Advanced features not yet exposed via Provider interface
  // (These require peer context which the current architecture doesn't maintain)
  supportsReactions: false,
  supportsReplies: true, // Basic reply support via send()
  supportsEditing: false,
  supportsDeleting: false,

  // Telegram has very generous file size limits (2GB)
  // Note: Current implementation buffers entire files in memory
  maxMediaSize: 2 * 1024 * 1024 * 1024, // 2GB (with size check before download)

  // Telegram supports virtually all file types
  supportedMediaTypes: ["*/*"],

  // Telegram allows initiating conversations with any user
  canInitiateConversation: true,
};
