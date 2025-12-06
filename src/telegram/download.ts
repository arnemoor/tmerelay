import crypto from "node:crypto";
import fsSync, { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { canUseDir } from "../utils.js";

// Prefer ~/.clawdis/telegram-temp, but fall back to ~/.warelay for compatibility
const TEMP_DIR_CLAWDIS = path.join(os.homedir(), ".clawdis", "telegram-temp");
const TEMP_DIR_LEGACY = path.join(os.homedir(), ".warelay", "telegram-temp");

function resolveTempDir(): string {
  // Allow override for tests/sandboxes
  const override =
    process.env.TELEGRAM_TEMP_DIR || process.env.WARELAY_TEMP_DIR;
  if (override) {
    return path.resolve(override);
  }

  // Use CLAWDIS path if the main config directory exists, otherwise legacy
  const clawdisConfigExists = fsSync.existsSync(
    path.join(os.homedir(), ".clawdis"),
  );
  const preferred = clawdisConfigExists ? TEMP_DIR_CLAWDIS : TEMP_DIR_LEGACY;
  if (canUseDir(preferred)) return preferred;
  if (canUseDir(TEMP_DIR_LEGACY)) return TEMP_DIR_LEGACY;

  // Sandbox-safe fallback inside workspace
  const fallback = path.join(process.cwd(), ".clawdis", "telegram-temp");
  if (canUseDir(fallback)) return fallback;

  // Last resort: OS tmp
  return path.join(os.tmpdir(), "warelay-telegram-temp");
}

function getTempDir(): string {
  return resolveTempDir();
}
const DEFAULT_ORPHAN_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Result of a streaming download operation.
 * Caller must clean up tempPath after use.
 */
export interface DownloadResult {
  /** Absolute path to downloaded temp file */
  tempPath: string;

  /** Total bytes downloaded */
  size: number;

  /** Content-Type header from response (if available) */
  contentType?: string;

  /** Cleanup function - MUST be called to remove temp file */
  cleanup: () => Promise<void>;
}

/**
 * Get temp directory for Telegram downloads.
 * Uses ~/.clawdis/telegram-temp for consistency with media store.
 */
export function getTelegramTempDir(): string {
  return getTempDir();
}

/**
 * Ensure temp directory exists.
 */
export async function ensureTempDir(): Promise<string> {
  const dir = getTempDir();
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Download URL to temporary file using Node.js streams.
 * Eliminates memory buffering for large files.
 *
 * IMPORTANT: Caller MUST call result.cleanup() after use.
 * Use try-finally pattern to ensure cleanup on errors.
 *
 * @param url - URL to download
 * @param maxSize - Maximum size in bytes (throws if exceeded)
 * @returns DownloadResult with tempPath and cleanup function
 * @throws Error if download fails, size exceeds maxSize, or disk write fails
 *
 * @example
 * const download = await streamDownloadToTemp(url, maxSize);
 * try {
 *   await client.sendFile(entity, { file: download.tempPath });
 * } finally {
 *   await download.cleanup();
 * }
 */
export async function streamDownloadToTemp(
  url: string,
  maxSize: number,
): Promise<DownloadResult> {
  await ensureTempDir();

  // Generate unique temp file name
  const filename = `telegram-dl-${crypto.randomUUID()}.tmp`;
  const tempPath = path.join(getTempDir(), filename);

  // Fetch response
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to download media from ${url}: ${response.statusText}`,
    );
  }

  if (!response.body) {
    throw new Error(`No response body for ${url}`);
  }

  // Track size during download
  let totalSize = 0;
  const writeStream = createWriteStream(tempPath);

  try {
    // Use pipeline for automatic backpressure handling
    // Transform stream to track size and enforce limit
    const trackingStream = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        totalSize += chunk.length;
        if (totalSize > maxSize) {
          callback(
            new Error(
              `Download size ${totalSize} exceeds maximum ${maxSize} bytes`,
            ),
          );
          return;
        }
        callback(null, chunk);
      },
    });

    // Pipeline: fetch response -> size tracker -> file write
    await pipeline(response.body, trackingStream, writeStream);

    const contentType = response.headers.get("content-type") || undefined;

    return {
      tempPath,
      size: totalSize,
      contentType,
      cleanup: async () => {
        await fs.rm(tempPath, { force: true }).catch(() => {
          // Suppress cleanup errors (file may already be deleted)
        });
      },
    };
  } catch (error) {
    // Clean up temp file on failure
    await fs.rm(tempPath, { force: true }).catch(() => {});
    throw error;
  }
}

/**
 * Clean up orphaned temp files older than TTL.
 * Run on process start to handle crash recovery.
 *
 * @param ttlMs - Time-to-live in milliseconds (default: 1 hour)
 */
export async function cleanOrphanedTempFiles(
  ttlMs = DEFAULT_ORPHAN_TTL_MS,
): Promise<void> {
  try {
    await ensureTempDir();
    const tempDir = getTempDir();
    const entries = await fs.readdir(tempDir).catch(() => []);
    const now = Date.now();

    await Promise.all(
      entries.map(async (file) => {
        const fullPath = path.join(tempDir, file);
        const stat = await fs.stat(fullPath).catch(() => null);
        if (!stat) return;

        if (now - stat.mtimeMs > ttlMs) {
          await fs.rm(fullPath, { force: true }).catch(() => {});
        }
      }),
    );
  } catch (error) {
    // Non-fatal: log but don't throw
    console.warn("Failed to clean orphaned temp files:", error);
  }
}
