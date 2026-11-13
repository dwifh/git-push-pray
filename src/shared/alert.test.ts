// Run: node src/shared/alert.test.ts  (global fetch stubbed: no real network)
import assert from 'node:assert/strict';
import { sendAlert } from './alert.ts';

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

console.log('alert: ok');
