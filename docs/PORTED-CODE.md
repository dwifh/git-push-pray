# Ported Code

Working code from the day-0 prototype, adapted to the scam pipeline. Copy the files still listed here as-is, then build on them. Tests run with plain Node (type stripping, Node ≥ 22.18) and `node:assert`, with no test framework.

## Already landed (2026-11-13): the repo is the source of truth

`src/lib/jev.ts` and `src/lib/scam-signals.ts` (+ test) were copied in and have since changed, so their old copies are removed from this file. Read the code itself. What changed:
- `scam-signals.ts`: `scamScore(p, weights = PLAN_WEIGHTS)` takes calibrated weights; `PLAN_WEIGHTS`, `SIGNAL_NAMES` and `signalValue` are exported. `SUSPICIOUS_CUTOFF` / `HIGH_RISK_CUTOFF` are gone: the cutoffs live in `src/lib/calibration.json` and are applied by `verdict.ts` `jevLevel` (PLAN §3.6).
- `jev.ts`: unchanged apart from a note on the response shape verified on 2026-11-13 (`noul` answers carry only `noul`; `choice` answers add `probabilities` and `confidence`).
- `src/lib/rate-limit.ts` (+ test): ported unchanged (per-route buckets, `clientKey` trusts only `cf-connecting-ip`).
- **Route pattern**: copy `src/app/api/scan+api.ts` (rate limit → validate with `LIMITS` from `src/shared/types.ts`, rejecting over-long fields → try/catch that logs only `e.name`, never the text or `e.message`). It replaces the old skeleton.
- `src/shared/coach.ts` reuses the same noisy-OR shape with the coach questions from PLAN §4. Its cutoff stays fixed: the coach is not calibrated.

## `package.json` scripts
`test`, `fetch-data`, `build-url-data` and `eval` already exist. Still to add:
```json
"seed": "node --env-file=.env scripts/seed-knowledge.mjs"
```
Append each new `*.test.ts` to `test` as it is written (for example `node src/lib/rate-limit.test.ts`).

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
