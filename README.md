# Telegram Cloudflare Relay

> **A small extension to [HookForms](https://github.com/h1n054ur/hookforms) that bridges Telegram groups to Discord, email, Slack, or any webhook — deployable to Cloudflare Workers.**

## The Problem

You're in a Telegram group where a bot posts alerts — job leads, notifications, updates, whatever. You want those messages forwarded to Discord, your inbox, Slack, or somewhere your team actually checks. But you don't control the bot. You can't configure where it sends. You can only add bots to the group and watch them post.

This relay solves that. It creates a bot that silently listens in your Telegram group, grabs every message, normalizes the payload, and pipes it to [HookForms](https://github.com/h1n054ur/hookforms) via a Cloudflare Service Binding — which fans it out to all your notification channels in parallel.

```
Telegram Group (external bot posts alerts)
       │
       ▼
@YourBot (this relay) ──service binding──▶ HookForms ──▶ Discord
                                                        Email
                                                        Slack
                                                        Teams
                                                        ntfy
                                                        ...any webhook
```

## What is HookForms?

[HookForms](https://github.com/h1n054ur/hookforms) is a self-hosted webhook inbox with multi-channel notifications. Point any HTTP form (or bot, or script) at a HookForms endpoint and get submissions delivered to Discord, Slack, email, Teams, Telegram, ntfy, or any webhook URL. It handles formatting, routing, rate limiting, and event history.

This relay is a lightweight companion that plugs Telegram into that system. HookForms does the heavy lifting — this just gives it a Telegram intake valve.

**Deploy HookForms first** ([Docker Compose](https://github.com/h1n054ur/hookforms) or [Cloudflare Workers](https://github.com/h1n054ur/hookforms-cloud)), then come back and deploy this relay.

## How It Works

This relay uses a **Cloudflare Service Binding** to call HookForms directly — no HTTP over the network, no API keys, no exposed endpoints. Both Workers must be in the same Cloudflare account.

## Setup

### Prerequisites

- A **Cloudflare account** (free tier works)
- A **HookForms Worker** deployed in your account — [self-hosted](https://github.com/h1n054ur/hookforms) or [Cloudflare Workers](https://github.com/h1n054ur/hookforms-cloud)
- A **Telegram bot token** from [@BotFather](https://t.me/BotFather)

---

### Step 1: Create Your Telegram Bot

1. Open Telegram and search for **[@BotFather](https://t.me/BotFather)**
2. Send `/newbot`
3. Pick a **name** for your bot (e.g. `Gigradar Alert Forwarder`) — this is what shows in chat
4. Pick a **username** ending in `bot` (e.g. `MyAlertForwarderBot`) — this is the `@handle`
5. BotFather gives you a **bot token** — save it, you'll need it shortly

#### Turn off group privacy

By default bots can't see messages in groups. You need to disable this:

1. Send `/mybots` to BotFather
2. Select your bot
3. Go to **Bot Settings** → **Group Privacy**
4. Select **Turn off**

This lets the bot read all messages in groups it's added to.

---

### Step 2: Deploy This Relay

```bash
git clone https://github.com/h1n054ur/telegram-cloudflare-relay.git
cd telegram-cloudflare-relay
npm install
```

#### Configure the service binding

Edit `wrangler.toml` and replace `hookforms-cf` with your actual HookForms Worker name:

```toml
[[services]]
binding = "HOOKFORMS"
service = "hookforms-cf"  # <-- change this to your Worker name
```

Deploy:

```bash
npx wrangler deploy
```

Note your Worker's URL — it'll be something like `https://telegram-cloudflare-relay.YOUR_SUBDOMAIN.workers.dev`.

---

### Step 3: Set the Bot Token Secret

```bash
npx wrangler secret put BOT_TOKEN
# Paste your Telegram bot token from Step 1
```

Or set it in the **Cloudflare Dashboard → Workers & Pages → your Worker → Settings → Variables and Secrets** (add a "Secret" type variable named `BOT_TOKEN`).

That's the only secret needed — the service binding handles routing to HookForms.

---

### Step 4: Register the Telegram Webhook

Tell Telegram to send updates to your Worker:

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://<YOUR_WORKER>.workers.dev"
```

Replace:
- `<BOT_TOKEN>` — your bot token from Step 1
- `<YOUR_WORKER>` — your Worker name (the part before `.workers.dev`)

Verify it worked:

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```

You should see `"url":"https://<YOUR_WORKER>.workers.dev"` and `"pending_update_count":0`.

---

### Step 5: Configure HookForms Channels

On your HookForms instance, create an inbox and add notification channels:

```bash
# Create inbox
curl -X POST https://your-hookforms.workers.dev/v1/hooks/inboxes \
  -H "X-API-Key: YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"slug": "telegram-alerts", "description": "Forwarded Telegram messages"}'

# Add Discord channel (use webhook_url, not url)
curl -X POST https://your-hookforms.workers.dev/v1/hooks/inboxes/telegram-alerts/channels \
  -H "X-API-Key: YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type": "webhook", "config": {"webhook_url": "https://discord.com/api/webhooks/YOUR/WEBHOOK"}}'

# Add email channel
curl -X POST https://your-hookforms.workers.dev/v1/hooks/inboxes/telegram-alerts/channels \
  -H "X-API-Key: YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type": "email", "config": {"recipients": ["you@example.com"]}}'
```

> **Important:** The relay hardcodes the HookForms inbox URL in `src/index.ts`. Update the URL in the `env.HOOKFORMS.fetch()` call to point to your own inbox slug:
> ```typescript
> const resp = await env.HOOKFORMS.fetch(
>   "https://your-hookforms.workers.dev/hooks/your-inbox-slug",
>   ...
> );
> ```

---

### Step 6: Add Your Bot to the Group

1. Open the Telegram group
2. Tap the group name → **Add Members**
3. Search for your bot's `@username` and add it
4. Send a test message — you should see it appear in Discord / email / wherever you configured

Done. Every message posted in the group (including from other bots) now gets forwarded to all your channels.

## Required Secrets

| Secret | Description |
|--------|-------------|
| `BOT_TOKEN` | Telegram bot token from @BotFather |

The HookForms routing is handled by a **Service Binding** — no URL or API key secrets needed. Both Workers must be in the same Cloudflare account.

## Payload Format

The relay normalizes Telegram's nested JSON into clean flat fields:

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

## Troubleshooting

**Bot doesn't see messages in the group**
→ Group privacy is still on. Go to @BotFather → `/mybots` → your bot → Bot Settings → Group Privacy → Turn off.

**Messages arrive in HookForms but not in Discord**
→ Check your Discord channel config uses `webhook_url` (not `url`). The adapter expects `config.webhook_url`.

**`getUpdates` returns empty**
→ Make sure the webhook is registered (`getWebhookInfo`). Telegram stops pushing to `getUpdates` once a webhook is set.

**Bot was added after the webhook was set**
→ That's fine — new groups work immediately. No re-registration needed.

**Service binding not working**
→ Both Workers must be in the same Cloudflare account. Check that `service` in `wrangler.toml` matches your HookForms Worker name exactly.

## Related Projects

| Project | Description |
|---------|-------------|
| [HookForms](https://github.com/h1n054ur/hookforms) | Self-hosted webhook inbox — multi-channel notifications (Docker Compose) |
| [HookForms Cloud](https://github.com/h1n054ur/hookforms-cloud) | Serverless version — runs on Cloudflare Workers (D1, KV, Queues) |
| **This repo** | Telegram → HookForms relay bridge |

## License

MIT
