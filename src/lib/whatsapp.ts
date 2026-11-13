// Server-only. Outbound WhatsApp alerts (PLAN §7, D3, D15). Wording lives in src/shared/messages.ts.
import { TEMPLATES, renderMessage, validateVars, type TemplateName } from '../shared/messages.ts';

// test → Meta's hello_world; text → our fixed wording as plain text (recipient must have messaged
// the number in the last 24 h); live → our approved templates.
export type SendMode = 'test' | 'text' | 'live';

// shortcut: version taken from docs/WHATSAPP-TEMPLATES.md (latest seen 2026-11-13); bump when Meta deprecates it.
const GRAPH = 'https://graph.facebook.com/v27.0';

/** Hex HMAC-SHA256 of the access token, keyed with the app secret (Web Crypto, runs on Workers). */
export async function appsecretProof(token: string, appSecret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(appSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(token)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Sends one alert. Throws on bad input (caller returns 400); resolves false when Meta fails (caller falls back to wa.me). */
export async function sendTemplate(name: string, to: string, vars: string[]): Promise<boolean> {
  const env = process.env.WHATSAPP_TEMPLATE_MODE;
  const mode: SendMode = env === 'live' || env === 'text' ? env : 'test';
  const payload = buildTemplatePayload(name, to, vars, mode);
  const token = process.env.WHATSAPP_TOKEN ?? '';
  try {
    const proof = await appsecretProof(token, process.env.WHATSAPP_APP_SECRET ?? '');
    const res = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages?appsecret_proof=${proof}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false; // network or timeout; never log `to` (D10)
  }
}

const isTemplate = (name: string): name is TemplateName => Object.hasOwn(TEMPLATES, name);

/** Pure. Throws on anything not allowed; `name`, `to` and `vars` come straight from the request. */
export function buildTemplatePayload(name: string, to: string, vars: string[], mode: SendMode) {
  if (!isTemplate(name)) throw new Error('Unknown template');
  if (!/^\d{8,15}$/.test(to)) throw new Error('Number must be 8–15 digits, country code first');
  validateVars(name, vars);
  const base = { messaging_product: 'whatsapp', to } as const;
  if (mode === 'test') {
    return { ...base, type: 'template', template: { name: 'hello_world', language: { code: 'en_US' } } } as const;
  }
  if (mode === 'text') {
    return { ...base, type: 'text', text: { preview_url: false, body: renderMessage(name, vars) } } as const;
  }
  return {
    ...base,
    type: 'template',
    template: {
      name,
      language: { code: 'en' },
      components: [{ type: 'body', parameters: vars.map((text) => ({ type: 'text', text })) }],
    },
  } as const;
}
