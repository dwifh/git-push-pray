// Run: node src/shared/contact.test.ts
import assert from 'node:assert/strict';
import { getContact, normalizeNumber, saveContact } from './contact.ts';

// E.164 digits, no "+": the shape /api/alert and wa.me want.
assert.equal(normalizeNumber('+230 5123 4567'), '23051234567');
assert.equal(normalizeNumber('5123 4567'), '23051234567', 'bare Mauritian mobile gets +230');
assert.equal(normalizeNumber('(230) 5123-4567'), '23051234567');
assert.equal(normalizeNumber('00 44 7700 900123'), '447700900123');
assert.equal(normalizeNumber('123'), null);
assert.equal(normalizeNumber('call me'), null);
assert.equal(normalizeNumber('+1234567890123456'), null, 'over 15 digits');

// No localStorage (Node, blocked storage): reads are empty, writes are no-ops, nothing throws.
assert.deepEqual(getContact(), { to: '', firstName: '' });
saveContact('23051234567', 'Asha');

const store = new Map<string, string>();
Object.assign(globalThis, { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) } });
saveContact('23051234567', '  Asha  ');
assert.deepEqual(getContact(), { to: '23051234567', firstName: 'Asha' }, 'TEAM-PLAN keys, trimmed name');
assert.equal(store.get('trustedContact'), '23051234567');
saveContact('23051234567', 'x'.repeat(50));
assert.equal(getContact().firstName.length, 30, 'call_alert {{1}} max 30');

Object.assign(globalThis, { localStorage: { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } } });
assert.deepEqual(getContact(), { to: '', firstName: '' }, 'private mode never crashes the Coach');
saveContact('23051234567', 'Asha');

console.log('contact ok');
