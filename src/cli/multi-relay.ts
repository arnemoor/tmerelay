import { defaultRuntime } from "../runtime.js";
import type { WarelayConfig } from "../config/config.js";
import type { Provider } from "../utils.js";

/**
 * Run multiple provider monitors concurrently.
 * Handles graceful shutdown and per-provider error recovery.
 */
export async function runMultiProviderRelay(
  providers: Provider[],
  _config: WarelayConfig,
  _deps: unknown,
  opts: { verbose?: boolean },
): Promise<void> {
  const abortController = new AbortController();
  const { signal } = abortController;

  // Setup Ctrl+C handler
  const sigintHandler = () => {
    console.log("\n⏹  Stopping all providers...");
    abortController.abort();
  };
  process.on("SIGINT", sigintHandler);

  console.log(
    `📡 Starting ${providers.length} provider(s): ${providers.join(", ")}`,
  );

  // Spawn monitors concurrently
  const monitorPromises = providers.map(async (provider) => {
    try {
      if (provider === "telegram") {
        const { monitorTelegramProvider } = await import(
          "../telegram/monitor.js"
        );
        // monitorTelegramProvider(verbose, runtime) - doesn't support AbortSignal yet
        // We'll wrap it and check signal periodically
        const monitorPromise = monitorTelegramProvider(
          Boolean(opts.verbose),
          defaultRuntime,
        );
        // Race between monitor and abort signal
        await Promise.race([
          monitorPromise,
          new Promise<void>((resolve) => {
            if (signal.aborted) resolve();
            signal.addEventListener("abort", () => resolve());
          }),
        ]);
      } else if (provider === "wa-web") {
        const { monitorWebProvider } = await import("../web/auto-reply.js");
        // monitorWebProvider accepts abortSignal
        await monitorWebProvider(
          Boolean(opts.verbose),
          undefined,
          true,
          undefined,
          defaultRuntime,
          signal,
        );
      } else if (provider === "wa-twilio") {
        const { monitorTwilio } = await import("../twilio/monitor.js");
        // monitorTwilio - use default polling settings, wrap with abort signal
        const monitorPromise = monitorTwilio(10, 5);
        // Race between monitor and abort signal
        await Promise.race([
          monitorPromise,
          new Promise<void>((resolve) => {
            if (signal.aborted) resolve();
            signal.addEventListener("abort", () => resolve());
          }),
        ]);
      }
    } catch (err) {
      if (signal.aborted) return; // Graceful shutdown
      console.error(`❌ ${provider} error:`, err);
      // Continue - don't crash other providers
    }
  });

  // Wait for all monitors (or abort)
  await Promise.allSettled(monitorPromises);

  // Remove SIGINT handler
  process.off("SIGINT", sigintHandler);

  console.log("✅ All providers stopped");
}
