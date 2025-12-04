import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  assertProvider,
  CONFIG_DIR,
  ensureDir,
  jidToE164,
  normalizeAllowFromEntry,
  normalizeE164,
  normalizePath,
  sleep,
  toWhatsappJid,
  withWhatsAppPrefix,
} from "./utils.js";

describe("normalizePath", () => {
  it("adds leading slash when missing", () => {
    expect(normalizePath("foo")).toBe("/foo");
  });

  it("keeps existing slash", () => {
    expect(normalizePath("/bar")).toBe("/bar");
  });
});

describe("withWhatsAppPrefix", () => {
  it("adds whatsapp prefix", () => {
    expect(withWhatsAppPrefix("+1555")).toBe("whatsapp:+1555");
  });

  it("leaves prefixed intact", () => {
    expect(withWhatsAppPrefix("whatsapp:+1555")).toBe("whatsapp:+1555");
  });
});

describe("ensureDir", () => {
  it("creates nested directory", async () => {
    const tmp = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), "warelay-test-"),
    );
    const target = path.join(tmp, "nested", "dir");
    await ensureDir(target);
    expect(fs.existsSync(target)).toBe(true);
  });
});

describe("sleep", () => {
  it("resolves after delay using fake timers", async () => {
    vi.useFakeTimers();
    const promise = sleep(1000);
    vi.advanceTimersByTime(1000);
    await expect(promise).resolves.toBeUndefined();
    vi.useRealTimers();
  });
});

describe("assertProvider", () => {
  it("throws for invalid provider", () => {
    expect(() => assertProvider("bad" as string)).toThrow();
  });
});

describe("normalizeE164 & toWhatsappJid", () => {
  it("strips formatting and prefixes", () => {
    expect(normalizeE164("whatsapp:(555) 123-4567")).toBe("+5551234567");
    expect(toWhatsappJid("whatsapp:+555 123 4567")).toBe(
      "5551234567@s.whatsapp.net",
    );
  });
});

describe("jidToE164", () => {
  it("maps @lid using reverse mapping file", () => {
    const mappingPath = `${CONFIG_DIR}/credentials/lid-mapping-123_reverse.json`;
    const original = fs.readFileSync;
    const spy = vi
      .spyOn(fs, "readFileSync")
      // biome-ignore lint/suspicious/noExplicitAny: forwarding to native signature
      .mockImplementation((path: any, encoding?: any) => {
        if (path === mappingPath) return `"5551234"`;
        return original(path, encoding);
      });
    expect(jidToE164("123@lid")).toBe("+5551234");
    spy.mockRestore();
  });
});

describe("normalizeAllowFromEntry", () => {
  describe("telegram provider", () => {
    it("adds @ prefix when missing", () => {
      expect(normalizeAllowFromEntry("testuser", "telegram")).toBe("@testuser");
    });

    it("keeps @ prefix when present", () => {
      expect(normalizeAllowFromEntry("@testuser", "telegram")).toBe(
        "@testuser",
      );
    });

    it("converts to lowercase", () => {
      expect(normalizeAllowFromEntry("TestUser", "telegram")).toBe(
        "@testuser",
      );
      expect(normalizeAllowFromEntry("@TestUser", "telegram")).toBe(
        "@testuser",
      );
    });

    it("trims whitespace", () => {
      expect(normalizeAllowFromEntry("  testuser  ", "telegram")).toBe(
        "@testuser",
      );
      expect(normalizeAllowFromEntry("  @testuser  ", "telegram")).toBe(
        "@testuser",
      );
    });

    it("returns empty string for empty input", () => {
      expect(normalizeAllowFromEntry("", "telegram")).toBe("");
      expect(normalizeAllowFromEntry("   ", "telegram")).toBe("");
    });
  });

  describe("whatsapp providers", () => {
    it("normalizes phone to E.164 for wa-web", () => {
      expect(normalizeAllowFromEntry("1234567890", "wa-web")).toBe(
        "+1234567890",
      );
      expect(normalizeAllowFromEntry("+1234567890", "wa-web")).toBe(
        "+1234567890",
      );
    });

    it("normalizes phone to E.164 for wa-twilio", () => {
      expect(normalizeAllowFromEntry("1234567890", "wa-twilio")).toBe(
        "+1234567890",
      );
      expect(normalizeAllowFromEntry("+1234567890", "wa-twilio")).toBe(
        "+1234567890",
      );
    });

    it("strips whatsapp prefix and formatting", () => {
      expect(normalizeAllowFromEntry("whatsapp:+1234567890", "wa-web")).toBe(
        "+1234567890",
      );
      expect(
        normalizeAllowFromEntry("whatsapp:(555) 123-4567", "wa-twilio"),
      ).toBe("+5551234567");
    });

    it("handles phone numbers with spaces and dashes", () => {
      expect(normalizeAllowFromEntry("+1 555 123 4567", "wa-web")).toBe(
        "+15551234567",
      );
      expect(normalizeAllowFromEntry("555-123-4567", "wa-twilio")).toBe(
        "+5551234567",
      );
    });
  });
});
