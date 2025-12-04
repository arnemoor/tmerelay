import { describe, it, expect } from "vitest";
import {
  buildProviderAwareIdentity,
  getProviderCapabilities,
  getProviderDisplayName,
} from "./provider-prompt.js";

describe("provider-prompt", () => {
  describe("getProviderCapabilities", () => {
    it("returns correct capabilities for wa-twilio", () => {
      const caps = getProviderCapabilities("wa-twilio");
      expect(caps.maxMediaSize).toBe(5 * 1024 * 1024); // 5MB
    });

    it("returns correct capabilities for wa-web", () => {
      const caps = getProviderCapabilities("wa-web");
      expect(caps.maxMediaSize).toBe(64 * 1024 * 1024); // 64MB
    });

    it("returns correct capabilities for telegram", () => {
      const caps = getProviderCapabilities("telegram");
      // Default 2GB (can be overridden via env)
      expect(caps.maxMediaSize).toBeGreaterThanOrEqual(2 * 1024 * 1024 * 1024);
    });
  });

  describe("getProviderDisplayName", () => {
    it("returns WhatsApp for wa-twilio", () => {
      expect(getProviderDisplayName("wa-twilio")).toBe("WhatsApp");
    });

    it("returns WhatsApp for wa-web", () => {
      expect(getProviderDisplayName("wa-web")).toBe("WhatsApp");
    });

    it("returns Telegram for telegram", () => {
      expect(getProviderDisplayName("telegram")).toBe("Telegram");
    });
  });

  describe("buildProviderAwareIdentity", () => {
    it("uses custom prefix when provided", () => {
      const custom = "Custom identity prefix";
      const result = buildProviderAwareIdentity("telegram", custom);
      expect(result).toBe(custom);
    });

    it("uses fallback when no provider specified", () => {
      const result = buildProviderAwareIdentity(undefined, undefined);
      expect(result).toContain("WhatsApp");
      expect(result).toContain("images ≤6MB");
    });

    it("generates Telegram-specific prompt", () => {
      const result = buildProviderAwareIdentity("telegram", undefined);
      expect(result).toContain("Telegram");
      expect(result).toContain("2GB"); // Default Telegram limit
      expect(result).not.toContain("WhatsApp");
    });

    it("generates wa-web-specific prompt with 64MB", () => {
      const result = buildProviderAwareIdentity("wa-web", undefined);
      expect(result).toContain("WhatsApp");
      expect(result).toContain("64MB");
      expect(result).not.toContain("Telegram");
    });

    it("generates wa-twilio-specific prompt with 5MB", () => {
      const result = buildProviderAwareIdentity("wa-twilio", undefined);
      expect(result).toContain("WhatsApp");
      expect(result).toContain("5MB");
      expect(result).not.toContain("Telegram");
    });

    it("includes common elements in all prompts", () => {
      const providers: Array<"telegram" | "wa-web" | "wa-twilio"> = [
        "telegram",
        "wa-web",
        "wa-twilio",
      ];

      for (const provider of providers) {
        const result = buildProviderAwareIdentity(provider, undefined);
        expect(result).toContain("Clawd");
        expect(result).toContain("Claude");
        expect(result).toContain("~1500 characters");
        expect(result).toContain("~/clawd");
        expect(result).toContain("MEDIA:");
        expect(result).toContain("HEARTBEAT_OK");
      }
    });
  });
});
