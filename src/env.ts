import type { RuntimeEnv } from "./runtime.js";

export type TelegramEnvSettings = {
  apiId?: string;
  apiHash?: string;
  tempDir?: string;
};

export type WareEnvSettings = {
  telegram: TelegramEnvSettings;
  configDir?: string;
};

/**
 * Read environment variables needed by Telegram and other providers.
 * Stub implementation for Pi RPC architecture.
 */
export function readEnv(_runtime: RuntimeEnv): WareEnvSettings {
  return {
    telegram: {
      apiId: process.env.TELEGRAM_API_ID,
      apiHash: process.env.TELEGRAM_API_HASH,
      tempDir: process.env.TELEGRAM_TEMP_DIR,
    },
    configDir: process.env.WARELAY_CONFIG_DIR,
  };
}
