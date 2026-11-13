// Optional Coach free text → redact → one Jev call → { score } (PLAN §4). The screen takes the max with its own score.
import calibrationJson from '@/lib/calibration.json';
import { callJevDecision, type JevQuestion } from '@/lib/jev';
import { allowRequest, clientKey } from '@/lib/rate-limit';
import { redact } from '@/lib/redact';
import { SIGNAL_NAMES, SIGNALS, scamScore } from '@/lib/scam-signals';
import { loadCalibration } from '@/lib/verdict';

const QUESTIONS = Object.fromEntries(
  SIGNAL_NAMES.map((n) => [n, { type: 'noul', instructions: SIGNALS[n].question } satisfies JevQuestion]),
);
const weights = loadCalibration(calibrationJson).jev.weights;

export async function POST(request: Request) {
  if (!allowRequest('coach', clientKey(request))) return Response.json({ error: 'Too many requests. Please wait a minute.' }, { status: 429 });
  let text: unknown;
  try {
    text = (await request.json())?.text;
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }
  if (typeof text !== 'string' || !text.trim() || text.length > 2000) {
    return Response.json({ error: 'Please type what the caller said (up to 2000 characters).' }, { status: 400 });
  }
  try {
    const answers = await callJevDecision({ message: redact(text) }, QUESTIONS);
    const p = Object.fromEntries(SIGNAL_NAMES.map((n) => [n, answers?.[n]?.noul]));
    return Response.json({ score: scamScore(p, weights) });
  } catch {
    // Jev down: add nothing; the on-device score still decides (D4).
    return Response.json({ score: 0 });
  }
}
