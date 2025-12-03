/**
 * Unit tests for WhatsApp Web Provider
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WebProviderConfig } from "../base/index.js";
import { capabilities } from "./capabilities.js";
import { WebProvider } from "./provider.js";

// Mock the web modules
vi.mock("../../web/session.js", () => ({
  createWaSocket: vi.fn(() => ({
    user: { id: "1234567890@s.whatsapp.net" },
    ws: { close: vi.fn() },
    sendPresenceUpdate: vi.fn(),
  })),
  loginWeb: vi.fn(),
  logoutWeb: vi.fn(),
  waitForWaConnection: vi.fn(),
  webAuthExists: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("../../web/outbound.js", () => ({
  sendMessageWeb: vi.fn(() =>
    Promise.resolve({
      messageId: "test-msg-id",
      toJid: "1234567890@s.whatsapp.net",
    }),
  ),
}));

vi.mock("../../web/inbound.js", () => ({
  monitorWebInbox: vi.fn(({ onMessage }) => {
    // Store the handler for testing
    // biome-ignore lint/suspicious/noExplicitAny: Test helper for accessing global test state
    (globalThis as any).__testMessageHandler = onMessage;
    return Promise.resolve({
      close: vi.fn(),
      onClose: Promise.resolve({ status: 200, isLoggedOut: false }),
    });
  }),
}));

describe("WebProvider", () => {
  let provider: WebProvider;
  let config: WebProviderConfig;

  beforeEach(() => {
    provider = new WebProvider();
    config = {
      kind: "wa-web",
      verbose: false,
    };
  });

  describe("initialization", () => {
    it("should have correct kind and capabilities", () => {
      expect(provider.kind).toBe("wa-web");
      expect(provider.capabilities).toBe(capabilities);
    });

    it("should initialize with valid config", async () => {
      await provider.initialize(config);
      expect(provider.isConnected()).toBe(true); // Has user object
    });

    it("should reject invalid config kind", async () => {
      // biome-ignore lint/suspicious/noExplicitAny: Intentional invalid config for testing error handling
      const invalidConfig = { kind: "wa-twilio" } as any;
      await expect(provider.initialize(invalidConfig)).rejects.toThrow(
        "WebProvider expects wa-web config",
      );
    });
  });

  describe("connection management", () => {
    beforeEach(async () => {
      await provider.initialize(config);
    });

    it("should report connected when socket has user", () => {
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
      const result = await provider.send("+1234567890", "Hello world");

      expect(result.status).toBe("sent");
      expect(result.messageId).toBe("test-msg-id");
      expect(result.providerMeta?.jid).toBe("1234567890@s.whatsapp.net");
    });

    it("should send message with media", async () => {
      const result = await provider.send("+1234567890", "Check this out", {
        media: [
          {
            type: "image",
            url: "https://example.com/image.jpg",
            mimeType: "image/jpeg",
          },
        ],
      });

      expect(result.status).toBe("sent");
      expect(result.messageId).toBe("test-msg-id");
    });

    it("should handle send errors gracefully", async () => {
      const { sendMessageWeb } = await import("../../web/outbound.js");
      vi.mocked(sendMessageWeb).mockRejectedValueOnce(
        new Error("Network error"),
      );

      const result = await provider.send("+1234567890", "Test");

      expect(result.status).toBe("failed");
      expect(result.error).toBe("Network error");
      expect(result.messageId).toBe("");
    });

    it("should throw if not initialized", async () => {
      const uninitProvider = new WebProvider();
      await expect(uninitProvider.send("+123", "test")).rejects.toThrow(
        "Provider not initialized",
      );
    });
  });

  describe("typing indicators", () => {
    beforeEach(async () => {
      await provider.initialize(config);
    });

    it("should send typing indicator", async () => {
      await expect(provider.sendTyping("+1234567890")).resolves.not.toThrow();
    });

    it("should handle typing errors gracefully", async () => {
      // biome-ignore lint/suspicious/noExplicitAny: Accessing private member for testing
      const socket = (provider as any).socket;
      socket.sendPresenceUpdate = vi
        .fn()
        .mockRejectedValue(new Error("Failed"));

      // Should not throw
      await expect(provider.sendTyping("+1234567890")).resolves.not.toThrow();
    });
  });

  describe("delivery status", () => {
    beforeEach(async () => {
      await provider.initialize(config);
    });

    it("should return unknown status (not tracked)", async () => {
      const status = await provider.getDeliveryStatus("msg-123");

      expect(status.messageId).toBe("msg-123");
      expect(status.status).toBe("unknown");
      expect(status.timestamp).toBeGreaterThan(0);
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
      const handler = vi.fn();
      provider.onMessage(handler);
      await provider.startListening();

      await expect(provider.startListening()).rejects.toThrow(
        "Already listening",
      );
    });

    it("should stop listening", async () => {
      const handler = vi.fn();
      provider.onMessage(handler);
      await provider.startListening();
      await provider.stopListening();

      // biome-ignore lint/suspicious/noExplicitAny: Accessing private member for testing
      expect((provider as any).listening).toBe(false);
    });

    it("should convert WebInboundMessage to ProviderMessage", async () => {
      const handler = vi.fn();
      provider.onMessage(handler);
      await provider.startListening();

      // Simulate inbound message
      const webMessage = {
        id: "msg-123",
        from: "+1234567890",
        conversationId: "+1234567890",
        to: "+9876543210",
        body: "Hello!",
        pushName: "John Doe",
        timestamp: 1234567890000,
        chatType: "direct" as const,
        chatId: "1234567890@s.whatsapp.net",
        sendComposing: vi.fn(),
        reply: vi.fn(),
        sendMedia: vi.fn(),
      };

      // Trigger the handler
      // biome-ignore lint/suspicious/noExplicitAny: Test helper for accessing global test state
      const testHandler = (globalThis as any).__testMessageHandler;
      await testHandler(webMessage);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "msg-123",
          from: "+1234567890",
          to: "+9876543210",
          body: "Hello!",
          timestamp: 1234567890000,
          displayName: "John Doe",
          provider: "wa-web",
        }),
      );
    });

    it("should convert message with media", async () => {
      const handler = vi.fn();
      provider.onMessage(handler);
      await provider.startListening();

      const webMessage = {
        id: "msg-456",
        from: "+1234567890",
        conversationId: "+1234567890",
        to: "+9876543210",
        body: "<media:image>",
        timestamp: 1234567890000,
        chatType: "direct" as const,
        chatId: "1234567890@s.whatsapp.net",
        mediaPath: "/tmp/image.jpg",
        mediaType: "image/jpeg",
        mediaUrl: "https://example.com/image.jpg",
        sendComposing: vi.fn(),
        reply: vi.fn(),
        sendMedia: vi.fn(),
      };

      // biome-ignore lint/suspicious/noExplicitAny: Test helper for accessing global test state
      const testHandler = (globalThis as any).__testMessageHandler;
      await testHandler(webMessage);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          body: "<media:image>",
          media: [
            {
              type: "image",
              url: "https://example.com/image.jpg",
              mimeType: "image/jpeg",
            },
          ],
        }),
      );
    });
  });

  describe("authentication", () => {
    beforeEach(async () => {
      await provider.initialize(config);
    });

    it("should check authentication status", async () => {
      const isAuth = await provider.isAuthenticated();
      expect(isAuth).toBe(true);
    });

    it("should handle login", async () => {
      await expect(provider.login()).resolves.not.toThrow();
    });

    it("should handle logout", async () => {
      await expect(provider.logout()).resolves.not.toThrow();
    });

    it("should get session ID from socket", async () => {
      const sessionId = await provider.getSessionId();
      // jidToE164 will convert "1234567890@s.whatsapp.net" to "+1234567890"
      expect(sessionId).toBeTruthy();
    });

    it("should return null when no socket user", async () => {
      // biome-ignore lint/suspicious/noExplicitAny: Accessing private member for testing
      (provider as any).socket = { user: null };
      const sessionId = await provider.getSessionId();
      expect(sessionId).toBeNull();
    });
  });

  describe("media type inference", () => {
    beforeEach(async () => {
      await provider.initialize(config);
    });

    it("should infer image type", () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing private method
      const type = (provider as any).inferMediaType("image/jpeg");
      expect(type).toBe("image");
    });

    it("should infer video type", () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing private method
      const type = (provider as any).inferMediaType("video/mp4");
      expect(type).toBe("video");
    });

    it("should infer voice type for ogg", () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing private method
      const type = (provider as any).inferMediaType("audio/ogg; codecs=opus");
      expect(type).toBe("voice");
    });

    it("should infer audio type for non-ogg audio", () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing private method
      const type = (provider as any).inferMediaType("audio/mpeg");
      expect(type).toBe("audio");
    });

    it("should default to document for unknown types", () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing private method
      const type = (provider as any).inferMediaType("application/pdf");
      expect(type).toBe("document");
    });

    it("should default to document when no mime type", () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing private method
      const type = (provider as any).inferMediaType(undefined);
      expect(type).toBe("document");
    });
  });

  describe("capabilities", () => {
    it("should have correct capabilities", () => {
      expect(capabilities.supportsDeliveryReceipts).toBe(true);
      expect(capabilities.supportsReadReceipts).toBe(true);
      expect(capabilities.supportsTypingIndicator).toBe(true);
      expect(capabilities.supportsReactions).toBe(false);
      expect(capabilities.supportsReplies).toBe(true);
      expect(capabilities.supportsEditing).toBe(false);
      expect(capabilities.supportsDeleting).toBe(true);
      expect(capabilities.maxMediaSize).toBe(64 * 1024 * 1024);
      expect(capabilities.supportedMediaTypes).toContain("image/jpeg");
      expect(capabilities.supportedMediaTypes).toContain("video/mp4");
      expect(capabilities.supportedMediaTypes).toContain("audio/ogg");
      expect(capabilities.canInitiateConversation).toBe(true);
    });
  });
});
