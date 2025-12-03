/**
 * Unit tests for WhatsApp Twilio Provider
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { listRecentMessages } from "../../twilio/messages.js";
import type { TwilioProviderConfig } from "../base/index.js";
import { capabilities } from "./capabilities.js";
import { TwilioProvider } from "./provider.js";

// Mock Twilio client and modules
const mockFetch = vi.fn();
const mockMessageCreate = vi.fn();
const mockMessagesFetch = vi.fn();

vi.mock("../../twilio/client.js", () => ({
  createClient: vi.fn(() => ({
    messages: {
      create: mockMessageCreate,
      list: vi.fn(() => Promise.resolve([])),
    },
    api: {
      v2010: {
        accounts: vi.fn((accountSid: string) => ({
          fetch: mockFetch,
          accountSid,
        })),
      },
    },
  })),
}));

vi.mock("../../twilio/messages.js", () => ({
  listRecentMessages: vi.fn(() => Promise.resolve([])),
}));

describe("TwilioProvider", () => {
  let provider: TwilioProvider;
  let config: TwilioProviderConfig;

  beforeEach(() => {
    provider = new TwilioProvider();
    config = {
      kind: "wa-twilio",
      accountSid: "AC123456789",
      authToken: "test-token",
      whatsappFrom: "+15551234567",
      verbose: false,
    };

    // Reset mocks
    vi.clearAllMocks();

    // Reset listRecentMessages to default empty array
    vi.mocked(listRecentMessages).mockResolvedValue([]);

    mockMessageCreate.mockResolvedValue({
      sid: "SM123456789",
      status: "queued",
      dateUpdated: new Date(),
    });
    mockFetch.mockResolvedValue({ sid: "AC123456789" });
    mockMessagesFetch.mockResolvedValue({
      sid: "SM123456789",
      status: "delivered",
      dateUpdated: new Date(),
    });
  });

  describe("initialization", () => {
    it("should have correct kind and capabilities", () => {
      expect(provider.kind).toBe("wa-twilio");
      expect(provider.capabilities).toBe(capabilities);
    });

    it("should initialize with authToken", async () => {
      await provider.initialize(config);
      expect(provider.isConnected()).toBe(true);
    });

    it("should initialize with API key/secret", async () => {
      const apiKeyConfig: TwilioProviderConfig = {
        kind: "wa-twilio",
        accountSid: "AC123456789",
        apiKey: "SK123",
        apiSecret: "secret123",
        whatsappFrom: "+15551234567",
      };

      await provider.initialize(apiKeyConfig);
      expect(provider.isConnected()).toBe(true);
    });

    it("should reject invalid config kind", async () => {
      // biome-ignore lint/suspicious/noExplicitAny: Intentional invalid config for testing error handling
      const invalidConfig = { kind: "wa-web" } as any;
      await expect(provider.initialize(invalidConfig)).rejects.toThrow(
        "TwilioProvider expects wa-twilio config",
      );
    });

    it("should reject config without auth", async () => {
      const noAuthConfig: TwilioProviderConfig = {
        kind: "wa-twilio",
        accountSid: "AC123456789",
        whatsappFrom: "+15551234567",
      };

      await expect(provider.initialize(noAuthConfig)).rejects.toThrow(
        "Twilio provider requires either authToken or apiKey+apiSecret",
      );
    });
  });

  describe("connection management", () => {
    beforeEach(async () => {
      await provider.initialize(config);
    });

    it("should report connected when client exists", () => {
      expect(provider.isConnected()).toBe(true);
    });

    it("should disconnect cleanly", async () => {
      await provider.disconnect();
      expect(provider.isConnected()).toBe(false);
    });
  });

  describe("outbound messaging", () => {
    beforeEach(async () => {
      await provider.initialize(config);
    });

    it("should send text message successfully", async () => {
      const result = await provider.send("+15559876543", "Hello world");

      expect(result.status).toBe("sent");
      expect(result.messageId).toBe("SM123456789");
      expect(result.providerMeta?.sid).toBe("SM123456789");
      expect(result.providerMeta?.accountSid).toBe("AC123456789");

      expect(mockMessageCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "whatsapp:+15559876543",
          body: "Hello world",
          from: "whatsapp:+15551234567",
        }),
      );
    });

    it("should send message with media", async () => {
      const result = await provider.send("+15559876543", "Check this out", {
        media: [
          {
            type: "image",
            url: "https://example.com/image.jpg",
            mimeType: "image/jpeg",
          },
        ],
      });

      expect(result.status).toBe("sent");
      expect(mockMessageCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          mediaUrl: ["https://example.com/image.jpg"],
        }),
      );
    });

    it("should use messaging service SID from config", async () => {
      const msConfig: TwilioProviderConfig = {
        ...config,
        messagingServiceSid: "MG123456789",
      };

      await provider.initialize(msConfig);
      await provider.send("+15559876543", "Test");

      expect(mockMessageCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messagingServiceSid: "MG123456789",
        }),
      );
      expect(mockMessageCreate).toHaveBeenCalledWith(
        expect.not.objectContaining({
          from: expect.anything(),
        }),
      );
    });

    it("should use messaging service SID from send options", async () => {
      await provider.send("+15559876543", "Test", {
        providerOptions: {
          twilioMessagingServiceSid: "MG987654321",
        },
      });

      expect(mockMessageCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messagingServiceSid: "MG987654321",
        }),
      );
    });

    it("should handle send errors gracefully", async () => {
      mockMessageCreate.mockRejectedValueOnce(new Error("Network error"));

      const result = await provider.send("+15559876543", "Test");

      expect(result.status).toBe("failed");
      expect(result.error).toBe("Network error");
      expect(result.messageId).toBe("");
    });

    it("should throw if not initialized", async () => {
      const uninitProvider = new TwilioProvider();
      await expect(uninitProvider.send("+123", "test")).rejects.toThrow(
        "Provider not initialized",
      );
    });
  });

  describe("typing indicators", () => {
    beforeEach(async () => {
      await provider.initialize(config);
    });

    it("should be a no-op (Twilio does not support typing)", async () => {
      // Should not throw and should resolve immediately
      await expect(provider.sendTyping("+15559876543")).resolves.not.toThrow();
    });
  });

  describe("delivery status", () => {
    beforeEach(async () => {
      await provider.initialize(config);
    });

    it("should fetch and normalize delivered status", async () => {
      const mockClient = {
        messages: vi.fn((sid: string) => ({
          fetch: vi.fn(() =>
            Promise.resolve({
              sid,
              status: "delivered",
              dateUpdated: new Date("2025-01-01T12:00:00Z"),
            }),
          ),
        })),
      };
      // biome-ignore lint/suspicious/noExplicitAny: Accessing private member for testing
      (provider as any).client = mockClient;

      const status = await provider.getDeliveryStatus("SM123456789");

      expect(status.messageId).toBe("SM123456789");
      expect(status.status).toBe("delivered");
      expect(status.timestamp).toBe(new Date("2025-01-01T12:00:00Z").getTime());
      expect(status.providerStatusCode).toBe("delivered");
    });

    it("should normalize read status", async () => {
      const mockClient = {
        messages: vi.fn((sid: string) => ({
          fetch: vi.fn(() =>
            Promise.resolve({
              sid,
              status: "read",
              dateUpdated: new Date("2025-01-01T12:00:00Z"),
            }),
          ),
        })),
      };
      // biome-ignore lint/suspicious/noExplicitAny: Accessing private member for testing
      (provider as any).client = mockClient;

      const status = await provider.getDeliveryStatus("SM123456789");

      expect(status.status).toBe("read");
    });

    it("should normalize failed status", async () => {
      const mockClient = {
        messages: vi.fn((sid: string) => ({
          fetch: vi.fn(() =>
            Promise.resolve({
              sid,
              status: "failed",
              errorCode: 30008,
              errorMessage: "Unknown destination",
              dateUpdated: new Date("2025-01-01T12:00:00Z"),
            }),
          ),
        })),
      };
      // biome-ignore lint/suspicious/noExplicitAny: Accessing private member for testing
      (provider as any).client = mockClient;

      const status = await provider.getDeliveryStatus("SM123456789");

      expect(status.status).toBe("failed");
      expect(status.error).toBe("30008: Unknown destination");
    });

    it("should normalize queued/sending to sent", async () => {
      const mockClient = {
        messages: vi.fn((sid: string) => ({
          fetch: vi.fn(() =>
            Promise.resolve({
              sid,
              status: "queued",
              dateUpdated: new Date("2025-01-01T12:00:00Z"),
            }),
          ),
        })),
      };
      // biome-ignore lint/suspicious/noExplicitAny: Accessing private member for testing
      (provider as any).client = mockClient;

      const status = await provider.getDeliveryStatus("SM123456789");

      expect(status.status).toBe("sent");
    });

    it("should handle fetch errors", async () => {
      const mockClient = {
        messages: vi.fn(() => ({
          fetch: vi.fn(() => Promise.reject(new Error("API error"))),
        })),
      };
      // biome-ignore lint/suspicious/noExplicitAny: Accessing private member for testing
      (provider as any).client = mockClient;

      const status = await provider.getDeliveryStatus("SM123456789");

      expect(status.status).toBe("unknown");
      expect(status.error).toBe("API error");
    });
  });

  describe("inbound messaging", () => {
    beforeEach(async () => {
      await provider.initialize(config);
    });

    it("should register message handler", () => {
      const handler = vi.fn();
      provider.onMessage(handler);
      // biome-ignore lint/suspicious/noExplicitAny: Accessing private member for testing
      expect((provider as any).messageHandler).toBe(handler);
    });

    it("should start listening with handler", async () => {
      vi.mocked(listRecentMessages).mockResolvedValue([]);

      const handler = vi.fn();
      provider.onMessage(handler);

      await provider.startListening();
      // biome-ignore lint/suspicious/noExplicitAny: Accessing private member for testing
      expect((provider as any).listening).toBe(true);
    });

    it("should throw if starting without handler", async () => {
      await expect(provider.startListening()).rejects.toThrow(
        "Message handler not set",
      );
    });

    it("should throw if already listening", async () => {
      vi.mocked(listRecentMessages).mockResolvedValue([]);

      const handler = vi.fn();
      provider.onMessage(handler);
      await provider.startListening();

      await expect(provider.startListening()).rejects.toThrow(
        "Already listening",
      );
    });

    it("should stop listening", async () => {
      vi.mocked(listRecentMessages).mockResolvedValue([]);

      const handler = vi.fn();
      provider.onMessage(handler);
      await provider.startListening();
      await provider.stopListening();

      // biome-ignore lint/suspicious/noExplicitAny: Accessing private member for testing
      expect((provider as any).listening).toBe(false);
    });

    it("should call listRecentMessages during polling", async () => {
      vi.mocked(listRecentMessages).mockResolvedValue([]);

      const handler = vi.fn();
      provider.onMessage(handler);

      // Start listening triggers the initial poll
      await provider.startListening();

      // Verify that listRecentMessages was called
      expect(vi.mocked(listRecentMessages)).toHaveBeenCalled();
    });

    it("should handle polling errors gracefully", async () => {
      vi.mocked(listRecentMessages).mockRejectedValueOnce(
        new Error("API error"),
      );

      const handler = vi.fn();
      provider.onMessage(handler);

      // Should not throw
      await expect(provider.startListening()).resolves.not.toThrow();
    });
  });

  describe("authentication", () => {
    beforeEach(async () => {
      await provider.initialize(config);
    });

    it("should check authentication status", async () => {
      mockFetch.mockResolvedValueOnce({ sid: "AC123456789" });
      const isAuth = await provider.isAuthenticated();
      expect(isAuth).toBe(true);
    });

    it("should return false on auth failure", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Invalid credentials"));
      const isAuth = await provider.isAuthenticated();
      expect(isAuth).toBe(false);
    });

    it("should validate credentials on login", async () => {
      mockFetch.mockResolvedValueOnce({ sid: "AC123456789" });
      await expect(provider.login()).resolves.not.toThrow();
    });

    it("should throw on invalid credentials", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Invalid credentials"));
      await expect(provider.login()).rejects.toThrow(
        "Invalid Twilio credentials",
      );
    });

    it("should clear client on logout", async () => {
      await provider.logout();
      expect(provider.isConnected()).toBe(false);
    });

    it("should get session ID (whatsapp from number)", async () => {
      const sessionId = await provider.getSessionId();
      expect(sessionId).toBe("+15551234567");
    });

    it("should return null when not initialized", async () => {
      const uninitProvider = new TwilioProvider();
      const sessionId = await uninitProvider.getSessionId();
      expect(sessionId).toBeNull();
    });
  });

  describe("capabilities", () => {
    it("should have correct capabilities", () => {
      expect(capabilities.supportsDeliveryReceipts).toBe(true);
      expect(capabilities.supportsReadReceipts).toBe(false);
      expect(capabilities.supportsTypingIndicator).toBe(false);
      expect(capabilities.supportsReactions).toBe(false);
      expect(capabilities.supportsReplies).toBe(false);
      expect(capabilities.supportsEditing).toBe(false);
      expect(capabilities.supportsDeleting).toBe(false);
      expect(capabilities.maxMediaSize).toBe(5 * 1024 * 1024);
      expect(capabilities.supportedMediaTypes).toContain("image/jpeg");
      expect(capabilities.supportedMediaTypes).toContain("video/mp4");
      expect(capabilities.supportedMediaTypes).toContain("audio/ogg");
      expect(capabilities.canInitiateConversation).toBe(true);
    });
  });
});
