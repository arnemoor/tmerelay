/**
 * Provider-aware prompt generation for Claude auto-reply.
 *
 * Dynamically generates identity prefixes based on the active provider,
 * mentioning the correct messenger (WhatsApp vs Telegram) and showing
 * accurate media size limits from provider capabilities.
 */

import type { Provider } from "../utils.js";
import { capabilities as twilioCapabilities } from "../providers/wa-twilio/capabilities.js";
import { capabilities as webCapabilities } from "../providers/wa-web/capabilities.js";
import { capabilities as telegramCapabilities } from "../telegram/capabilities.js";
import { CLAUDE_IDENTITY_PREFIX } from "./claude.js";

/**
 * Get provider capabilities by kind
 */
export function getProviderCapabilities(provider: Provider) {
  switch (provider) {
    case "wa-twilio":
      return twilioCapabilities;
    case "wa-web":
      return webCapabilities;
    case "telegram":
      return telegramCapabilities;
  }
}

/**
 * Format bytes in human-readable form
 */
function formatBytes(bytes: number): string {
  const kb = 1024;
  const mb = kb * 1024;
  const gb = mb * 1024;

  if (bytes >= gb) return `${(bytes / gb).toFixed(0)}GB`;
  if (bytes >= mb) return `${(bytes / mb).toFixed(0)}MB`;
  if (bytes >= kb) return `${(bytes / kb).toFixed(0)}KB`;
  return `${bytes}B`;
}

/**
 * Get display name: "WhatsApp" or "Telegram"
 */
export function getProviderDisplayName(provider: Provider): string {
  return provider === "telegram" ? "Telegram" : "WhatsApp";
}

/**
 * Format provider display name with detail for multi-provider context
 * @param provider - Provider kind
 * @returns Formatted name like "WhatsApp Web", "WhatsApp (Twilio)", or "Telegram"
 */
export function getProviderDisplayNameDetailed(provider: Provider): string {
  switch (provider) {
    case "wa-web":
      return "WhatsApp Web";
    case "wa-twilio":
      return "WhatsApp (Twilio)";
    case "telegram":
      return "Telegram";
  }
}

/**
 * Format multiple providers as comma-separated list for template expansion
 * @param providers - Array of providers (or single provider)
 * @returns Formatted string like "WhatsApp Web, Telegram"
 */
export function formatProvidersForTemplate(
  providers: Provider | Provider[] | undefined,
): string {
  if (!providers) return "";
  const providerArray = Array.isArray(providers) ? providers : [providers];
  if (providerArray.length === 0) return "";
  return providerArray.map(getProviderDisplayNameDetailed).join(", ");
}

/**
 * Build provider-aware identity prefix.
 *
 * Generates a prompt that mentions the correct messenger name (WhatsApp vs Telegram)
 * and shows accurate media size limits from provider capabilities.
 *
 * @param provider - The active provider (wa-web, wa-twilio, telegram), or undefined for fallback
 * @param customPrefix - User-provided override from config (takes precedence)
 * @returns The identity prefix to use in the Claude prompt
 */
export function buildProviderAwareIdentity(
  provider?: Provider,
  customPrefix?: string,
): string {
  // User override takes precedence
  if (customPrefix) return customPrefix;

  // No provider context? Use fallback
  if (!provider) return CLAUDE_IDENTITY_PREFIX;

  // Generate provider-specific prompt
  const caps = getProviderCapabilities(provider);
  const messengerName = getProviderDisplayName(provider);
  const mediaLimit = formatBytes(caps.maxMediaSize);

  return `You are Clawd (Claude) running on the user's Mac via clawdis. Keep ${messengerName} replies under ~1500 characters. Your scratchpad is ~/clawd; this is your folder and you can add what you like in markdown files and/or images. You can send media by including MEDIA:/path/to/file.jpg on its own line (no spaces in path). Media limit: ${mediaLimit}. The prompt may include a media path and an optional Transcript: section—use them when present. If a prompt is a heartbeat poll and nothing needs attention, reply with exactly HEARTBEAT_OK and nothing else; for any alert, do not include HEARTBEAT_OK.`;
}
