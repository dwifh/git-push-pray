// Run: node src/shared/alert.test.ts  (global fetch stubbed: no real network)
import assert from 'node:assert/strict';
import { askHelper, sendAlert } from './alert.ts';

const req = { template: 'call_alert', to: '23057000001', vars: ['Mum', 'caller asked for an OTP'] } as const;
const stub = (impl: () => Promise<Response>) => (globalThis.fetch = impl as typeof fetch);

stub(async () => Response.json({ sent: true }));
let r = await sendAlert({ ...req, vars: [...req.vars] });
assert.equal(r.sent, true);
assert.ok(r.waMe.startsWith('https://wa.me/23057000001?text=Scam%20call%20alert'), 'wa.me link is always returned, pre-filled');
assert.ok(decodeURIComponent(r.waMe).includes('Mum may be on a scam phone call'));

stub(async () => Response.json({ sent: false, fallback: 'wa.me' }));
assert.equal((await sendAlert({ ...req, vars: [...req.vars] })).sent, false, 'Meta failure → not sent');

stub(async () => Response.json({ error: 'Too many alerts' }, { status: 429 }));
assert.equal((await sendAlert({ ...req, vars: [...req.vars] })).sent, false, 'rate limit → not sent');

stub(async () => { throw new TypeError('offline'); });
assert.equal((await sendAlert({ ...req, vars: [...req.vars] })).sent, false, 'offline → not sent, no throw');

let called = false;
stub(async () => { called = true; return Response.json({ sent: true }); });
r = await sendAlert({ ...req, vars: ['Mum', 'go to evil.com'] });
assert.deepEqual(r, { sent: false, waMe: 'https://wa.me/23057000001' }, 'a linky variable never leaves the device');
assert.equal(called, false);

// askHelper (Helping Hands): never throws; the wa.me link carries the code when there is one, never the scam text.
const ask = { elderName: 'Nani', to: '23057000001', text: 'Pay at evil.com now', verdict: 'HIGH_RISK' } as const;
let sentBody = '';
stub(async (_u?: unknown, init?: RequestInit) => { sentBody = String(init?.body); return Response.json({ code: '482913', token: 't'.repeat(72), sent: true }); });
let h = await askHelper({ ...ask });
assert.equal(JSON.parse(sentBody).text, 'Pay at evil.com now', 'the server gets the message to re-scan');
assert.deepEqual({ ...h, waMe: undefined }, { code: '482913', token: 't'.repeat(72), sent: true, waMe: undefined });
assert.ok(decodeURIComponent(h.waMe).includes('enter this code: 482913'), 'wa.me pre-filled with the same wording and code');

stub(async () => Response.json({ error: 'Too many requests. Please wait a minute.' }, { status: 429 }));
h = await askHelper({ ...ask });
assert.equal(h.sent, false);
assert.equal(h.code, undefined);
assert.equal(h.error, 'Too many requests. Please wait a minute.', 'the screen can show the server message');
assert.ok(h.waMe.startsWith('https://wa.me/23057000001?text='), 'no code → still a way to reach the helper');
assert.doesNotMatch(decodeURIComponent(h.waMe), /evil/, 'the fallback never spreads the scam text');

stub(async () => { throw new TypeError('offline'); });
h = await askHelper({ ...ask });
assert.equal(h.sent, false);
assert.equal(typeof h.error, 'string', 'offline → friendly error, no throw');

console.log('alert: ok');
