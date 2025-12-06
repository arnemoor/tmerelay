import { setVerbose } from "../globals.js";
import { loginTelegram } from "../telegram/login.js";
import type { RuntimeEnv } from "../runtime.js";

export type TelegramLoginOptions = {
  verbose?: boolean;
};

export async function telegramLoginCommand(
  opts: TelegramLoginOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  setVerbose(Boolean(opts.verbose));

  try {
    await loginTelegram(Boolean(opts.verbose), runtime);
  } catch (err) {
    runtime.error(`Telegram login failed: ${String(err)}`);
    runtime.exit(1);
  }
}
