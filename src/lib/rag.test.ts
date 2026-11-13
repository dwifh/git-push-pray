// Run: node src/lib/rag.test.ts
import assert from 'node:assert/strict';
import { searchKnowledgeBase } from './rag.ts';

const kb = {
  model: 'test-model',
  chunks: [
    { id: 'a', title: 'Parcel fee', text: 'pay customs fee', institution: 'Mauritius Post', source: 's', embedding: [1, 0] },
    { id: 'b', title: 'Bank OTP', text: 'share your OTP', institution: 'MCB', source: 's', embedding: [0, 1] },
    { id: 'c', title: 'Mixed', text: 'both', institution: 'Other', source: 's', embedding: [1, 1] },
  ],
};
const embedFetch = (vec: number[]) => {
  const bodies: any[] = [];
  const fn = (async (_u: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ data: [{ embedding: vec }] }));
  }) as typeof fetch;
  return { fn, bodies };
};

// Ranked by cosine, top k, embedded with the seeded model, long queries truncated
{
  const { fn, bodies } = embedFetch([1, 0]);
  const r = await searchKnowledgeBase('x'.repeat(5000), 2, { fetch: fn, kb });
  assert.deepEqual(r.map((m) => [m.id, m.score]), [['a', 1], ['c', 0.707]]);
  assert.equal(r[0].institution, 'Mauritius Post');
  assert.equal(bodies[0].model, 'test-model');
  assert.equal(bodies[0].input.length, 2000);
}

// HTTP error, bad body, network error → empty, never throws
for (const fn of [
  (async () => new Response('{}', { status: 500 })) as typeof fetch,
  (async () => new Response('not json')) as typeof fetch,
  (async () => { throw new Error('down'); }) as typeof fetch,
]) assert.deepEqual(await searchKnowledgeBase('q', 3, { fetch: fn, kb }), []);

// Forced timeout → empty
{
  const keepAlive = setTimeout(() => {}, 5000); // AbortSignal.timeout is unref'd; keep node alive
  const hang = ((_u: unknown, init?: RequestInit) =>
    new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal!.reason)))) as typeof fetch;
  assert.deepEqual(await searchKnowledgeBase('q', 3, { fetch: hang, kb, timeoutMs: 50 }), []);
  clearTimeout(keepAlive);
}

// The seeded vectors load and are well formed
{
  const { default: real } = await import('../../data/knowledge-vectors.json', { with: { type: 'json' } });
  assert.ok(real.chunks.length >= 10);
  for (const c of real.chunks) assert.ok(c.id && c.title && c.text && c.institution && c.source && c.embedding.length > 0, c.id);
}

console.log('rag ok');
