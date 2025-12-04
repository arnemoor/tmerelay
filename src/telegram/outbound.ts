import type { TelegramClient } from "telegram";
import { Api } from "telegram";
import type {
  ProviderMedia,
  SendOptions,
  SendResult,
} from "../providers/base/types.js";
import { extractUserId, resolveEntity } from "./utils.js";

/**
 * Send a text message via Telegram.
 */
export async function sendTextMessage(
  client: TelegramClient,
  to: string,
  body: string,
  options?: SendOptions,
): Promise<SendResult> {
  const entity = await resolveEntity(client, to);

  const result = await client.sendMessage(entity, {
    message: body,
    replyTo: options?.replyTo ? Number(options.replyTo) : undefined,
  });

  return {
    messageId: result.id.toString(),
    status: "sent",
    providerMeta: {
      userId: extractUserId(entity),
    },
  };
}

/**
 * Send a message with media attachment via Telegram.
 */
export async function sendMediaMessage(
  client: TelegramClient,
  to: string,
  body: string,
  media: ProviderMedia,
  options?: SendOptions,
): Promise<SendResult> {
  const entity = await resolveEntity(client, to);

  // Determine file source
  let file: Buffer | string;
  if (media.buffer) {
    file = media.buffer;
  } else if (media.url) {
    // Check content length before downloading to prevent OOM
    const headResponse = await fetch(media.url, { method: "HEAD" });
    const contentLength = headResponse.headers.get("content-length");
    if (contentLength) {
      const sizeBytes = Number.parseInt(contentLength, 10);
      const maxSize = 2 * 1024 * 1024 * 1024; // 2GB
      if (sizeBytes > maxSize) {
        throw new Error(
          `Media size ${(sizeBytes / 1024 / 1024).toFixed(1)}MB exceeds maximum ${maxSize / 1024 / 1024}MB. ` +
            "Large files require streaming support (not yet implemented).",
        );
      }
    }

    // Download URL to buffer (only after size check)
    const response = await fetch(media.url);
    if (!response.ok) {
      throw new Error(
        `Failed to download media from ${media.url}: ${response.statusText}`,
      );
    }
    const arrayBuffer = await response.arrayBuffer();
    file = Buffer.from(arrayBuffer);
  } else {
    throw new Error("Media must have either buffer or url");
  }

  // Send based on media type
  let result: { id: number };
  const caption = body || undefined;

  switch (media.type) {
    case "image":
      result = await client.sendFile(entity, {
        file,
        caption,
        replyTo: options?.replyTo ? Number(options.replyTo) : undefined,
      });
      break;

    case "video":
      result = await client.sendFile(entity, {
        file,
        caption,
        replyTo: options?.replyTo ? Number(options.replyTo) : undefined,
        attributes: [
          new Api.DocumentAttributeVideo({
            duration: 0,
            w: 0,
            h: 0,
          }),
        ],
      });
      break;

    case "audio":
    case "voice":
      result = await client.sendFile(entity, {
        file,
        caption,
        replyTo: options?.replyTo ? Number(options.replyTo) : undefined,
        voiceNote: media.type === "voice",
      });
      break;
    default:
      result = await client.sendFile(entity, {
        file,
        caption,
        replyTo: options?.replyTo ? Number(options.replyTo) : undefined,
        attributes: media.fileName
          ? [
              new Api.DocumentAttributeFilename({
                fileName: media.fileName,
              }),
            ]
          : undefined,
      });
      break;
  }

  return {
    messageId: result.id.toString(),
    status: "sent",
    providerMeta: {
      userId: extractUserId(entity),
    },
  };
}

/**
 * Send typing indicator to a chat.
 */
export async function sendTypingIndicator(
  client: TelegramClient,
  to: string,
): Promise<void> {
  const entity = await resolveEntity(client, to);
  await client.invoke(
    new Api.messages.SetTyping({
      peer: entity,
      action: new Api.SendMessageTypingAction(),
    }),
  );
}
