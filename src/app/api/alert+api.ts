// Outbound WhatsApp alert to the trusted contact (PLAN §7.1, D10). The number is never stored or logged.
import { allowRequest, clientKey } from '@/lib/rate-limit';
import { buildTemplatePayload, sendTemplate } from '@/lib/whatsapp';

// Strict 3 per IP per minute (PLAN §7.1): each alert reaches a real phone.
export async function POST(request: Request) {
  if (!allowRequest('alert', clientKey(request), 3)) return Response.json({ error: 'Too many alerts. Please wait a minute.' }, { status: 429 });
  let template: unknown, to: unknown, vars: unknown;
  try {
    ({ template, to, vars } = (await request.json()) ?? {});
    if (typeof template !== 'string' || typeof to !== 'string' || !Array.isArray(vars) || !vars.every((v) => typeof v === 'string')) {
      throw new Error('Invalid request');
    }
    buildTemplatePayload(template, to, vars, 'live'); // validates allowlisted template, E.164 digits and every variable
  } catch (e) {
    return Response.json({ error: e instanceof SyntaxError ? 'Invalid request' : (e as Error).message }, { status: 400 });
  }
  try {
    const sent = await sendTemplate(template, to, vars);
    return Response.json(sent ? { sent: true } : { sent: false, fallback: 'wa.me' });
  } catch {
    return Response.json({ sent: false, fallback: 'wa.me' });
  }
}
