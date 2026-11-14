// Run: node src/lib/help.test.ts
import assert from 'node:assert/strict';
import { HELP_TTL, memoryHelpStore, type HelpRow } from './help.ts';

const t0 = 1_000_000;
const row = (code: string, createdAt = t0): HelpRow => ({
  code, token: `tok-${code}`, elderName: 'Nani', text: 'Your parcel is held', verdict: 'SUSPICIOUS', flags: [], advice: '', reply: null, createdAt,
});

const store = memoryHelpStore();
assert.equal(await store.add(row('111111')), true);
assert.equal(await store.add(row('111111')), false, 'a live code is never reused');

// The helper's code and the elder's token both work for 30 minutes, then nothing.
assert.equal((await store.get('111111', t0 + HELP_TTL - 1))?.elderName, 'Nani');
assert.equal((await store.byToken('tok-111111', t0 + HELP_TTL - 1))?.code, '111111');
assert.equal(await store.get('111111', t0 + HELP_TTL), null, 'expired code');
assert.equal(await store.byToken('tok-111111', t0 + HELP_TTL), null, 'expired token');
assert.equal(await store.get('999999', t0), null, 'unknown code');

// One reply only, and never after expiry.
await store.add(row('222222'));
assert.equal(await store.setReply('222222', 'CALL_YOU', t0 + 1), true);
assert.equal(await store.setReply('222222', 'GENUINE', t0 + 2), false, 'a second reply cannot overwrite the first');
assert.equal((await store.byToken('tok-222222', t0 + 3))?.reply, 'CALL_YOU');
await store.add(row('333333'));
assert.equal(await store.setReply('333333', 'CALL_YOU', t0 + HELP_TTL), false, 'expired request takes no reply');

// An expired code can be handed out again.
assert.equal(await store.add(row('111111', t0 + HELP_TTL)), true);

console.log('help ok');
