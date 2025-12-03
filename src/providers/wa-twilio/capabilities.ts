/**
 * WhatsApp Twilio Provider Capabilities
 *
 * Declares what features the Twilio WhatsApp API supports.
 */

import type { ProviderCapabilities } from "../base/index.js";

export const capabilities: ProviderCapabilities = {
  // Twilio supports delivery receipts (delivered/read status)
  supportsDeliveryReceipts: true,

  // Twilio does not support read receipts via API
  supportsReadReceipts: false,

  // Twilio API does not support typing indicators
  supportsTypingIndicator: false,

  // Twilio does not support reactions via API
  supportsReactions: false,

  // Twilio does not support replies via API
  supportsReplies: false,

  // Twilio does not support editing sent messages
  supportsEditing: false,

  // Twilio does not support deleting messages
  supportsDeleting: false,

  // Twilio has a 5MB media limit for WhatsApp
  maxMediaSize: 5 * 1024 * 1024, // 5MB

  // Supported media types per Twilio WhatsApp docs
  supportedMediaTypes: [
    "image/jpeg",
    "image/png",
    "video/mp4",
    "audio/ogg",
    "audio/mpeg",
    "audio/mp4",
    "application/pdf",
  ],

  // Twilio can only send to opted-in users (24h conversation window)
  // After 24h, messages require template messages
  canInitiateConversation: true,
};
