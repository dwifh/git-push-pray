// Run: node --import ./scripts/alias-hook.mjs src/lib/routes.test.ts
// Route handlers end to end (TEAM-PLAN §3) with global fetch stubbed: no real network.
// Lives in src/lib, not next to the routes: Expo Router would treat a file in src/app as a route.
import assert from 'node:assert/strict';
import { POST as alert } from '../app/api/alert+api.ts';
import { POST as coach } from '../app/api/coach+api.ts';
import { POST as email } from '../app/api/email+api.ts';
import { GET as feed, POST as report } from '../app/api/reports+api.ts';
import { memoryStore, type ReportRow, type Store } from './reports.ts';
import { LIVE_DEPS } from './scan-pipeline.ts';

delete process.env.TURSO_DATABASE_URL; // never reach the real DB, even if a test moves above setStore()
Object.assign(process.env, {
  ALERTS_RATE_LIMIT_PER_USER_PER_MINUTE: '10',
  ALERTS_RATE_LIMIT_GLOBAL_PER_MINUTE: '60',
  HASH_SALT: 'test-salt',
  WHATSAPP_TOKEN: 'test-token',
  WHATSAPP_APP_SECRET: 'test-secret',
  WHATSAPP_PHONE_NUMBER_ID: '123',
  WHATSAPP_TEMPLATE_MODE: 'test',
});

const post = (body: unknown, ip: string) =>
  new Request('http://x/api', { method: 'POST', headers: { 'cf-connecting-ip': ip }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const send = async (res: Response | Promise<Response>) => {
  const r = await res;
  return { status: r.status, body: await r.json() };
};
// Every error is a friendly { error } (TEAM-PLAN §3), never JS internals.
const assertError = (r: { status: number; body: { error?: unknown } }, status: number, why: string) => {
  assert.equal(r.status, status, why);
  assert.equal(typeof r.body.error, 'string', why);
  assert.doesNotMatch(String(r.body.error), /destructure|undefined|null|property/i, why);
};
const assertRejects = async (handler: (r: Request) => Promise<Response>, cases: [unknown, string][]) => {
  for (const [body, why] of cases) assertError(await send(handler(post(body, `bad-${why}`))), 400, why);
};
// Rate-limit buckets are per IP, so each case below uses its own IP.

// Every outbound call goes through this stub; `reply` decides what the "network" returns.
let reply: (url: string, init: RequestInit) => Response | Promise<Response> = () => {
  throw new Error('unexpected fetch');
};
const fetched: { url: string; init: RequestInit }[] = [];
globalThis.fetch = (async (url: string, init: RequestInit) => {
  fetched.push({ url: String(url), init });
  return reply(String(url), init);
}) as typeof fetch;

// /api/alert: bad input → 400 { error }, nothing sent.
const validAlert = { template: 'call_alert', to: '23057123456', vars: ['Asha', 'They asked for your OTP'] };
await assertRejects(alert, [
  ['{not json', 'malformed JSON'],
  ['null', 'null body'],
  [{ ...validAlert, template: 'nope' }, 'unknown template'],
  [{ ...validAlert, to: '+230 5712' }, 'non-E.164 number'],
  [{ ...validAlert, vars: ['Asha', 'go to evil.com'] }, 'domain in a variable'],
  [{ ...validAlert, vars: 'Asha' }, 'vars not an array'],
]);
assert.equal(fetched.length, 0, 'invalid input never reaches Meta');

// Meta accepts → { sent: true }; the call is signed with appsecret_proof and carries the token.
reply = () => new Response('{}', { status: 200 });
assert.deepEqual(await send(alert(post(validAlert, 'a2'))), { status: 200, body: { sent: true } });
assert.match(fetched[0].url, /^https:\/\/graph\.facebook\.com\/v\d+\.0\/.*\/messages\?appsecret_proof=[0-9a-f]{64}$/);
assert.equal(JSON.parse(String(fetched[0].init.body)).to, '23057123456');
assert.equal(new Headers(fetched[0].init.headers).get('authorization'), 'Bearer test-token');

// Meta rejects (bad token) or the network fails → wa.me fallback, still 200 (TEAM-PLAN §3, PLAN step 8).
reply = () => new Response('{"error":{"code":190}}', { status: 401 });
assert.deepEqual(await send(alert(post(validAlert, 'a3'))), { status: 200, body: { sent: false, fallback: 'wa.me' } });
reply = () => Promise.reject(new TypeError('network down'));
assert.deepEqual(await send(alert(post(validAlert, 'a4'))), { status: 200, body: { sent: false, fallback: 'wa.me' } });

// Strict 3 per IP per minute (PLAN §7.1): the 4th → 429 { error }.
reply = () => new Response('{}', { status: 200 });
for (let i = 0; i < 3; i++) assert.equal((await send(alert(post(validAlert, 'a5')))).status, 200);
assertError(await send(alert(post(validAlert, 'a5'))), 429, 'alert rate limit');

// /api/coach: bad input → 400 { error }, Jev never called.
fetched.length = 0;
await assertRejects(coach, [
  ['{not json', 'malformed JSON'],
  ['null', 'null body'],
  [{}, 'missing text'],
  [{ text: '   ' }, 'blank text'],
  [{ text: 42 }, 'text not a string'],
  [{ text: 'a'.repeat(2001) }, 'over 2000 chars'],
]);
assert.equal(fetched.length, 0);

// Jev answers → { score }; only redacted text leaves the server.
const jev = (answers: Record<string, number>) => () =>
  Response.json({ answers: Object.fromEntries(Object.entries(answers).map(([k, noul]) => [k, { type: 'noul', noul }])) });
reply = jev({ asksForSecret: 1 });
const secret = await send(coach(post({ text: 'He said he is from MCB, call 5712 3456 and read me the OTP' }, 'c1')));
assert.equal(secret.status, 200);
assert.ok(secret.body.score > 0 && secret.body.score <= 1, 'a secret request raises the score (exact value depends on calibration)');
assert.match(fetched[0].url, /openrouter\.ai/);
assert.match(String(fetched[0].init.body), /\[PHONE\]/);
assert.doesNotMatch(String(fetched[0].init.body), /5712/, 'phone number redacted before egress');
reply = jev({ asksForSecret: 0, paymentRequest: 0, impersonation: 0, pressure: 0, tooGoodToBeTrue: 0 });
assert.deepEqual(await send(coach(post({ text: 'Just my cousin calling' }, 'c2'))), { status: 200, body: { score: 0 } });

// Jev down → { score: 0 }: adds nothing, the on-device score still decides (PLAN §4).
reply = () => new Response('{"error":"down"}', { status: 503 });
assert.deepEqual(await send(coach(post({ text: 'They want money now' }, 'c3'))), { status: 200, body: { score: 0 } });
reply = () => Promise.reject(new TypeError('network down'));
assert.deepEqual(await send(coach(post({ text: 'They want money now' }, 'c4'))), { status: 200, body: { score: 0 } });

// 10 per IP per minute → 429 { error }.
reply = jev({});
for (let i = 0; i < 10; i++) assert.equal((await send(coach(post({ text: 'hello' }, 'c5')))).status, 200);
assertError(await send(coach(post({ text: 'hello' }, 'c5'))), 429, 'coach rate limit');

// /api/reports: POST validates (400), stores a redacted row (ok: true), and GET shows it in the Feed.
const setStore = (s: Store) => ((globalThis as { __reportsStore?: Store }).__reportsStore = s);
const rows: ReportRow[] = [];
setStore(memoryStore(rows));
const get = (ip: string) => new Request('http://x/api/reports', { headers: { 'cf-connecting-ip': ip } });
assert.deepEqual(await send(feed(get('r0'))), { status: 200, body: { total: 0, byInstitution: [], byDistrict: [], topDomains: [] } });
const validReport = { institution: 'MAURITIUS_POST', vector: 'SMS', district: 'MOKA', domain: 'https://pay.parcel-track-mu.com/x', snippet: 'Pay Rs 50 at 5712 3456' };
await assertRejects(report, [
  ['{not json', 'malformed JSON'],
  ['null', 'null body'],
  [{ ...validReport, institution: 'NASA' }, 'unknown institution'],
  [{ ...validReport, domain: 'mcb.mu' }, 'official domain'],
]);
assert.deepEqual(await send(report(post(validReport, 'r1'))), { status: 200, body: { ok: true } });
assert.equal(rows.length, 1);
assert.equal(rows[0].snippet, 'Pay Rs 50 at [PHONE]', 'snippet redacted before it is stored');
assert.match(rows[0].reporterHash, /^[0-9a-f]{64}$/, 'only the salted IP hash is stored');
const shown = (await send(feed(get('r0')))).body;
assert.equal(shown.total, 1);
assert.deepEqual(shown.topDomains, [{ key: 'parcel-track-mu.com', count: 1 }]);
assert.deepEqual(shown.byInstitution, [{ key: 'MAURITIUS_POST', count: 1 }]);

// Store failure → 502 { error }.
setStore({ ...memoryStore([]), add: () => Promise.reject(new Error('down')), since: () => Promise.reject(new Error('down')) });
assertError(await send(report(post(validReport, 'r2'))), 502, 'report store down');
assertError(await send(feed(get('r2'))), 502, 'feed store down');

// 10 per IP per minute → 429, per route: the Feed GET has its own bucket.
setStore(memoryStore([]));
for (let i = 0; i < 10; i++) assert.equal((await send(report(post(validReport, 'r3')))).status, 200);
assertError(await send(report(post(validReport, 'r3'))), 429, 'report rate limit');
assert.equal((await send(feed(get('r3')))).status, 200);

// /api/email: bad input → 400 { error }, no model called.
fetched.length = 0;
await assertRejects(email, [
  ['{not json', 'malformed JSON'],
  ['null', 'null body'],
  [{}, 'missing raw'],
  [{ raw: '  \n ' }, 'blank raw'],
  [{ raw: 42 }, 'raw not a string'],
  [{ raw: 'a'.repeat(100_001) }, 'over 100 KB'],
]);
assert.equal(fetched.length, 0);

// Jev + Claude answer → 200 EmailResult. Fictitious newsletter; threat intel and RAG fail (503) → unknown / [], never clean.
const NEWSLETTER = [
  'Authentication-Results: mx.example.net; spf=pass; dkim=pass; dmarc=pass header.from=lagoonbooks.example',
  'From: "Lagoon Books" <news@lagoonbooks.example>',
  'Subject: New arrivals this week',
  '',
  'Here are this week\'s new novels. Questions? Call 5712 3456. See https://lagoonbooks.example/new',
].join('\r\n');
const jevBody = () => fetched.find((f) => f.url.includes('/decisions'))?.init.body;
reply = (url) =>
  url.includes('/decisions')
    ? Response.json({ answers: { asksForSecret: { type: 'noul', noul: 0 }, importance: { type: 'choice', choice: 'PROMOTIONAL' } } })
    : url.includes('/chat/completions')
      ? Response.json({ choices: [{ message: { content: JSON.stringify({ verdict: 'SAFE', redFlags: [], scamType: '', advice: 'ok' }) } }] })
      : new Response('{}', { status: 503 });
fetched.length = 0;
const ok = await send(email(post({ raw: NEWSLETTER }, 'e1')));
assert.equal(ok.status, 200);
assert.equal(ok.body.verdict, 'SAFE');
assert.equal(ok.body.importance, 'PROMOTIONAL');
for (const k of ['flags', 'advice', 'scamType', 'evidence', 'metadata']) assert.ok(k in ok.body, `EmailResult has ${k}`);
assert.match(String(jevBody()), /"importance"/, 'the email path asks Jev for importance');
for (const f of fetched) assert.doesNotMatch(String(f.init.body ?? ''), /5712/, 'phone number redacted before egress');

// Models down → still 200 with the rule verdict and the fixed default importance.
reply = () => new Response('{"error":"down"}', { status: 503 });
const down = await send(email(post({ raw: NEWSLETTER }, 'e2')));
assert.equal(down.status, 200);
assert.equal(down.body.verdict, 'SAFE');
assert.equal(down.body.importance, 'ROUTINE');

// An internal failure that quotes the email → 502 { error }; neither the reply nor the log repeats it.
const realJev = LIVE_DEPS.jev;
LIVE_DEPS.jev = async (t) => ({ signals: { get asksForSecret(): number { throw new Error(t); } }, isFragment: 0, missingField: 'none' });
const logged: unknown[] = [];
const realError = console.error;
console.error = (...a: unknown[]) => void logged.push(...a);
const failed = await send(email(post({ raw: NEWSLETTER }, 'e3')));
console.error = realError;
LIVE_DEPS.jev = realJev;
assertError(failed, 502, 'email pipeline bug');
assert.doesNotMatch(JSON.stringify([failed.body, logged.map(String)]), /novels|Lagoon/, 'raw email never in the reply or the log');

// 10 per IP per minute → 429 { error }.
for (let i = 0; i < 10; i++) assert.equal((await send(email(post({ raw: NEWSLETTER }, 'e4')))).status, 200);
assertError(await send(email(post({ raw: NEWSLETTER }, 'e4'))), 429, 'email rate limit');

console.log('routes ok');
