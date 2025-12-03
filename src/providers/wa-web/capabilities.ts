/**
 * WhatsApp Web Provider Capabilities
 *
 * Declares what features the WhatsApp Web provider supports.
 */

import type { ProviderCapabilities } from "../base/index.js";

export const capabilities: ProviderCapabilities = {
  // WhatsApp Web supports delivery and read receipts via Baileys events
  supportsDeliveryReceipts: true,
  supportsReadReceipts: true,

  // WhatsApp Web supports typing indicators via presence updates
  supportsTypingIndicator: true,

  // WhatsApp Web doesn't support reactions through Baileys reliably
  supportsReactions: false,

  // WhatsApp Web supports replies via quoted messages
  supportsReplies: true,

  // WhatsApp Web doesn't support editing sent messages
  supportsEditing: false,

  // WhatsApp Web supports deleting messages for everyone
  supportsDeleting: true,

  // WhatsApp Web has a 64MB media limit
  maxMediaSize: 64 * 1024 * 1024, // 64MB

  // Supported media types (common ones)
  supportedMediaTypes: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "video/mp4",
    "video/3gpp",
    "audio/ogg",
    "audio/mpeg",
    "audio/mp4",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
  ],

  // WhatsApp Web can initiate conversations (as a personal account)
  canInitiateConversation: true,
};
