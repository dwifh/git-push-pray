import { allowRequest, clientKey } from '@/lib/rate-limit';
import { runScanPipeline } from '@/lib/scan-pipeline';
import { LIMITS } from '@/shared/types';

export async function POST(request: Request) {
  if (!allowRequest('scan', clientKey(request))) {
    return Response.json({ error: 'Too many requests. Please wait a minute.' }, { status: 429, headers: { 'Retry-After': '60' } });
  }
  const body = await request.json().catch(() => null);
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text || text.length > LIMITS.text) return Response.json({ error: `Please paste a message (1-${LIMITS.text} characters).` }, { status: 400 });
  if (body.sender != null && (typeof body.sender !== 'string' || body.sender.length > LIMITS.sender))
    return Response.json({ error: `The sender must be text of at most ${LIMITS.sender} characters.` }, { status: 400 });
  try {
    return Response.json(await runScanPipeline({ text, sender: body.sender?.trim() || undefined }));
  } catch (e) {
    console.error('scan failed', e instanceof Error ? e.name : 'unknown'); // never log the message text (or an error that may quote it)
    return Response.json({ error: 'Could not check this right now. If unsure, do not click links or share codes.' }, { status: 502 });
  }
}
