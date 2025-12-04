# 🦞 CLAWDIS — Multi-Platform Gateway for AI Agents

<p align="center">
  <img src="docs/whatsapp-clawd.jpg" alt="CLAWDIS" width="400">
</p>

<p align="center">
  <strong>EXFOLIATE! EXFOLIATE!</strong>
</p>

<p align="center">
  <a href="https://github.com/steipete/warelay/actions/workflows/ci.yml?branch=main"><img src="https://img.shields.io/github/actions/workflow/status/steipete/warelay/ci.yml?branch=main&style=for-the-badge" alt="CI status"></a>
  <a href="https://www.npmjs.com/package/warelay"><img src="https://img.shields.io/npm/v/warelay.svg?style=for-the-badge" alt="npm version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
</p>

**CLAWDIS** (formerly Warelay) is a multi-platform messaging gateway for AI agents. Send a message via WhatsApp or Telegram, get an AI response. It's like having a genius lobster in your pocket 24/7.

```
┌─────────────┐      ┌──────────┐      ┌─────────────┐
│  WhatsApp   │ ───▶ │ CLAWDIS  │ ───▶ │  AI Agent   │
│  Telegram   │ ◀─── │  🦞⏱️💙   │ ◀─── │ (Tau/Claude)│
└─────────────┘      └──────────┘      └─────────────┘
```

## Why "CLAWDIS"?

**CLAWDIS** = CLAW + TARDIS

Because every space lobster needs a time-and-space machine. The Doctor has a TARDIS. [Clawd](https://clawd.me) has a CLAWDIS. Both are blue. Both are chaotic. Both are loved.

## Features

- 📱 **Multi-Platform** — WhatsApp Web, WhatsApp Business (Twilio), Telegram
- 🤖 **AI Agent Gateway** — Works with Tau/Pi, Claude CLI, Codex, Gemini
- 💬 **Session Management** — Per-sender conversation context
- 🔔 **Heartbeats** — Periodic check-ins for proactive AI
- 👥 **Group Chat Support** — Mention-based triggering (WhatsApp)
- 📎 **Media Support** — Images, audio, documents, voice notes
- 🎤 **Voice Transcription** — Whisper integration
- 🔧 **Tool Streaming** — Real-time display (💻📄✍️📝)
- 🎯 **Multi-Provider Relay** — Listen to multiple platforms simultaneously

## Provider Overview

| Provider | Type | Authentication | Media Limit | Status |
|----------|------|----------------|-------------|--------|
| **wa-web** | WhatsApp Web (personal) | QR code scan | 64MB | ✅ Stable |
| **wa-twilio** | WhatsApp Business API | Twilio credentials | 5MB | ✅ Stable |
| **telegram** | Telegram (personal) | Phone + code | 2GB | ✅ Stable |

**Note**: Legacy provider names `web` and `twilio` are deprecated but still work with warnings.

## Quick Start

### A) WhatsApp Web (Recommended)

```bash
# Install
npm install -g warelay  # (still warelay on npm for now)

# Link your WhatsApp
clawdis login --provider wa-web

# Send a message
clawdis send --provider wa-web --to +1234567890 --message "Hello!"

# Start the relay
clawdis relay --provider wa-web --verbose
```

### B) WhatsApp Business (Twilio)

```bash
# Set environment variables
export TWILIO_ACCOUNT_SID=ACxxxxx
export TWILIO_AUTH_TOKEN=xxxxx
export TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# Start the relay
clawdis relay --provider wa-twilio
```

### C) Telegram

```bash
# Set Telegram API credentials
export TELEGRAM_API_ID=12345678
export TELEGRAM_API_HASH=abcdef1234567890abcdef1234567890

# Login with phone number
clawdis login --provider telegram
# Follow the prompts: enter phone, then verification code

# Send a message
clawdis send --provider telegram --to +1234567890 --message "Hello!"

# Start the relay
clawdis relay --provider telegram --verbose
```

### D) Multi-Provider (All Platforms)

```bash
# Listen to WhatsApp Web + Telegram simultaneously
clawdis relay --providers wa-web,telegram --verbose

# Auto mode: listen to all authenticated providers
clawdis relay --provider auto
```

## Configuration

Create `~/.clawdis/clawdis.json`:

```json5
{
  inbound: {
    allowFrom: ["+1234567890", "@telegram_username"],
    reply: {
      mode: "command",
      command: ["tau", "--mode", "json", "{{BodyStripped}}"],
      session: {
        scope: "per-sender",
        idleMinutes: 1440
      },
      heartbeatMinutes: 10
    }
  }
}
```

**Provider-specific features**:

```json5
{
  inbound: {
    reply: {
      // Use {{PROVIDERS}} placeholder for dynamic provider names
      sessionIntro: "You are connected to {{PROVIDERS}}. Keep responses concise.",

      // Provider-aware prompts automatically adjust:
      // - WhatsApp: "Keep WhatsApp replies under ~1500 characters. Media limit: 64MB."
      // - Telegram: "Keep Telegram replies under ~1500 characters. Media limit: 2GB."
    }
  }
}
```

## Environment Variables

| Variable | Provider | Required | Description |
|----------|----------|----------|-------------|
| `TWILIO_ACCOUNT_SID` | wa-twilio | Yes | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | wa-twilio | Yes | Twilio auth token |
| `TWILIO_WHATSAPP_FROM` | wa-twilio | Yes | WhatsApp number (format: `whatsapp:+14155238886`) |
| `TELEGRAM_API_ID` | telegram | Yes | Telegram API ID from [my.telegram.org](https://my.telegram.org) |
| `TELEGRAM_API_HASH` | telegram | Yes | Telegram API hash from [my.telegram.org](https://my.telegram.org) |

**Note**: WhatsApp Web (wa-web) uses QR code authentication - no environment variables needed.

## Documentation

- [Configuration Guide](./docs/configuration.md)
- [Agent Integration](./docs/agents.md)
- [Group Chats](./docs/group-messages.md)
- [Security](./docs/security.md)
- [Troubleshooting](./docs/troubleshooting.md)
- [Telegram Setup](./docs/telegram-setup.md)
- [The Lore](./docs/lore.md) 🦞

## Commands

| Command | Description |
|---------|-------------|
| `clawdis login --provider <kind>` | Authenticate with a provider (wa-web, telegram) |
| `clawdis send --provider <kind>` | Send a message |
| `clawdis relay --provider <kind>` | Start auto-reply loop (single provider) |
| `clawdis relay --providers <kinds>` | Start multi-provider relay (e.g., `wa-web,telegram`) |
| `clawdis relay --provider auto` | Start relay with all authenticated providers |
| `clawdis status` | Show recent messages |
| `clawdis heartbeat` | Trigger a heartbeat |
| `clawdis logout --provider <kind>` | Clear provider authentication |

## Migration from Legacy Provider Names

If you're using the old provider names in scripts or configs:

| Old Name | New Name | Status |
|----------|----------|--------|
| `web` | `wa-web` | Deprecated (still works with warning) |
| `twilio` | `wa-twilio` | Deprecated (still works with warning) |

**Update your commands**:
```bash
# Old (deprecated)
clawdis relay --provider web

# New (recommended)
clawdis relay --provider wa-web
```

## Clawd

CLAWDIS was built for **Clawd**, a space lobster AI assistant. See the full setup in [`docs/clawd.md`](./docs/clawd.md).

- 🦞 **Clawd's Home:** [clawd.me](https://clawd.me)
- 📜 **Clawd's Soul:** [soul.md](https://soul.md)
- 👨‍💻 **Peter's Blog:** [steipete.me](https://steipete.me)
- 🐦 **Twitter:** [@steipete](https://twitter.com/steipete)

## Credits

- **Peter Steinberger** ([@steipete](https://twitter.com/steipete)) — Creator
- **Mario Zechner** ([@badlogicgames](https://twitter.com/badlogicgames)) — Tau/Pi, security testing
- **Clawd** 🦞 — The space lobster who demanded a better name

## License

MIT — Free as a lobster in the ocean.

---

*"We're all just playing with our own prompts."*

🦞💙
