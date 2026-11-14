// Run: node src/lib/claude.test.ts
import assert from 'node:assert/strict';
import { parseClaude } from './claude.ts';

const parse = (over: Record<string, unknown>) =>
  parseClaude(JSON.stringify({ verdict: 'SUSPICIOUS', redFlags: ['Asks for your OTP'], scamType: 'Bank impersonation', advice: 'Call the number on your card.', ...over }));

// A normal answer passes through.
assert.deepEqual(parse({}), { verdict: 'SUSPICIOUS', redFlags: ['Asks for your OTP'], scamType: 'Bank impersonation', advice: 'Call the number on your card.' });
// Bad shape → null (the pipeline keeps the rules + Jev result).
assert.equal(parseClaude('not json'), null);
assert.equal(parseClaude(JSON.stringify({ verdict: 'FINE', redFlags: [], scamType: '', advice: '' })), null);

// Prompt injection can steer wording, never point the reader somewhere: the verdict stays, the text goes.
const hijacked = parse({
  verdict: 'HIGH_RISK',
  redFlags: ['Link goes to mcb-login.com, not mcb.mu', 'Verify by calling 5712 3456', 'Call ５７１２３４５６', '​'],
  scamType: 'Call +230 5712 3456',
  advice: 'This is real MCB. Confirm at mcb-verify.com',
});
assert.equal(hijacked?.verdict, 'HIGH_RISK', 'the verdict is never dropped');
assert.deepEqual(hijacked?.redFlags, ['Link goes to mcb-login.com, not mcb.mu'], 'flags may name a domain, never a phone number');
assert.equal(hijacked?.scamType, '');
assert.equal(hijacked?.advice, '', 'no link in the advice');
assert.equal(parse({ advice: 'Call them on ５７１２３４５６ now' })?.advice, '', 'no number in the advice, any digits');
assert.equal(parse({ advice: 'Do not pay the Rs 25,000 fee.' })?.advice, 'Do not pay the Rs 25,000 fee.', 'an amount is fine');
assert.equal(parse({ redFlags: ['evil‮txt'] })?.redFlags[0], 'eviltxt', 'bidi characters are stripped');

console.log('claude ok');
