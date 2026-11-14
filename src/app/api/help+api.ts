// Helping Hands (PLAN §7.3). POST: the elder asks their helper to check a message → WhatsApp code to the helper.
// GET ?code= (helper) → the redacted message + verdict; GET ?token= (elder) → the helper's reply. PUT: the helper replies once.
// Raw text, the helper's number and the code are never logged; only redacted text is stored, for 30 minutes.
import { getHelpStore } from '@/lib/help';
import { allowRequest, clientKey } from '@/lib/rate-limit';
import { redact } from '@/lib/redact';
import { runScanPipeline } from '@/lib/scan-pipeline';
import { buildTemplatePayload, sendTemplate } from '@/lib/whatsapp';
import { HELP_REPLIES, LIMITS, VERDICTS, isOneOf } from '@/shared/types';

const CODE = /^\d{6}$/;
const GONE = 'This help request has expired. Ask again from the Scan screen.';

// Helper view: the default (strict) per-IP limit and the global cap stop code guessing.
// Elder poll: every 3 s with an unguessable token, so its own looser bucket.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const code = q.get('code');
  const token = q.get('token');
  const ip = clientKey(request);
  if ((code == null) === (token == null)) return err('Invalid request', 400);
  if (!(token != null ? allowRequest('help-poll', ip, 30, 600) : allowRequest('help-view', ip))) return err('Too many requests. Please wait a minute.', 429);
  if (code != null && !CODE.test(code)) return err('The code is 6 digits.', 400);
  try {
    const store = getHelpStore();
    const row = token != null ? await store.byToken(token) : await store.get(code!);
    if (!row) return err(GONE, 404);
    if (token != null) return Response.json({ reply: row.reply });
    const { elderName, text, verdict, flags, advice, reply } = row;
    return Response.json({ elderName, text, verdict, flags, advice, reply });
  } catch {
    return err('Could not load this request. Please try again.', 502);
  }
}

export async function PUT(request: Request) {
  if (!allowRequest('help-reply', clientKey(request))) return err('Too many requests. Please wait a minute.', 429);
  const body = await request.json().catch(() => null);
  if (typeof body?.code !== 'string' || !CODE.test(body.code) || !isOneOf(HELP_REPLIES, body.reply)) return err('Invalid request', 400);
  try {
    const store = getHelpStore();
    const row = await store.get(body.code);
    if (!row) return err(GONE, 404);
    // The helper can add care, never wave a HIGH_RISK through (monotonic verdict).
    if (body.reply === 'GENUINE' && row.verdict === 'HIGH_RISK') return err('This message is high risk, so it cannot be marked genuine.', 400);
    if (!(await store.setReply(body.code, body.reply))) return err('This request has already been answered.', 409);
    return Response.json({ ok: true });
  } catch {
    return err('Could not send your answer. Please call them instead.', 502);
  }
}

const err = (error: string, status: number) => Response.json({ error }, { status });
const newCode = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0');

// Strict 3 per IP per minute, like /api/alert: each request reaches a real phone and costs a scan.
export async function POST(request: Request) {
  if (!allowRequest('help', clientKey(request), 3)) return err('Too many requests. Please wait a minute.', 429);
  const body = await request.json().catch(() => null);
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  const { elderName, to, sender, verdict } = body ?? {};
  if (!text || text.length > LIMITS.text) return err(`Please paste a message (1-${LIMITS.text} characters).`, 400);
  if (sender != null && (typeof sender !== 'string' || sender.length > LIMITS.sender)) return err('The sender is not valid.', 400);
  if (!isOneOf(VERDICTS, verdict)) return err('Invalid request', 400);
  let code = newCode();
  try {
    if (typeof elderName !== 'string' || typeof to !== 'string') throw new Error('Invalid request');
    buildTemplatePayload('help_request', to, [elderName.trim(), code], 'live'); // validates the number and the name (single line, no link, ≤ 30)
  } catch (e) {
    return err((e as Error).message, 400);
  }
  try {
    // Re-scan on the server: a client could send a fake SAFE. `atLeast` keeps what the elder saw (it can only raise).
    const scan = await runScanPipeline({ text, sender: sender?.trim() || undefined, atLeast: verdict });
    const token = crypto.randomUUID() + crypto.randomUUID();
    const row = { token, elderName: elderName.trim(), text: redact(text), verdict: scan.verdict, flags: scan.flags, advice: scan.advice, reply: null, createdAt: Date.now() };
    const store = getHelpStore();
    // shortcut: 3 tries on a live-code collision (1 in 10^6 each); fine below thousands of open requests.
    let added = await store.add({ ...row, code });
    for (let i = 0; !added && i < 2; i++) added = await store.add({ ...row, code: (code = newCode()) });
    if (!added) throw new Error('code collision');
    const sent = await sendTemplate('help_request', to, [row.elderName, code]);
    return Response.json({ code, token, sent });
  } catch (e) {
    console.error('help failed', e instanceof Error ? e.name : 'unknown'); // never the text, the number or the code
    return err('Could not reach your helper right now. If unsure, do not click links or share codes.', 502);
  }
}
