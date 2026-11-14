// Run: node src/shared/messages.test.ts
import assert from 'node:assert/strict';
import { renderMessage } from './messages.ts';

// Expected text is copied from docs/WHATSAPP-TEMPLATES.md (header, body, footer).
assert.equal(
  renderMessage('call_alert', ['Asha', 'the caller asked for an OTP code']),
  `Scam call alert

Safety alert: Asha may be on a scam phone call right now. The warning sign we found: the caller asked for an OTP code.

Please call them now and tell them to hang up. Remind them never to share an OTP, PIN or password with a caller and never to send money because a caller asks.

You are receiving this because they chose you as their trusted contact in Scam Shield.

Scam Shield Mauritius safety alert`,
);

assert.equal(
  renderMessage('scam_warning', ['Asha', 'MCB', 'high risk']),
  `Scam warning

Hello, this is a scam warning for the family of Asha. They received a message pretending to be from MCB, and Scam Shield rated it high risk.

If you get a similar message, do not click its links and never share OTP codes, PINs or passwords. If in doubt, call the organisation on the number printed on your card or bill.

You are receiving this because they chose you as their trusted contact in Scam Shield.

Scam Shield Mauritius safety alert`,
);

// Helping Hands: the code is the only way in; the message carries no link.
assert.equal(
  renderMessage('help_request', ['Nani', '482913']),
  `Help request

This is a help request from Nani. They would like you to check a message before they reply to it.

Open Scam Shield on your phone, tap Helper and enter this code: 482913

The code works for 30 minutes. Never share it with anyone else, and never click links in the message you are checking.

You are receiving this because they chose you as their trusted contact in Scam Shield.

Scam Shield Mauritius safety alert`,
);
assert.throws(() => renderMessage('help_request', ['Nani', '1234567']), Error, 'code over 6 chars');

// One pass: a value that looks like a slot is not filled again.
assert.match(renderMessage('scam_warning', ['{{2}}', 'MCB', 'high risk']), /family of \{\{2\}\}\./);

// Variables: single-line, no URL or domain-looking token, within the max length, exact count.
const bad = (vars: string[], why: string) => assert.throws(() => renderMessage('scam_warning', vars), Error, why);
bad(['Asha', 'MCB'], 'too few vars');
bad(['Asha', 'MCB', 'high risk', 'extra'], 'too many vars');
bad(['Asha', 'MCB', ''], 'empty var');
bad(['Asha\nCall me', 'MCB', 'high risk'], 'newline');
bad(['Asha\tx', 'MCB', 'high risk'], 'tab');
bad(['Asha', 'https://mcb-secure.com', 'high risk'], 'URL');
bad(['Asha', 'www.mcb-secure', 'high risk'], 'www');
bad(['Asha', 'evil[.]com', 'high risk'], 'defanged');
bad(['Asha', 'mcb-secure.com', 'high risk'], 'bare domain');
bad(['Asha', 'my.t', 'high risk'], 'one-letter TLD still looks like a domain');
bad(['A'.repeat(31), 'MCB', 'high risk'], 'name over 30');
assert.ok(renderMessage('scam_warning', ['A'.repeat(30), 'a well-known organisation', 'suspicious']), '30 is allowed');

// Security review 2026-11-14: no callback numbers, no look-alike or hidden links, the help code is exactly 6 digits.
const badCall = (flag: string, why: string) => assert.throws(() => renderMessage('call_alert', ['Asha', flag]), Error, why);
badCall('Call MCB fraud desk on 5712 3456 for a refund', 'spaced phone number');
badCall('call +230-5712-3456', 'phone number with separators');
badCall('call ５７１２３４５６', 'fullwidth digits');
badCall('visit mcb．mu-refund．com', 'fullwidth dot');
badCall('visit mcb。mu', 'ideographic full stop');
badCall('visit мсб.му', 'Cyrillic domain');
badCall('visit mcb​.mu', 'zero-width space');
badCall('evil‮moc.bcm', 'bidi override');
assert.throws(() => renderMessage('help_request', ['MCB call 57123456', '482913']), Error, 'number in the name');
assert.throws(() => renderMessage('help_request', ['Nani', '48291a']), Error, 'code must be 6 digits');
assert.throws(() => renderMessage('help_request', ['Nani', '４８２９１３']), Error, 'code must be ASCII digits');
assert.ok(renderMessage('call_alert', ['Asha', 'the caller asked for a 6-digit code in 2 minutes']), 'a few digits are fine');

console.log('messages ok');
