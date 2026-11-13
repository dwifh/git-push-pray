# Ported Code

Working code from the day-0 prototype, adapted to the scam pipeline. Copy the files still listed here as-is, then build on them. Tests run with plain Node (type stripping, Node ≥ 22.18) and `node:assert`, with no test framework.

## Already landed (2026-11-13): the repo is the source of truth

`src/lib/jev.ts` and `src/lib/scam-signals.ts` (+ test) were copied in and have since changed, so their old copies are removed from this file. Read the code itself. What changed:
- `scam-signals.ts`: `scamScore(p, weights = PLAN_WEIGHTS)` takes calibrated weights; `PLAN_WEIGHTS`, `SIGNAL_NAMES` and `signalValue` are exported. `SUSPICIOUS_CUTOFF` / `HIGH_RISK_CUTOFF` are gone: the cutoffs live in `src/lib/calibration.json` and are applied by `verdict.ts` `jevLevel` (PLAN §3.6).
- `jev.ts`: unchanged apart from a note on the response shape verified on 2026-11-13 (`noul` answers carry only `noul`; `choice` answers add `probabilities` and `confidence`).
- `src/shared/coach.ts` reuses the same noisy-OR shape with the coach questions from PLAN §4. Its cutoff stays fixed: the coach is not calibrated.

## `package.json` scripts
`test`, `fetch-data`, `build-url-data` and `eval` already exist. Still to add:
```json
"seed": "node --env-file=.env scripts/seed-knowledge.mjs"
```
Append each new `*.test.ts` to `test` as it is written (for example `node src/lib/rate-limit.test.ts`).

## `src/lib/rate-limit.ts` (ported; buckets are now per route)
```ts
// shortcut: in-memory sliding window per server instance; resets on restart, not shared across instances. Move to a KV/Redis store when deployed multi-instance.
const WINDOW_MS = 60_000;
// On globalThis because the Expo dev server re-evaluates API route modules per request.
const store = globalThis as { __rateLimitHits?: Map<string, number[]> };
const hits = (store.__rateLimitHits ??= new Map<string, number[]>());

// Per-user and global buckets are per route, so scans never eat the strict /api/alert allowance.
export function allowRequest(
  route: string,
  ip: string,
  perUser = Number(process.env.ALERTS_RATE_LIMIT_PER_USER_PER_MINUTE) || 10,
  global = Number(process.env.ALERTS_RATE_LIMIT_GLOBAL_PER_MINUTE) || 60,
  now = Date.now(),
) {
  const key = `${route}:${ip}`;
  const globalKey = `${route}:\0global`;
  const recent = (k: string) => (hits.get(k) ?? []).filter((t) => t > now - WINDOW_MS);
  const user = recent(key);
  const all = recent(globalKey);
  const ok = user.length < perUser && all.length < global;
  if (ok) {
    user.push(now);
    all.push(now);
  }
  hits.set(key, user);
  hits.set(globalKey, all);
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
assert.equal(allowRequest('scan', 'a', 2, 10, t), true);
assert.equal(allowRequest('scan', 'a', 2, 10, t + 1), true);
assert.equal(allowRequest('scan', 'a', 2, 10, t + 2), false, 'per-user cap');
assert.equal(allowRequest('alert', 'a', 2, 10, t + 2), true, 'other routes keep their own per-user bucket');
assert.equal(allowRequest('scan', 'b', 2, 10, t + 3), true, 'other users unaffected');
assert.equal(allowRequest('scan', 'a', 2, 10, t + 60_001), true, 'window slides');
// Global cap on 'scan': 'a' (t+60_001) and 'b' (t+3) are both still in window -> 2 of 3 used.
assert.equal(allowRequest('scan', 'c', 5, 3, t + 60_002), true);
assert.equal(allowRequest('scan', 'd', 5, 3, t + 60_002), false, 'global cap');
assert.equal(allowRequest('alert', 'd', 5, 3, t + 60_002), true, 'global cap is per route');
console.log('rate-limit ok');
```

## `src/lib/rag.ts` (landed 2026-11-13, since changed: injectable `fetch`/`kb`/`timeoutMs`, returns `[]` on any failure, results carry `id` + `institution`; the repo is the source of truth)
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
  // Route name scopes the buckets. /api/alert passes a strict cap: allowRequest('alert', clientKey(request), 3).
  if (!allowRequest('scan', clientKey(request))) {
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
