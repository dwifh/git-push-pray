// GET → Feed data (last 7 days). POST → anonymous community report (PLAN §5). Raw text is never logged.
import { allowRequest, clientKey } from '@/lib/rate-limit';
import { WEEK, getStore, hashReporter, trending, validateReport } from '@/lib/reports';

export async function GET(request: Request) {
  if (!allowRequest('reports-get', clientKey(request))) return Response.json({ error: 'Too many requests. Please wait a minute.' }, { status: 429 });
  try {
    const now = Date.now();
    return Response.json(trending(await getStore().since(now - WEEK), now));
  } catch {
    return Response.json({ error: 'Could not load the scam feed. Please try again.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const ip = clientKey(request);
  if (!allowRequest('reports', ip)) return Response.json({ error: 'Too many reports. Please wait a minute.' }, { status: 429 });
  let report;
  try {
    report = validateReport(await request.json());
  } catch (e) {
    const msg = e instanceof SyntaxError ? 'Invalid request' : (e as Error).message;
    return Response.json({ error: msg }, { status: 400 });
  }
  try {
    await getStore().add({ ...report, reporterHash: await hashReporter(ip), createdAt: Date.now() });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'Could not save your report. Please try again.' }, { status: 500 });
  }
}
