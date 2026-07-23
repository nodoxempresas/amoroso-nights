/**
 * Relays the amorosonights.com lead form to Telegram.
 *
 * The site is static (GitHub Pages), so it cannot hold the bot token — anything
 * in the page is public. This Worker holds it as a secret instead and is the
 * only thing that talks to Telegram.
 *
 * Secrets (set with `wrangler secret put <NAME>`, never committed):
 *   TELEGRAM_BOT_TOKEN  from @BotFather
 *   TELEGRAM_CHAT_ID    destination chat (from @userinfobot, or the group id)
 */

const MAX_FIELD = 600; // Telegram caps messages at 4096 chars; keep well under.
const RATE_MAX = 20; // submissions per IP...
const RATE_WINDOW = 600; // ...per this many seconds.

const FIELDS = [
  ['name', 'Nombre'],
  ['whatsapp', 'WhatsApp'],
  ['email', 'Email'],
  ['city', 'Ciudad'],
  ['date', 'Fecha tentativa'],
  ['groupSize', 'Personas'],
  ['occasion', 'Motivo'],
  ['vibe', 'Estilo'],
  ['avoid', 'Qué evitar'],
];

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const isChecked = (value) => value === true || value === 'true' || value === 'on';

function corsHeaders(request, env) {
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const origin = request.headers.get('Origin') || '';
  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

const json = (body, status, extra) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });

function normalizeBotToken(value) {
  const token = String(value || '').trim();
  const fromBotUrl = token.match(/(?:^|\/)bot(\d+:[A-Za-z0-9_-]+)/i);
  const rawToken = token.match(/(\d+:[A-Za-z0-9_-]+)/);
  return (fromBotUrl || rawToken)?.[1] || token;
}

/**
 * Per-IP throttle via the Cache API — no KV namespace to provision and no
 * write quota to exhaust during the flood it exists to stop. Cache is per-colo,
 * so a distributed botnet can beat it; it's here for the common single-source
 * case. Each write refreshes the TTL, so a persistent spammer stays blocked.
 */
async function rateLimited(ip) {
  const key = new Request(`https://ratelimit.invalid/${encodeURIComponent(ip)}`);
  const cache = caches.default;
  const hit = await cache.match(key);
  const n = hit ? parseInt(await hit.text(), 10) || 0 : 0;
  if (n >= RATE_MAX) return true;
  await cache.put(
    key,
    new Response(String(n + 1), { headers: { 'Cache-Control': `max-age=${RATE_WINDOW}` } })
  );
  return false;
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors);
    if (!cors['Access-Control-Allow-Origin']) return json({ error: 'forbidden_origin' }, 403, cors);

    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
      console.error('missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID secret');
      return json({ error: 'server_misconfigured' }, 500, cors);
    }

    const botToken = normalizeBotToken(env.TELEGRAM_BOT_TOKEN);
    if (!/^\d+:[A-Za-z0-9_-]+$/.test(botToken)) {
      console.error('invalid TELEGRAM_BOT_TOKEN format');
      return json({ error: 'server_misconfigured' }, 500, cors);
    }

    let data;
    try {
      data = await request.json();
    } catch {
      return json({ error: 'bad_json' }, 400, cors);
    }

    // Honeypot: hidden field no human ever sees. Report success so the bot
    // has no signal to retry against.
    if (data.website) return json({ ok: true }, 200, cors);

    const missingFields = FIELDS
      .filter(([key]) => !String(data[key] ?? '').trim())
      .map(([, label]) => label);
    if (missingFields.length) {
      return json({ error: 'missing_required_fields', missing_fields: missingFields }, 400, cors);
    }

    if (!isChecked(data.adultsConfirmed) || !isChecked(data.legalConfirmed)) {
      return json({ error: 'required_confirmations' }, 400, cors);
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (await rateLimited(ip)) {
      return json({ error: 'rate_limited', retryAfter: RATE_WINDOW }, 429, {
        ...cors,
        'Retry-After': String(RATE_WINDOW),
      });
    }

    const lines = ['<b>🌙 Nueva solicitud — Amoroso Nights</b>', ''];
    for (const [key, label] of FIELDS) {
      const v = (data[key] ?? '').toString().trim().slice(0, MAX_FIELD);
      if (v) lines.push(`<b>${label}:</b> ${esc(v)}`);
    }
    lines.push('');
    lines.push(`Mayores de edad: ${isChecked(data.adultsConfirmed) ? '✅' : '❌'}`);
    lines.push(`Acepta términos: ${isChecked(data.legalConfirmed) ? '✅' : '❌'}`);

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text: lines.join('\n'),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    if (!res.ok) {
      // Never echo Telegram's body to the client — it can quote the token back.
      console.error('telegram sendMessage failed', res.status, await res.text());
      return json({ error: 'delivery_failed' }, 502, cors);
    }

    return json({ ok: true }, 200, cors);
  },
};
