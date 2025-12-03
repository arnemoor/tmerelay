import fs from "node:fs";
import os from "node:os";
import { isVerbose, logVerbose } from "./globals.js";

export async function ensureDir(dir: string) {
  await fs.promises.mkdir(dir, { recursive: true });
}

export type Provider = "wa-twilio" | "wa-web" | "telegram";

export function normalizeProvider(input: string): Provider {
  // Legacy aliases with deprecation warnings
  if (input === "web") {
    console.warn('⚠️  "web" is deprecated. Use "wa-web" instead.');
    return "wa-web";
  }
  if (input === "twilio") {
    console.warn('⚠️  "twilio" is deprecated. Use "wa-twilio" instead.');
    return "wa-twilio";
  }
  assertProvider(input);
  return input;
}

export function assertProvider(input: string): asserts input is Provider {
  if (input !== "wa-twilio" && input !== "wa-web" && input !== "telegram") {
    throw new Error('Provider must be "wa-web", "wa-twilio", or "telegram"');
  }
}

export function normalizePath(p: string): string {
  if (!p.startsWith("/")) return `/${p}`;
  return p;
}

export function withWhatsAppPrefix(number: string): string {
  return number.startsWith("whatsapp:") ? number : `whatsapp:${number}`;
}

export function stripWhatsAppPrefix(number: string): string {
  return number.replace(/^whatsapp:/, "");
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

export const CONFIG_DIR = `${os.homedir()}/.warelay`;
