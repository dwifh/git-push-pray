// Server-only. Jev via OpenRouter's Decisions API (alpha; shape may change — verify against current docs).
// Verified 2026-11-13: noul answers carry `noul` only; choice answers carry `choice`, `probabilities`, `confidence`.
export type JevQuestion =
  | { type: 'choice'; instructions: string; criteria: Record<string, string> }
  | { type: 'noul'; instructions: string; criteria?: { false: string; true: string } };

export type JevAnswers = Record<string, { type: string; choice?: string; noul?: number; confidence?: number }>;

export const JEV_MODEL = 'typesafe/jev-1.13';

export async function callJevDecision(state: unknown, questions: Record<string, JevQuestion>): Promise<JevAnswers> {
  const res = await fetch('https://openrouter.ai/api/alpha/decisions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: JEV_MODEL, state, questions }),
    signal: AbortSignal.timeout(5000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Jev decision failed ${res.status}: ${JSON.stringify(data?.error ?? data)}`);
  return data.answers as JevAnswers;
}
