# Telegram Cloudflare Relay

> **Forward Telegram bot messages to Discord, email, Slack, or any webhook — powered by Cloudflare Workers and [HookForms](https://github.com/h1n054ur/hookforms-cf).**

A lightweight Cloudflare Worker that receives Telegram bot updates via webhook and relays them to a [HookForms](https://github.com/h1n054ur/hookforms-cf) endpoint, which dispatches notifications to your configured channels.

## Deploy to Cloudflare

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button.svg)](https://deploy.workers.cloudflare.com/?url=https://github.com/h1n054ur/telegram-cloudflare-relay)

> After deployment you **must** set three secrets via the Cloudflare dashboard or CLI — see [Setup](#setup) below.

## How It Works

```
Telegram Bot ──webhook──▶ This Worker ──POST──▶ HookForms ──▶ Discord / Email / Slack
```

1. **Telegram** sends bot updates to this Worker's URL (set via `setWebhook`)
2. The Worker extracts the message text, sender, and chat info
3. It forwards the payload to your **HookForms** endpoint
4. HookForms dispatches to all active channels (Discord, email, Slack, Teams, ntfy, etc.)

## Setup

### Prerequisites

- A **Cloudflare account** (free tier works)
- A **Telegram bot token** from [@BotFather](https://t.me/BotFather)
- A **HookForms** instance — either [self-hosted](https://github.com/h1n054ur/hookforms-cf) or a managed deployment

### 1. Deploy the Worker

Click the deploy button above, or deploy manually:

```bash
git clone https://github.com/h1n054ur/telegram-cloudflare-relay.git
cd telegram-cloudflare-relay
npm install
npx wrangler deploy
```

### 2. Set Secrets

```bash
npx wrangler secret put BOT_TOKEN
# Paste your Telegram bot token

npx wrangler secret put HOOKFORMS_URL
# e.g. https://your-hookforms.workers.dev/hooks/your-slug

npx wrangler secret put HOOKFORMS_API_KEY
# Your HookForms admin API key
```

Or set them in the **Cloudflare Dashboard → Workers → Settings → Variables and Secrets**.

### 3. Register the Telegram Webhook

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://<YOUR_WORKER>.workers.dev"
```

Replace `<BOT_TOKEN>` with your bot token and `<YOUR_WORKER>` with your Worker's name.

Verify it's set:

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```

### 4. Configure HookForms Channels

On your HookForms instance, create an inbox and add notification channels:

- **Discord** — paste your webhook URL
- **Email** — add recipient addresses
- **Slack** — paste your incoming webhook URL
- Or any other supported channel

## Required Secrets

| Secret | Description |
|--------|-------------|
| `BOT_TOKEN` | Telegram bot token from @BotFather |
| `HOOKFORMS_URL` | Full URL to your HookForms webhook endpoint |
| `HOOKFORMS_API_KEY` | Admin API key for HookForms |

## Payload Format

The relay forwards this JSON to HookForms:

```json
{
  "text": "Original Telegram message text",
  "from_username": "telegram_user",
  "from_id": 123456789,
  "chat_id": -100123456789,
  "chat_title": "My Group",
  "message_id": 42,
  "date": 1720000000
}
```

## Tags

`telegram` `cloudflare-workers` `webhook-relay` `discord-notifications` `hookforms` `serverless` `notifications` `forwarding` `bot` `worker`

## License

MIT
