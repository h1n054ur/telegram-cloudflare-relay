/**
 * Telegram → Cloudflare Workers Relay
 *
 * Receives Telegram bot updates via webhook and forwards them to a
 * HookForms-compatible endpoint for delivery to Discord, email, Slack, etc.
 */

export interface Env {
  BOT_TOKEN: string;
  HOOKFORMS_URL: string;
  HOOKFORMS_API_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Health check
    if (request.method === "GET") {
      return new Response(
        JSON.stringify({ status: "ok", service: "telegram-cloudflare-relay" }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    // Only accept POST from Telegram
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      const update = (await request.json()) as Record<string, unknown>;
      const message = update.message as Record<string, unknown> | undefined;

      if (!message?.text) {
        return new Response("ok");
      }

      const from = message.from as Record<string, unknown> | undefined;
      const chat = message.chat as Record<string, unknown> | undefined;

      const payload = {
        text: message.text,
        from_username: from?.username || from?.first_name || "unknown",
        from_id: from?.id,
        chat_id: chat?.id,
        chat_title: chat?.title || chat?.first_name || "unknown",
        message_id: message.message_id,
        date: message.date,
      };

      const resp = await fetch(env.HOOKFORMS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": env.HOOKFORMS_API_KEY,
        },
        body: JSON.stringify(payload),
      });

      console.log(`Forwarded to hookforms: ${resp.status}`);

      return new Response("ok");
    } catch (err) {
      console.error("Relay error:", err);
      return new Response("ok"); // Always 200 — Telegram retries on non-200
    }
  },
};
