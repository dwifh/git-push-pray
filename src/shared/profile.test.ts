// Run: node src/shared/profile.test.ts
import assert from 'node:assert/strict';
import { validateVars } from './messages.ts';
import { clearProfile, loadProfile, normalizePhone, saveProfile } from './profile.ts';

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
};
const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('quota'); }, removeItem: () => { throw new Error('blocked'); } };
const elder = { role: 'elder', firstName: ' Nani ', helperName: 'Priya', trustedContact: '5712 3456' };

// Whatever the helper types becomes the digits WhatsApp and /api/alert need (country code first).
for (const [typed, digits] of [
  ['+230 5712 3456', '23057123456'],
  ['5712 3456', '23057123456'], // Mauritian mobile, no country code
  ['5712-3456', '23057123456'],
  ['23057123456', '23057123456'],
  ['00230 5712 3456', '23057123456'],
  ['+44 (0)7700 900123', '447700900123'], // UK trunk "(0)" dropped
  ['  +33 6 12 34 56 78 ', '33612345678'],
]) assert.equal(normalizePhone(typed), digits, typed);

for (const bad of ['', '   ', '212 3456' /* 7-digit landline: no WhatsApp */, '1234', '5712345a', '+1234567890123456' /* 16 digits */, '+', '++23057123456'])
  assert.equal(normalizePhone(bad), null, `refused: ${JSON.stringify(bad)}`);

// Elder phone: saved clean, read back the same.
const s = memory();
assert.equal(loadProfile(s), null, 'not set up yet');
const saved = saveProfile(elder, s);
assert.deepEqual(saved, { ok: true, profile: { role: 'elder', firstName: 'Nani', helperName: 'Priya', trustedContact: '23057123456' } });
assert.deepEqual(loadProfile(s), saved.ok && saved.profile);
// What the screen saves is what the server accepts: the name passes the WhatsApp variable check.
assert.doesNotThrow(() => validateVars('call_alert', [(loadProfile(s) as { firstName: string }).firstName, 'They asked for your OTP']));

// Helper phone: just the role; stray fields are dropped, never stored.
const h = memory();
assert.deepEqual(saveProfile({ role: 'helper', trustedContact: '57123456' }, h), { ok: true, profile: { role: 'helper' } });
assert.deepEqual(loadProfile(h), { role: 'helper' });

// Names that WhatsApp would refuse are caught on the form, with the field to highlight.
for (const name of ["Marie-Claire", "D'Souza", 'Zoë', 'Mr Ah Kee']) assert.equal(saveProfile({ ...elder, firstName: name }, memory()).ok, true, name);
for (const [field, value, why] of [
  ['firstName', '', 'empty'],
  ['firstName', '   ', 'blank'],
  ['firstName', 'x'.repeat(31), 'over 30'],
  ['firstName', 'Nani 2', 'digit'],
  ['firstName', 'mcb.mu', 'domain'],
  ['firstName', 'A\nB', 'newline'],
  ['firstName', 'Na​ni', 'zero-width'],
  ['firstName', 42, 'not a string'],
  ['helperName', 'www.evil', 'helper name follows the same rule'],
  ['trustedContact', '212 3456', 'landline'],
  ['trustedContact', undefined, 'missing number'],
  ['role', 'admin', 'unknown role'],
] as const) {
  const r = saveProfile({ ...elder, [field]: value }, memory());
  assert.equal(r.ok, false, why);
  assert.equal(!r.ok && r.field, field, why);
  assert.equal(typeof (!r.ok && r.error), 'string', why);
}
assert.equal(saveProfile(null, memory()).ok, false, 'null input');

// Storage can be blocked (private window) or edited by hand: never a crash, never a bad profile.
assert.equal(loadProfile(broken), null);
assert.equal(saveProfile(elder, broken).ok, false, 'a failed write is reported, not hidden');
assert.doesNotThrow(() => clearProfile(broken));
s.m.set('scamshield.profile', '{not json');
assert.equal(loadProfile(s), null, 'corrupt JSON');
s.m.set('scamshield.profile', JSON.stringify({ ...elder, trustedContact: 'call 999' }));
assert.equal(loadProfile(s), null, 'tampered number');
saveProfile(elder, s);
clearProfile(s);
assert.equal(loadProfile(s), null, 'cleared');
assert.equal(loadProfile(), null, 'no localStorage at all (Node)');

console.log('profile ok');
