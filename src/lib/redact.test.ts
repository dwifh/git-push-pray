// Run: node src/lib/redact.test.ts
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { redact, senderHash } from './redact.ts';

// senderHash = sha256(salt + normalised sender), hex. Expected value from node:crypto, an independent implementation.
const expected = createHash('sha256').update('salt+23057123456').digest('hex');
assert.equal(await senderHash('+230 5712-3456', 'salt'), expected);
assert.equal(await senderHash(' +230 (5712) 3456 ', 'salt'), expected, 'spacing and punctuation do not change the hash');
assert.equal(await senderHash('MCB-Alerts', 'salt'), await senderHash('mcb alerts', 'salt'), 'case-insensitive');
assert.notEqual(await senderHash('+23057123456', 'other'), expected, 'salt changes the hash');
await assert.rejects(senderHash('+23057123456', ''), 'no salt: refuse, an unsalted phone hash is reversible');

// URL hosts survive; query, fragment and userinfo are dropped.
assert.equal(redact('https://mcb-secure-2024.com/login?otp=123456'), 'https://mcb-secure-2024.com/login');
assert.equal(redact('Go to mcb-secure-2024.com now'), 'Go to mcb-secure-2024.com now');
assert.equal(redact('http://mcb.mu@evil.com/x#frag'), 'http://evil.com/x');
assert.equal(redact('https://bank.example.com/acct/12345678'), 'https://bank.example.com/acct/[CODE]', 'path is still redacted');

// Placeholders, most specific first.
assert.equal(redact('Card 4111 1111 1111 1111 blocked'), 'Card [CARD] blocked');
assert.equal(redact('Acct 1234-5678-9012-3456'), 'Acct [CARD]');
assert.equal(redact('NIC A123456789012B ok'), 'NIC [NIC] ok');
assert.equal(redact('Mail john.doe@gmail.com today'), 'Mail [EMAIL] today');
assert.equal(redact('Call +230 5712 3456'), 'Call [PHONE +230]');
assert.equal(redact('Call +44 7911 123456 now'), 'Call [PHONE +44] now');
assert.equal(redact('Call customer services on 09065069120'), 'Call customer services on [PHONE]');
assert.equal(redact('Ring 5712 3456'), 'Ring [PHONE]');
assert.equal(redact('Your OTP is 482913.'), 'Your OTP is [CODE].');
assert.equal(redact('PIN 1234'), 'PIN [CODE]');
// Review leaks: digits glued to letters, phones in pairs, 3-digit groups, NIC variants, bare-domain queries.
assert.equal(redact('OTP482913 now'), 'OTP[CODE] now');
assert.equal(redact('PIN1234'), 'PIN[CODE]');
assert.equal(redact('Call 57 12 34 56'), 'Call [NUMBER]');
assert.equal(redact('Acct 000 444 555 666'), 'Acct [NUMBER]');
assert.equal(redact('NIC A1234567890123'), 'NIC [NIC]');
assert.equal(redact('nic a123456789012b'), 'nic [NIC]');
assert.equal(redact('Reset at www.mcb.mu/reset?token=abc123XYZ now'), 'Reset at www.mcb.mu/reset now');
assert.equal(redact('Pay Rs 75 by 2 pm'), 'Pay Rs 75 by 2 pm', 'short numbers stay: amounts are a signal');

console.log('redact ok');
