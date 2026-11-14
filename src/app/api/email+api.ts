import { allowRequest, clientKey } from '@/lib/rate-limit';
import { scanEmail } from '@/lib/scan-pipeline';
import { LIMITS, type EmailResult } from '@/shared/types';

export async function POST(request: Request) {
  if (!allowRequest('email', clientKey(request))) {
    return Response.json({ error: 'Too many requests. Please wait a minute.' }, { status: 429, headers: { 'Retry-After': '60' } });
  }
  const body = await request.json().catch(() => null);
  const raw = typeof body?.raw === 'string' ? body.raw : '';
  if (!raw.trim() || raw.length > LIMITS.emailRaw)
    return Response.json({ error: `Please paste the email headers or the whole email (up to ${LIMITS.emailRaw / 1000} KB).` }, { status: 400 });
  try {
    return Response.json((await scanEmail(raw)) as EmailResult); // emailFacts set → importance always present
  } catch (e) {
    console.error('email scan failed', e instanceof Error ? e.name : 'unknown'); // never log the email (or an error that may quote it)
    return Response.json({ error: 'Could not check this email right now. If unsure, do not click links or reply.' }, { status: 502 });
  }
}
