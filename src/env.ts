import { z } from "zod";

import { danger } from "./globals.js";
import { defaultRuntime, type RuntimeEnv } from "./runtime.js";

export type AuthMode =
  | { accountSid: string; authToken: string }
  | { accountSid: string; apiKey: string; apiSecret: string };

export type EnvConfig = {
  accountSid?: string;
  whatsappFrom?: string;
  whatsappSenderSid?: string;
  auth?: AuthMode;
  telegram?: {
    apiId: number;
    apiHash: string;
  };
};

// Base schema with all fields optional
const BaseEnvSchema = z.object({
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),
  TWILIO_SENDER_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_API_KEY: z.string().optional(),
  TWILIO_API_SECRET: z.string().optional(),
  TELEGRAM_API_ID: z.string().optional(),
  TELEGRAM_API_HASH: z.string().optional(),
});

// Twilio-specific validation
const TwilioEnvSchema = BaseEnvSchema.extend({
  TWILIO_ACCOUNT_SID: z.string().min(1, "TWILIO_ACCOUNT_SID required"),
  TWILIO_WHATSAPP_FROM: z.string().min(1, "TWILIO_WHATSAPP_FROM required"),
}).superRefine((val, ctx) => {
  if (val.TWILIO_API_KEY && !val.TWILIO_API_SECRET) {
    ctx.addIssue({
      code: "custom",
      message: "TWILIO_API_SECRET required when TWILIO_API_KEY is set",
    });
  }
  if (val.TWILIO_API_SECRET && !val.TWILIO_API_KEY) {
    ctx.addIssue({
      code: "custom",
      message: "TWILIO_API_KEY required when TWILIO_API_SECRET is set",
    });
  }
  if (
    !val.TWILIO_AUTH_TOKEN &&
    !(val.TWILIO_API_KEY && val.TWILIO_API_SECRET)
  ) {
    ctx.addIssue({
      code: "custom",
      message:
        "Provide TWILIO_AUTH_TOKEN or both TWILIO_API_KEY and TWILIO_API_SECRET",
    });
  }
});

// Telegram-specific validation
const TelegramEnvSchema = BaseEnvSchema.superRefine((val, ctx) => {
  if (
    (val.TELEGRAM_API_ID && !val.TELEGRAM_API_HASH) ||
    (!val.TELEGRAM_API_ID && val.TELEGRAM_API_HASH)
  ) {
    ctx.addIssue({
      code: "custom",
      message:
        "Both TELEGRAM_API_ID and TELEGRAM_API_HASH must be set together",
    });
  }
});

// Schema requiring both Twilio and Telegram validation
const AllEnvSchema = BaseEnvSchema.extend({
  TWILIO_ACCOUNT_SID: z.string().min(1, "TWILIO_ACCOUNT_SID required"),
  TWILIO_WHATSAPP_FROM: z.string().min(1, "TWILIO_WHATSAPP_FROM required"),
}).superRefine((val, ctx) => {
  // Twilio auth validation
  if (val.TWILIO_API_KEY && !val.TWILIO_API_SECRET) {
    ctx.addIssue({
      code: "custom",
      message: "TWILIO_API_SECRET required when TWILIO_API_KEY is set",
    });
  }
  if (val.TWILIO_API_SECRET && !val.TWILIO_API_KEY) {
    ctx.addIssue({
      code: "custom",
      message: "TWILIO_API_KEY required when TWILIO_API_SECRET is set",
    });
  }
  if (
    !val.TWILIO_AUTH_TOKEN &&
    !(val.TWILIO_API_KEY && val.TWILIO_API_SECRET)
  ) {
    ctx.addIssue({
      code: "custom",
      message:
        "Provide TWILIO_AUTH_TOKEN or both TWILIO_API_KEY and TWILIO_API_SECRET",
    });
  }
  // Telegram validation
  if (
    (val.TELEGRAM_API_ID && !val.TELEGRAM_API_HASH) ||
    (!val.TELEGRAM_API_ID && val.TELEGRAM_API_HASH)
  ) {
    ctx.addIssue({
      code: "custom",
      message:
        "Both TELEGRAM_API_ID and TELEGRAM_API_HASH must be set together",
    });
  }
});

export function readEnv(
  runtime: RuntimeEnv = defaultRuntime,
  provider: "telegram" | "twilio" | "all" = "all",
): EnvConfig {
  // Select schema based on provider
  const schema =
    provider === "telegram"
      ? TelegramEnvSchema
      : provider === "twilio"
        ? TwilioEnvSchema
        : AllEnvSchema;

  // Load and validate provider-specific configuration from env
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    runtime.error("Invalid environment configuration:");
    parsed.error.issues.forEach((iss) => {
      runtime.error(`- ${iss.message}`);
    });
    runtime.exit(1);
  }

  const {
    TWILIO_ACCOUNT_SID: accountSid,
    TWILIO_WHATSAPP_FROM: whatsappFrom,
    TWILIO_SENDER_SID: whatsappSenderSid,
    TWILIO_AUTH_TOKEN: authToken,
    TWILIO_API_KEY: apiKey,
    TWILIO_API_SECRET: apiSecret,
    TELEGRAM_API_ID: telegramApiId,
    TELEGRAM_API_HASH: telegramApiHash,
  } = parsed.data;

  // Build config based on provider mode
  const config: EnvConfig = {};

  // Add Twilio fields if present
  if (accountSid && whatsappFrom) {
    config.accountSid = accountSid;
    config.whatsappFrom = whatsappFrom;
    config.whatsappSenderSid = whatsappSenderSid;

    // Build auth
    if (apiKey && apiSecret) {
      config.auth = { accountSid, apiKey, apiSecret };
    } else if (authToken) {
      config.auth = { accountSid, authToken };
    } else if (provider !== "telegram") {
      runtime.error("Missing Twilio auth configuration");
      runtime.exit(1);
      throw new Error("unreachable");
    }
  } else if (provider === "twilio" || provider === "all") {
    // Twilio required but missing
    runtime.error(
      "Missing Twilio configuration (TWILIO_ACCOUNT_SID, TWILIO_WHATSAPP_FROM)",
    );
    runtime.exit(1);
    throw new Error("unreachable");
  }

  // Add Telegram fields if present
  if (telegramApiId && telegramApiHash) {
    config.telegram = {
      apiId: Number.parseInt(telegramApiId, 10),
      apiHash: telegramApiHash,
    };
  }

  return config;
}

export function ensureTwilioEnv(runtime: RuntimeEnv = defaultRuntime) {
  // Guardrails: fail fast when Twilio env vars are missing or incomplete.
  const required = ["TWILIO_ACCOUNT_SID", "TWILIO_WHATSAPP_FROM"];
  const missing = required.filter((k) => !process.env[k]);
  const hasToken = Boolean(process.env.TWILIO_AUTH_TOKEN);
  const hasKey = Boolean(
    process.env.TWILIO_API_KEY && process.env.TWILIO_API_SECRET,
  );
  if (missing.length > 0 || (!hasToken && !hasKey)) {
    runtime.error(
      danger(
        `Missing Twilio env: ${missing.join(", ") || "auth token or api key/secret"}. Set them in .env before using provider=twilio.`,
      ),
    );
    runtime.exit(1);
  }
}
