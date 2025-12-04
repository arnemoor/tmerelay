import { beforeEach, describe, expect, it, vi } from "vitest";

import { ensureTwilioEnv, readEnv } from "./env.js";
import type { RuntimeEnv } from "./runtime.js";

const baseEnv = {
  TWILIO_ACCOUNT_SID: "AC123",
  TWILIO_WHATSAPP_FROM: "whatsapp:+1555",
};

describe("env helpers", () => {
  const runtime: RuntimeEnv = {
    log: vi.fn(),
    error: vi.fn(),
    exit: vi.fn(() => {
      throw new Error("exit");
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {};
  });

  function setEnv(vars: Record<string, string | undefined>) {
    process.env = {};
    for (const [k, v] of Object.entries(vars)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }

  it("reads env with auth token", () => {
    setEnv({
      ...baseEnv,
      TWILIO_AUTH_TOKEN: "token",
      TWILIO_API_KEY: undefined,
      TWILIO_API_SECRET: undefined,
    });
    const cfg = readEnv(runtime);
    expect(cfg.accountSid).toBe("AC123");
    expect(cfg.whatsappFrom).toBe("whatsapp:+1555");
    expect(cfg.auth).toBeDefined();
    if (cfg.auth && "authToken" in cfg.auth) {
      expect(cfg.auth.authToken).toBe("token");
    } else {
      throw new Error("Expected auth token");
    }
  });

  it("reads env with API key/secret", () => {
    setEnv({
      ...baseEnv,
      TWILIO_AUTH_TOKEN: undefined,
      TWILIO_API_KEY: "key",
      TWILIO_API_SECRET: "secret",
    });
    const cfg = readEnv(runtime);
    expect(cfg.auth).toBeDefined();
    if (cfg.auth && "apiKey" in cfg.auth && "apiSecret" in cfg.auth) {
      expect(cfg.auth.apiKey).toBe("key");
      expect(cfg.auth.apiSecret).toBe("secret");
    } else {
      throw new Error("Expected API key/secret");
    }
  });

  it("fails fast on invalid env", () => {
    setEnv({
      TWILIO_ACCOUNT_SID: "",
      TWILIO_WHATSAPP_FROM: "",
      TWILIO_AUTH_TOKEN: undefined,
      TWILIO_API_KEY: undefined,
      TWILIO_API_SECRET: undefined,
    });
    expect(() => readEnv(runtime)).toThrow("exit");
    expect(runtime.error).toHaveBeenCalled();
  });

  it("ensureTwilioEnv passes when token present", () => {
    setEnv({
      ...baseEnv,
      TWILIO_AUTH_TOKEN: "token",
      TWILIO_API_KEY: undefined,
      TWILIO_API_SECRET: undefined,
    });
    expect(() => ensureTwilioEnv(runtime)).not.toThrow();
  });

  it("ensureTwilioEnv fails when missing auth", () => {
    setEnv({
      ...baseEnv,
      TWILIO_AUTH_TOKEN: undefined,
      TWILIO_API_KEY: undefined,
      TWILIO_API_SECRET: undefined,
    });
    expect(() => ensureTwilioEnv(runtime)).toThrow("exit");
  });

  describe("provider-aware validation", () => {
    it("telegram provider works without Twilio credentials", () => {
      setEnv({
        TELEGRAM_API_ID: "12345",
        TELEGRAM_API_HASH: "abcdef",
        TWILIO_ACCOUNT_SID: undefined,
        TWILIO_WHATSAPP_FROM: undefined,
        TWILIO_AUTH_TOKEN: undefined,
      });
      const cfg = readEnv(runtime, "telegram");
      expect(cfg.telegram?.apiId).toBe(12345);
      expect(cfg.telegram?.apiHash).toBe("abcdef");
      // Twilio fields should be undefined
      expect(cfg.accountSid).toBeUndefined();
      expect(cfg.whatsappFrom).toBeUndefined();
      expect(cfg.auth).toBeUndefined();
    });

    it("telegram provider fails when only API_ID provided", () => {
      setEnv({
        TELEGRAM_API_ID: "12345",
        TELEGRAM_API_HASH: undefined,
      });
      expect(() => readEnv(runtime, "telegram")).toThrow("exit");
      expect(runtime.error).toHaveBeenCalled();
    });

    it("telegram provider fails when only API_HASH provided", () => {
      setEnv({
        TELEGRAM_API_ID: undefined,
        TELEGRAM_API_HASH: "abcdef",
      });
      expect(() => readEnv(runtime, "telegram")).toThrow("exit");
      expect(runtime.error).toHaveBeenCalled();
    });

    it("twilio provider works without Telegram credentials", () => {
      setEnv({
        ...baseEnv,
        TWILIO_AUTH_TOKEN: "token",
        TELEGRAM_API_ID: undefined,
        TELEGRAM_API_HASH: undefined,
      });
      const cfg = readEnv(runtime, "twilio");
      expect(cfg.accountSid).toBe("AC123");
      expect(cfg.whatsappFrom).toBe("whatsapp:+1555");
      expect(cfg.auth).toBeDefined();
      if (cfg.auth && "authToken" in cfg.auth) {
        expect(cfg.auth.authToken).toBe("token");
      }
    });

    it("twilio provider fails when Twilio credentials missing", () => {
      setEnv({
        TELEGRAM_API_ID: "12345",
        TELEGRAM_API_HASH: "abcdef",
        TWILIO_ACCOUNT_SID: undefined,
        TWILIO_WHATSAPP_FROM: undefined,
      });
      expect(() => readEnv(runtime, "twilio")).toThrow("exit");
      expect(runtime.error).toHaveBeenCalled();
    });

    it("all provider requires both Twilio and validates Telegram pairing", () => {
      setEnv({
        ...baseEnv,
        TWILIO_AUTH_TOKEN: "token",
        TELEGRAM_API_ID: "12345",
        TELEGRAM_API_HASH: "abcdef",
      });
      const cfg = readEnv(runtime, "all");
      expect(cfg.accountSid).toBe("AC123");
      expect(cfg.telegram?.apiId).toBe(12345);
    });

    it("all provider defaults when no provider specified", () => {
      setEnv({
        ...baseEnv,
        TWILIO_AUTH_TOKEN: "token",
      });
      const cfg = readEnv(runtime); // No provider param = 'all'
      expect(cfg.accountSid).toBe("AC123");
    });
  });
});
