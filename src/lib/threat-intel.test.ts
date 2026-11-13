// Run: node src/lib/threat-intel.test.ts
import assert from 'node:assert/strict';
import { checkDomain, intelLevel, refang } from './threat-intel.ts';
import { Level } from './verdict.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const vt = (malicious: number, suspicious = 0) => json({ data: { attributes: { last_analysis_stats: { malicious, suspicious } } } });

// Fake fetch: answers by host; records every URL it was asked for.
function fake(vtRes: () => Response, uhRes: () => Response) {
  const calls: string[] = [];
  const fn = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push(`${url} ${init?.body ?? ''}`);
    return String(url).includes('virustotal') ? vtRes() : uhRes();
  }) as typeof fetch;
  return { fn, calls };
}

// refang undoes the defanging in data/eval/domains.jsonl
assert.equal(refang('acd[.]munber[.]life'), 'acd.munber.life');

// Known-bad: VT malicious >= 2 and URLhaus listed → HIGH_RISK
{
  const { fn, calls } = fake(() => vt(5), () => json({ query_status: 'ok' }));
  const r = await checkDomain('Bad-One.example.', { fetch: fn });
  assert.deepEqual(r, { vt: { malicious: 5, suspicious: 0 }, urlhaus: 'listed' });
  assert.equal(intelLevel('bad-one.example', r), Level.HIGH_RISK);
  assert.ok(calls.some((c) => c.includes('/domains/bad-one.example')), 'VT gets the normalised domain only');
  assert.ok(calls.some((c) => c.includes('host=bad-one.example')), 'URLhaus gets the host only');
}

// Known-good: no hits → SAFE
{
  const { fn } = fake(() => vt(0), () => json({ query_status: 'no_results' }));
  const r = await checkDomain('good.example', { fetch: fn });
  assert.equal(r.urlhaus, 'not_listed');
  assert.equal(intelLevel('good.example', r), Level.SAFE);
}

// Weak VT signal (two votes) → SUSPICIOUS; one lone engine is noise (google.com had malicious 1)
assert.equal(intelLevel('x.example', { vt: { malicious: 1, suspicious: 1 }, urlhaus: 'unknown' }), Level.SUSPICIOUS);
assert.equal(intelLevel('x.example', { vt: { malicious: 0, suspicious: 2 }, urlhaus: 'unknown' }), Level.SUSPICIOUS);
assert.equal(intelLevel('google.com', { vt: { malicious: 1, suspicious: 0 }, urlhaus: 'not_listed' }), Level.SAFE);

// SHARED_HOSTS cap: a hit on github.com is only SUSPICIOUS; a per-tenant subdomain stays HIGH_RISK
const hit = { vt: { malicious: 9, suspicious: 0 }, urlhaus: 'listed' } as const;
assert.equal(intelLevel('github.com', hit), Level.SUSPICIOUS);
assert.equal(intelLevel('drive.google.com', hit), Level.SUSPICIOUS);
assert.equal(intelLevel('evil.workers.dev', hit), Level.HIGH_RISK);
assert.equal(intelLevel('evil.pages.dev', hit), Level.HIGH_RISK);

// Failures → unknown, never throws, adds no level
{
  const { fn } = fake(() => json({}, 500), () => { throw new Error('network'); });
  const r = await checkDomain('fail.example', { fetch: fn });
  assert.deepEqual(r, { vt: 'unknown', urlhaus: 'unknown' });
  assert.equal(intelLevel('fail.example', r), Level.SAFE);
}

// Forced timeout → unknown without throwing
{
  const hang = ((_u: unknown, init?: RequestInit) =>
    new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal!.reason)))) as typeof fetch;
  const keepAlive = setTimeout(() => {}, 5000); // AbortSignal.timeout is unref'd; keep node alive
  const t0 = Date.now();
  const r = await checkDomain('slow.example', { fetch: hang, timeoutMs: 50 });
  assert.deepEqual(r, { vt: 'unknown', urlhaus: 'unknown' });
  assert.ok(Date.now() - t0 < 1000);
  clearTimeout(keepAlive);
}

// Not a bare domain (full URL, path, port) → unknown, nothing is sent
{
  const { fn, calls } = fake(() => vt(9), () => json({ query_status: 'ok' }));
  for (const d of ['https://evil.example/pay', 'evil.example/pay', 'evil.example:8080', '', 'nodot'])
    assert.deepEqual(await checkDomain(d, { fetch: fn }), { vt: 'unknown', urlhaus: 'unknown' }, d);
  assert.equal(calls.length, 0);
}

// Cache: a second lookup does not call out again; unknown results are not cached
{
  const { fn, calls } = fake(() => vt(0), () => json({ query_status: 'no_results' }));
  await checkDomain('cached.example', { fetch: fn });
  await checkDomain('cached.example', { fetch: fn });
  assert.equal(calls.length, 2, 'one VT + one URLhaus call');
  const f2 = fake(() => json({}, 500), () => json({}, 500));
  await checkDomain('retry.example', { fetch: f2.fn });
  await checkDomain('retry.example', { fetch: f2.fn });
  assert.equal(f2.calls.length, 4, 'unknown is retried');
}

console.log('threat-intel ok');
