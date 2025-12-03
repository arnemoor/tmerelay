/**
 * Provider Factory Tests
 */

import { describe, expect, it, vi } from "vitest";
import { TelegramProvider } from "../telegram/index.js";
import type { TwilioProviderConfig, WebProviderConfig } from "./base/index.js";
import { createInitializedProvider, createProvider } from "./factory.js";
import { TwilioProvider } from "./wa-twilio/index.js";
import { WebProvider } from "./wa-web/index.js";

describe("createProvider", () => {
  it("creates wa-web provider", () => {
    const provider = createProvider("wa-web");
    expect(provider).toBeInstanceOf(WebProvider);
    expect(provider.kind).toBe("wa-web");
  });

  it("creates wa-twilio provider", () => {
    const provider = createProvider("wa-twilio");
    expect(provider).toBeInstanceOf(TwilioProvider);
    expect(provider.kind).toBe("wa-twilio");
  });

  it("creates telegram provider", () => {
    const provider = createProvider("telegram");
    expect(provider).toBeInstanceOf(TelegramProvider);
    expect(provider.kind).toBe("telegram");
  });

  it("throws error for unknown provider kind", () => {
    expect(() => createProvider("unknown" as any)).toThrow(
      "Unknown provider kind: unknown",
    );
  });
});

describe("createInitializedProvider", () => {
  it("creates and initializes wa-web provider", async () => {
    const config: WebProviderConfig = {
      kind: "wa-web",
      verbose: false,
      printQr: false,
    };

    // Mock the initialize method to avoid actual socket creation
    const initializeSpy = vi.spyOn(WebProvider.prototype, "initialize");
    initializeSpy.mockResolvedValue(undefined);

    const provider = await createInitializedProvider("wa-web", config);

    expect(provider).toBeInstanceOf(WebProvider);
    expect(initializeSpy).toHaveBeenCalledWith(config);

    initializeSpy.mockRestore();
  });

  it("creates and initializes wa-twilio provider", async () => {
    const config: TwilioProviderConfig = {
      kind: "wa-twilio",
      accountSid: "ACtest123",
      authToken: "token123",
      whatsappFrom: "+1234567890",
      verbose: false,
    };

    // Mock the initialize method to avoid actual Twilio client creation
    const initializeSpy = vi.spyOn(TwilioProvider.prototype, "initialize");
    initializeSpy.mockResolvedValue(undefined);

    const provider = await createInitializedProvider("wa-twilio", config);

    expect(provider).toBeInstanceOf(TwilioProvider);
    expect(initializeSpy).toHaveBeenCalledWith(config);

    initializeSpy.mockRestore();
  });

  it("throws error if initialization fails", async () => {
    const config: WebProviderConfig = {
      kind: "wa-web",
      verbose: false,
    };

    // Mock initialize to throw an error
    const initializeSpy = vi.spyOn(WebProvider.prototype, "initialize");
    initializeSpy.mockRejectedValue(new Error("Init failed"));

    await expect(createInitializedProvider("wa-web", config)).rejects.toThrow(
      "Init failed",
    );

    initializeSpy.mockRestore();
  });

  it("creates and initializes telegram provider", async () => {
    const config = {
      kind: "telegram" as const,
      apiId: 12345,
      apiHash: "hash",
      verbose: false,
    };

    // Mock the initialize method to avoid actual client creation
    const initializeSpy = vi.spyOn(TelegramProvider.prototype, "initialize");
    initializeSpy.mockResolvedValue(undefined);

    const provider = await createInitializedProvider("telegram", config);

    expect(provider).toBeInstanceOf(TelegramProvider);
    expect(initializeSpy).toHaveBeenCalledWith(config);

    initializeSpy.mockRestore();
  });
});
