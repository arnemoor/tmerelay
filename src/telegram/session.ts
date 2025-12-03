import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { StringSession } from "telegram/sessions/index.js";
import { ensureDir } from "../utils.js";

export const TELEGRAM_SESSION_DIR = path.join(
  os.homedir(),
  ".warelay",
  "telegram",
  "session",
);

const SESSION_FILE = path.join(TELEGRAM_SESSION_DIR, "session.string");

/**
 * Load Telegram session from disk.
 * Returns null if no session exists.
 */
export async function loadSession(): Promise<StringSession | null> {
  try {
    await ensureDir(TELEGRAM_SESSION_DIR);
    const sessionString = await fs.readFile(SESSION_FILE, "utf-8");
    return new StringSession(sessionString.trim());
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return null; // No session file exists yet
    }
    throw err; // Unexpected error
  }
}

/**
 * Save Telegram session to disk.
 */
export async function saveSession(session: StringSession): Promise<void> {
  await ensureDir(TELEGRAM_SESSION_DIR);
  const sessionString = session.save();
  await fs.writeFile(SESSION_FILE, sessionString, "utf-8");
}

/**
 * Clear Telegram session from disk.
 */
export async function clearSession(): Promise<void> {
  try {
    await fs.unlink(SESSION_FILE);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
    // File doesn't exist, nothing to clear
  }
}

/**
 * Check if a Telegram session exists.
 */
export async function telegramAuthExists(): Promise<boolean> {
  try {
    await fs.access(SESSION_FILE);
    return true;
  } catch {
    return false;
  }
}
