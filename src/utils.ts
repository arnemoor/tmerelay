import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { isVerbose, logVerbose } from "./globals.js";

export async function ensureDir(dir: string) {
  await fs.promises.mkdir(dir, { recursive: true });
}

/**
 * Best-effort check that a directory exists and is writable.
 * Creates the directory if missing; returns false if creation or access fails.
 */
export function canUseDir(dir: string): boolean {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export type Provider = "twilio" | "web" | "telegram";

export function assertProvider(input: string): asserts input is Provider {
  if (input !== "twilio" && input !== "web" && input !== "telegram") {
    throw new Error("Provider must be 'web', 'twilio', or 'telegram'");
  }
}

export type AllowFromProvider = "telegram" | "web" | "twilio";

export const TELEGRAM_PREFIX = "telegram:";

/**
 * Normalize an allowFrom entry for a specific provider.
 * - Telegram: ensure `telegram:` prefix and `@username` casing
 * - WhatsApp/Web: return normalized E.164 without whatsapp: prefix
 */
export function normalizeAllowFromEntry(
  entry: string,
  provider: AllowFromProvider,
): string {
  const trimmed = entry.trim().toLowerCase();
  if (!trimmed) return "";

  if (provider === "telegram") {
    // Strip telegram: prefix if present (allowFrom entries may or may not have it)
    const withoutPrefix = trimmed.startsWith(TELEGRAM_PREFIX)
      ? trimmed.slice(TELEGRAM_PREFIX.length)
      : trimmed;

    // Ensure @username format, then add telegram: prefix
    const username = withoutPrefix.startsWith("@")
      ? withoutPrefix
      : withoutPrefix.match(/^\d+$/)
        ? withoutPrefix // numeric ID, keep as-is
        : `@${withoutPrefix}`;

    return `${TELEGRAM_PREFIX}${username}`;
  }

  // WhatsApp (both web and twilio) use E.164 phone numbers
  return normalizeE164(entry);
}

export function normalizePath(p: string): string {
  if (!p.startsWith("/")) return `/${p}`;
  return p;
}

export function withWhatsAppPrefix(number: string): string {
  return number.startsWith("whatsapp:") ? number : `whatsapp:${number}`;
}

export function normalizeE164(number: string): string {
  const withoutPrefix = number.replace(/^whatsapp:/, "").trim();
  const digits = withoutPrefix.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return `+${digits.slice(1)}`;
  return `+${digits}`;
}

export function toWhatsappJid(number: string): string {
  const e164 = normalizeE164(number);
  const digits = e164.replace(/\D/g, "");
  return `${digits}@s.whatsapp.net`;
}

export function jidToE164(jid: string): string | null {
  // Convert a WhatsApp JID (with optional device suffix, e.g. 1234:1@s.whatsapp.net) back to +1234.
  const match = jid.match(/^(\d+)(?::\d+)?@s\.whatsapp\.net$/);
  if (match) {
    const digits = match[1];
    return `+${digits}`;
  }

  // Support @lid format (WhatsApp Linked ID) - look up reverse mapping
  const lidMatch = jid.match(/^(\d+)(?::\d+)?@lid$/);
  if (lidMatch) {
    const lid = lidMatch[1];
    try {
      const mappingPath = `${CONFIG_DIR}/credentials/lid-mapping-${lid}_reverse.json`;
      const data = fs.readFileSync(mappingPath, "utf8");
      const phone = JSON.parse(data);
      if (phone) return `+${phone}`;
    } catch {
      if (isVerbose()) {
        logVerbose(
          `LID mapping not found for ${lid}; skipping inbound message`,
        );
      }
      // Mapping not found, fall through
    }
  }

  return null;
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Prefer new branding directory; fall back to legacy for compatibility.
export const CONFIG_DIR = (() => {
  const override = process.env.WARELAY_CONFIG_DIR;

  if (override) {
    const resolved = path.resolve(override);
    if (canUseDir(resolved)) return resolved;
  }

  const clawdis = path.join(os.homedir(), ".clawdis");
  const legacy = path.join(os.homedir(), ".warelay");
  if (canUseDir(clawdis)) return clawdis;
  if (canUseDir(legacy)) return legacy;

  // Sandbox-safe fallback inside the workspace when home isn't writable
  const fallback = path.join(process.cwd(), ".clawdis");
  if (canUseDir(fallback)) return fallback;

  // Last resort: OS tmp (should be writable)
  const tmp = path.join(os.tmpdir(), "clawdis");
  fs.mkdirSync(tmp, { recursive: true });
  return tmp;
})();
