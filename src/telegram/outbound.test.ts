/**
 * Outbound Tests
 */

import type { TelegramClient } from "telegram";
import { Api } from "telegram";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderMedia, SendOptions } from "../providers/base/types.js";
import {
  sendMediaMessage,
  sendTextMessage,
  sendTypingIndicator,
} from "./outbound.js";
import * as utilsModule from "./utils.js";

// Mock utils
vi.mock("./utils.js");

// Mock global fetch
global.fetch = vi.fn();

describe("outbound", () => {
  let mockClient: Partial<TelegramClient>;
  let mockEntity: Api.User;

  beforeEach(() => {
    mockEntity = new Api.User({
      id: BigInt(12345),
      firstName: "Test",
    });

    mockClient = {
      sendMessage: vi.fn(),
      sendFile: vi.fn(),
      invoke: vi.fn(),
    };

    vi.mocked(utilsModule.resolveEntity).mockResolvedValue(mockEntity);
    vi.mocked(utilsModule.extractUserId).mockReturnValue("12345");

    vi.clearAllMocks();
  });

  describe("sendTextMessage", () => {
    it("sends text message with username", async () => {
      const mockResult = {
        id: 999,
        message: "test message",
      };

      vi.mocked(mockClient.sendMessage).mockResolvedValue(mockResult as any);

      const result = await sendTextMessage(
        mockClient as TelegramClient,
        "@testuser",
        "test message",
      );

      expect(utilsModule.resolveEntity).toHaveBeenCalledWith(
        mockClient,
        "@testuser",
      );
      expect(mockClient.sendMessage).toHaveBeenCalledWith(mockEntity, {
        message: "test message",
        replyTo: undefined,
      });
      expect(result).toEqual({
        messageId: "999",
        status: "sent",
        providerMeta: {
          userId: "12345",
        },
      });
    });

    it("sends text message with phone number", async () => {
      const mockResult = {
        id: 999,
        message: "test message",
      };

      vi.mocked(mockClient.sendMessage).mockResolvedValue(mockResult as any);

      const result = await sendTextMessage(
        mockClient as TelegramClient,
        "+1234567890",
        "test message",
      );

      expect(utilsModule.resolveEntity).toHaveBeenCalledWith(
        mockClient,
        "+1234567890",
      );
      expect(result.messageId).toBe("999");
    });

    it("sends text message with replyTo option", async () => {
      const mockResult = {
        id: 999,
        message: "test message",
      };

      vi.mocked(mockClient.sendMessage).mockResolvedValue(mockResult as any);

      const options: SendOptions = {
        replyTo: "123",
      };

      await sendTextMessage(
        mockClient as TelegramClient,
        "@testuser",
        "test message",
        options,
      );

      expect(mockClient.sendMessage).toHaveBeenCalledWith(mockEntity, {
        message: "test message",
        replyTo: 123,
      });
    });

    it("sends text message without options", async () => {
      const mockResult = {
        id: 999,
        message: "test message",
      };

      vi.mocked(mockClient.sendMessage).mockResolvedValue(mockResult as any);

      await sendTextMessage(
        mockClient as TelegramClient,
        "@testuser",
        "test message",
      );

      expect(mockClient.sendMessage).toHaveBeenCalledWith(mockEntity, {
        message: "test message",
        replyTo: undefined,
      });
    });
  });

  describe("sendMediaMessage", () => {
    it("sends image from buffer", async () => {
      const mockResult = {
        id: 999,
      };

      vi.mocked(mockClient.sendFile).mockResolvedValue(mockResult as any);

      const media: ProviderMedia = {
        type: "image",
        buffer: Buffer.from("fake-image-data"),
        mimeType: "image/jpeg",
      };

      const result = await sendMediaMessage(
        mockClient as TelegramClient,
        "@testuser",
        "Check this out!",
        media,
      );

      expect(mockClient.sendFile).toHaveBeenCalledWith(mockEntity, {
        file: media.buffer,
        caption: "Check this out!",
        replyTo: undefined,
      });
      expect(result).toEqual({
        messageId: "999",
        status: "sent",
        providerMeta: {
          userId: "12345",
        },
      });
    });

    it("sends video with attributes", async () => {
      const mockResult = {
        id: 999,
      };

      vi.mocked(mockClient.sendFile).mockResolvedValue(mockResult as any);

      const media: ProviderMedia = {
        type: "video",
        buffer: Buffer.from("fake-video-data"),
        mimeType: "video/mp4",
      };

      await sendMediaMessage(
        mockClient as TelegramClient,
        "@testuser",
        "Watch this",
        media,
      );

      expect(mockClient.sendFile).toHaveBeenCalledWith(
        mockEntity,
        expect.objectContaining({
          file: media.buffer,
          caption: "Watch this",
          attributes: expect.arrayContaining([
            expect.any(Api.DocumentAttributeVideo),
          ]),
        }),
      );
    });

    it("sends audio file", async () => {
      const mockResult = {
        id: 999,
      };

      vi.mocked(mockClient.sendFile).mockResolvedValue(mockResult as any);

      const media: ProviderMedia = {
        type: "audio",
        buffer: Buffer.from("fake-audio-data"),
        mimeType: "audio/mp3",
      };

      await sendMediaMessage(
        mockClient as TelegramClient,
        "@testuser",
        "Listen to this",
        media,
      );

      expect(mockClient.sendFile).toHaveBeenCalledWith(mockEntity, {
        file: media.buffer,
        caption: "Listen to this",
        replyTo: undefined,
        voiceNote: false,
      });
    });

    it("sends voice note with voiceNote flag", async () => {
      const mockResult = {
        id: 999,
      };

      vi.mocked(mockClient.sendFile).mockResolvedValue(mockResult as any);

      const media: ProviderMedia = {
        type: "voice",
        buffer: Buffer.from("fake-voice-data"),
        mimeType: "audio/ogg",
      };

      await sendMediaMessage(
        mockClient as TelegramClient,
        "@testuser",
        "",
        media,
      );

      expect(mockClient.sendFile).toHaveBeenCalledWith(mockEntity, {
        file: media.buffer,
        caption: undefined,
        replyTo: undefined,
        voiceNote: true,
      });
    });

    it("sends document with fileName attribute", async () => {
      const mockResult = {
        id: 999,
      };

      vi.mocked(mockClient.sendFile).mockResolvedValue(mockResult as any);

      const media: ProviderMedia = {
        type: "document",
        buffer: Buffer.from("fake-doc-data"),
        fileName: "report.pdf",
        mimeType: "application/pdf",
      };

      await sendMediaMessage(
        mockClient as TelegramClient,
        "@testuser",
        "Here's the report",
        media,
      );

      expect(mockClient.sendFile).toHaveBeenCalledWith(
        mockEntity,
        expect.objectContaining({
          file: media.buffer,
          caption: "Here's the report",
          attributes: expect.arrayContaining([
            expect.any(Api.DocumentAttributeFilename),
          ]),
        }),
      );
    });

    it("sends document without fileName attribute", async () => {
      const mockResult = {
        id: 999,
      };

      vi.mocked(mockClient.sendFile).mockResolvedValue(mockResult as any);

      const media: ProviderMedia = {
        type: "document",
        buffer: Buffer.from("fake-doc-data"),
        mimeType: "application/pdf",
      };

      await sendMediaMessage(
        mockClient as TelegramClient,
        "@testuser",
        "Here's a file",
        media,
      );

      expect(mockClient.sendFile).toHaveBeenCalledWith(mockEntity, {
        file: media.buffer,
        caption: "Here's a file",
        replyTo: undefined,
        attributes: undefined,
      });
    });

    it("downloads and sends media from URL", async () => {
      const mockResult = {
        id: 999,
      };

      const mockImageData = new Uint8Array([1, 2, 3, 4]);

      // Mock HEAD request for size check
      const mockHeadResponse = {
        headers: {
          get: vi.fn((name: string) => {
            if (name === "content-length") return "1024";
            return null;
          }),
        },
      };

      // Mock GET request for actual download
      const mockGetResponse = {
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(mockImageData.buffer),
      };

      vi.mocked(global.fetch)
        .mockResolvedValueOnce(mockHeadResponse as any) // HEAD request
        .mockResolvedValueOnce(mockGetResponse as any); // GET request

      vi.mocked(mockClient.sendFile).mockResolvedValue(mockResult as any);

      const media: ProviderMedia = {
        type: "image",
        url: "https://example.com/image.jpg",
        mimeType: "image/jpeg",
      };

      await sendMediaMessage(
        mockClient as TelegramClient,
        "@testuser",
        "Look at this",
        media,
      );

      expect(global.fetch).toHaveBeenCalledWith(
        "https://example.com/image.jpg",
        { method: "HEAD" },
      );
      expect(global.fetch).toHaveBeenCalledWith(
        "https://example.com/image.jpg",
      );
      expect(mockClient.sendFile).toHaveBeenCalledWith(
        mockEntity,
        expect.objectContaining({
          file: expect.any(Buffer),
          caption: "Look at this",
        }),
      );
    });

    it("throws error when URL download fails", async () => {
      // Mock HEAD request success
      const mockHeadResponse = {
        headers: {
          get: vi.fn((name: string) => {
            if (name === "content-length") return "1024";
            return null;
          }),
        },
      };

      // Mock GET request failure
      const mockGetResponse = {
        ok: false,
        statusText: "Not Found",
      };

      vi.mocked(global.fetch)
        .mockResolvedValueOnce(mockHeadResponse as any)
        .mockResolvedValueOnce(mockGetResponse as any);

      const media: ProviderMedia = {
        type: "image",
        url: "https://example.com/missing.jpg",
      };

      await expect(
        sendMediaMessage(mockClient as TelegramClient, "@testuser", "", media),
      ).rejects.toThrow(
        "Failed to download media from https://example.com/missing.jpg: Not Found",
      );
    });

    it("throws error when media has neither buffer nor URL", async () => {
      const media: ProviderMedia = {
        type: "image",
        mimeType: "image/jpeg",
      };

      await expect(
        sendMediaMessage(mockClient as TelegramClient, "@testuser", "", media),
      ).rejects.toThrow("Media must have either buffer or url");
    });

    it("sends media with replyTo option", async () => {
      const mockResult = {
        id: 999,
      };

      vi.mocked(mockClient.sendFile).mockResolvedValue(mockResult as any);

      const media: ProviderMedia = {
        type: "image",
        buffer: Buffer.from("fake-image-data"),
      };

      const options: SendOptions = {
        replyTo: "123",
      };

      await sendMediaMessage(
        mockClient as TelegramClient,
        "@testuser",
        "Reply with image",
        media,
        options,
      );

      expect(mockClient.sendFile).toHaveBeenCalledWith(mockEntity, {
        file: media.buffer,
        caption: "Reply with image",
        replyTo: 123,
      });
    });

    it("uses empty body as undefined caption", async () => {
      const mockResult = {
        id: 999,
      };

      vi.mocked(mockClient.sendFile).mockResolvedValue(mockResult as any);

      const media: ProviderMedia = {
        type: "image",
        buffer: Buffer.from("fake-image-data"),
      };

      await sendMediaMessage(
        mockClient as TelegramClient,
        "@testuser",
        "",
        media,
      );

      expect(mockClient.sendFile).toHaveBeenCalledWith(
        mockEntity,
        expect.objectContaining({
          caption: undefined,
        }),
      );
    });
  });

  describe("sendTypingIndicator", () => {
    it("sends typing indicator to user", async () => {
      vi.mocked(mockClient.invoke).mockResolvedValue(undefined as any);

      await sendTypingIndicator(mockClient as TelegramClient, "@testuser");

      expect(utilsModule.resolveEntity).toHaveBeenCalledWith(
        mockClient,
        "@testuser",
      );
      expect(mockClient.invoke).toHaveBeenCalledWith(
        expect.any(Api.messages.SetTyping),
      );
    });

    it("sends typing indicator with phone number", async () => {
      vi.mocked(mockClient.invoke).mockResolvedValue(undefined as any);

      await sendTypingIndicator(mockClient as TelegramClient, "+1234567890");

      expect(utilsModule.resolveEntity).toHaveBeenCalledWith(
        mockClient,
        "+1234567890",
      );
    });

    it("uses SendMessageTypingAction", async () => {
      vi.mocked(mockClient.invoke).mockResolvedValue(undefined as any);

      await sendTypingIndicator(mockClient as TelegramClient, "@testuser");

      const callArgs = vi.mocked(mockClient.invoke).mock.calls[0][0];
      expect(callArgs).toBeInstanceOf(Api.messages.SetTyping);
      expect(callArgs.peer).toBe(mockEntity);
      expect(callArgs.action).toBeInstanceOf(Api.SendMessageTypingAction);
    });
  });
});
