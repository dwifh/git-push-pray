# Ported Code

Working code from the day-0 prototype, adapted to the scam pipeline. Copy these files as-is, then build on them. Tests run with plain Node (type stripping, Node ≥ 22.18) and `node:assert`, with no test framework.

## `package.json` scripts
```json
"seed": "node --env-file=.env scripts/seed-knowledge.mjs",
"test": "node src/lib/rate-limit.test.ts && node src/lib/scam-signals.test.ts"
```
Append each new `*.test.ts` to `test` as it is written.

## `src/lib/jev.ts`
```ts
// Server-only. Jev via OpenRouter's Decisions API (alpha; shape may change — verify against current docs).
export type JevQuestion =
  | { type: 'choice'; instructions: string; criteria: Record<string, string> }
  | { type: 'noul'; instructions: string; criteria?: { false: string; true: string } };

export type JevAnswers = Record<string, { type: string; choice?: string; noul?: number; confidence?: number }>;

export async function callJevDecision(state: unknown, questions: Record<string, JevQuestion>): Promise<JevAnswers> {
  const res = await fetch('https://openrouter.ai/api/alpha/decisions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'typesafe/jev-1.13', state, questions }),
    signal: AbortSignal.timeout(5000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Jev decision failed ${res.status}: ${JSON.stringify(data?.error ?? data)}`);
  return data.answers as JevAnswers;
}
```
`noul` is a probability (0–1) that the answer is "true".

## `src/lib/scam-signals.ts` (adapted from the old `triage.ts`)
```ts
// Pure rules (no imports) so they can be tested with plain Node.
export const SIGNALS = {
  asksForSecret: { weight: 1, question: 'Does the message ask for an OTP, PIN, password, card number or bank login?' },
  paymentRequest: { weight: 0.7, question: 'Does it ask the reader to pay, transfer money or buy vouchers or gift cards?' },
  impersonation: {
    weight: 0.6,
    question: 'Does it claim to be from a bank, Mauritius Post, CEB, CWA, MRA, Police, a telecom company or a family member?',
  },
  pressure: { weight: 0.5, question: 'Does it threaten, rush or create panic?' },
  tooGoodToBeTrue: { weight: 0.4, question: 'Does it promise a prize, refund, job or investment return?' },
} as const;

export type SignalName = keyof typeof SIGNALS;
export const SUSPICIOUS_CUTOFF = 0.6;
export const HIGH_RISK_CUTOFF = 0.85;

// Noisy-OR: score = 1 - Π(1 - weight·p). One strong signal is enough; weak ones add up.
// A missing signal counts as 1: fail closed, an unchecked message is never called safe.
export function scamScore(p: Partial<Record<SignalName, number>>) {
  let safe = 1;
  for (const name of Object.keys(SIGNALS) as SignalName[]) {
    const prob = Math.min(1, Math.max(0, p[name] ?? 1));
    safe *= 1 - SIGNALS[name].weight * prob;
  }
  return Math.round((1 - safe) * 1000) / 1000;
}

const CLARIFY: Record<string, string> = {
  sender: 'Who sent this? Add the number or name shown.',
  link: 'Please paste the whole message, including any link.',
  full_text: 'This looks cut off. Please paste the whole message.',
};

// Never stall a clear scam with a question: HIGH_RISK answers first.
export function clarifyFor(t: { floorIsHighRisk: boolean; isFragment: boolean; missingField: string }) {
  return !t.floorIsHighRisk && t.isFragment && Object.hasOwn(CLARIFY, t.missingField) ? CLARIFY[t.missingField] : undefined;
}
```

`src/lib/scam-signals.test.ts` (starting point):
```ts
// Run: node src/lib/scam-signals.test.ts
import assert from 'node:assert/strict';
import { HIGH_RISK_CUTOFF, SUSPICIOUS_CUTOFF, clarifyFor, scamScore } from './scam-signals.ts';

const none = { asksForSecret: 0, paymentRequest: 0, impersonation: 0, pressure: 0, tooGoodToBeTrue: 0 };
assert.equal(scamScore(none), 0);
assert.ok(scamScore({ ...none, asksForSecret: 0.9 }) >= HIGH_RISK_CUTOFF, 'secret request alone is high risk');
assert.ok(scamScore({ ...none, pressure: 0.8 }) < SUSPICIOUS_CUTOFF, 'pressure alone is not');
assert.ok(scamScore({ ...none, impersonation: 0.7, pressure: 0.7, paymentRequest: 0.5 }) >= SUSPICIOUS_CUTOFF, 'signals add up');
assert.equal(scamScore({}), 1, 'missing signals fail closed');
assert.equal(scamScore({ ...none, asksForSecret: 7 }), 1, 'out-of-range input is clamped');

assert.equal(clarifyFor({ floorIsHighRisk: true, isFragment: true, missingField: 'sender' }), undefined, 'never stall high risk');
assert.match(clarifyFor({ floorIsHighRisk: false, isFragment: true, missingField: 'sender' }) ?? '', /Who sent this/);
assert.equal(clarifyFor({ floorIsHighRisk: false, isFragment: true, missingField: 'none' }), undefined);
assert.equal(clarifyFor({ floorIsHighRisk: false, isFragment: false, missingField: 'link' }), undefined);
assert.equal(clarifyFor({ floorIsHighRisk: false, isFragment: true, missingField: 'constructor' }), undefined);
console.log('scam-signals ok');
```
`src/shared/coach.ts` reuses the same noisy-OR shape with the coach questions from PLAN §4.

## `src/lib/rate-limit.ts` (unchanged)
```ts
// shortcut: in-memory sliding window per server instance; resets on restart, not shared across instances. Move to a KV/Redis store when deployed multi-instance.
const WINDOW_MS = 60_000;
const GLOBAL = '\0global';
// On globalThis because the Expo dev server re-evaluates API route modules per request.
const store = globalThis as { __rateLimitHits?: Map<string, number[]> };
const hits = (store.__rateLimitHits ??= new Map<string, number[]>());

export function allowRequest(
  key: string,
  perUser = Number(process.env.ALERTS_RATE_LIMIT_PER_USER_PER_MINUTE) || 5,
  global = Number(process.env.ALERTS_RATE_LIMIT_GLOBAL_PER_MINUTE) || 60,
  now = Date.now(),
) {
  const recent = (k: string) => (hits.get(k) ?? []).filter((t) => t > now - WINDOW_MS);
  const user = recent(key);
  const all = recent(GLOBAL);
  const ok = user.length < perUser && all.length < global;
  if (ok) {
    user.push(now);
    all.push(now);
  }
  hits.set(key, user);
  hits.set(GLOBAL, all);
  // Bound memory when many distinct keys show up.
  if (hits.size > 10_000) for (const [k, ts] of hits) if (!ts.some((t) => t > now - WINDOW_MS)) hits.delete(k);
  return ok;
}

// Only trust Cloudflare's header (set by EAS Hosting; clients can't forge it there). x-forwarded-for is client-controlled.
// Without it (local dev) everyone shares one key.
export function clientKey(request: Request) {
  return request.headers.get('cf-connecting-ip') ?? 'anonymous';
}
```

`src/lib/rate-limit.test.ts`:
```ts
// Run: node src/lib/rate-limit.test.ts
import assert from 'node:assert/strict';
import { allowRequest } from './rate-limit.ts';

const t = 1_000_000;
assert.equal(allowRequest('a', 2, 10, t), true);
assert.equal(allowRequest('a', 2, 10, t + 1), true);
assert.equal(allowRequest('a', 2, 10, t + 2), false, 'per-user cap');
assert.equal(allowRequest('b', 2, 10, t + 3), true, 'other users unaffected');
assert.equal(allowRequest('a', 2, 10, t + 60_001), true, 'window slides');
// Global cap: 'a' (t+60_001) and 'b' (t+3) are both still in window -> 2 of 3 used.
assert.equal(allowRequest('c', 5, 3, t + 60_002), true);
assert.equal(allowRequest('d', 5, 3, t + 60_002), false, 'global cap');
console.log('rate-limit ok');
```

## `src/lib/rag.ts` (unchanged)
```ts
// Server-only. Vectors and their model come from `npm run seed` (scripts/seed-knowledge.mjs).
import kb from '../../data/knowledge-vectors.json';

function cosine(a: number[], b: number[]) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na * nb) || 1);
}

export async function searchKnowledgeBase(query: string, k = 3) {
  const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: kb.model, input: query.slice(0, 2000) }),
    signal: AbortSignal.timeout(3000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Embedding failed ${res.status}`);
  const q: number[] = data.data[0].embedding;
  return kb.chunks
    .map((c) => ({ title: c.title, text: c.text, score: +cosine(q, c.embedding).toFixed(3) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
```
Callers pass **redacted** text only.

## `scripts/seed-knowledge.mjs` (unchanged)
```js
// Embeds data/knowledge-base.json into data/knowledge-vectors.json. Run: npm run seed
import { readFileSync, writeFileSync } from 'node:fs';

const EMBEDDING_MODEL = 'openai/text-embedding-3-small';
const chunks = JSON.parse(readFileSync('data/knowledge-base.json', 'utf8'));

const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
  method: 'POST',
  headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: EMBEDDING_MODEL, input: chunks.map((c) => `${c.title}\n${c.text}`) }),
});
const data = await res.json();
if (!res.ok) throw new Error(`Embedding failed ${res.status}: ${JSON.stringify(data)}`);

const vectors = chunks.map((c, i) => ({ ...c, embedding: data.data.find((d) => d.index === i).embedding.map((x) => +x.toFixed(5)) }));
// rag.ts reads the model from here so queries are embedded the same way.
writeFileSync('data/knowledge-vectors.json', JSON.stringify({ model: EMBEDDING_MODEL, chunks: vectors }));
console.log(`Embedded ${vectors.length} chunks with ${EMBEDDING_MODEL}`);
```

## API route skeleton (pattern for every route)
```ts
import { allowRequest, clientKey } from '@/lib/rate-limit';
import { runScanPipeline } from '@/lib/scan-pipeline';

export async function POST(request: Request) {
  if (!allowRequest(clientKey(request))) {
    return Response.json({ error: 'Too many requests. Please wait a minute.' }, { status: 429, headers: { 'Retry-After': '60' } });
  }
  const body = await request.json().catch(() => null);
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text || text.length > 4000) return Response.json({ error: 'text (1-4000 chars) is required' }, { status: 400 });
  const sender = typeof body.sender === 'string' ? body.sender.slice(0, 100) : undefined;
  try {
    return Response.json(await runScanPipeline({ text, sender }));
  } catch (e) {
    console.error('scan failed', e instanceof Error ? e.message : 'unknown'); // never log the message text
    return Response.json({ error: 'Could not check this right now. If unsure, do not click links or share codes.' }, { status: 502 });
  }
}
```
