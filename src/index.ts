/**
 * Telegram → Cloudflare Workers Relay
 *
 * Receives Telegram bot updates via webhook, normalizes the payload into
 * clean flat fields, and forwards to HookForms via a Cloudflare Service Binding.
 */

export interface Env {
  BOT_TOKEN: string;
  HOOKFORMS: Fetcher;
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

      // Forward via service binding (direct in-memory call, no network)
      const resp = await env.HOOKFORMS.fetch(
        "https://hookforms-cf.borderlesstechnologysolutions.workers.dev/hooks/telegram-alerts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      console.log(`Forwarded to hookforms: ${resp.status}`);

      return new Response("ok");
    } catch (err) {
      console.error("Relay error:", err);
      return new Response("ok"); // Always 200 — Telegram retries on non-200
    }
  },
};
