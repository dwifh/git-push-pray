// Run: node src/lib/email.test.ts
import assert from 'node:assert/strict';
import { parseHeaders } from './email.ts';

// Spoofed MRA refund (demo step 6), CRLF line endings as pasted from "Show original".
const spoofed = [
  'Return-Path: <bounce@mra-refund.top>',
  'Authentication-Results: mx.google.com;',
  '       spf=fail (google.com: domain of bounce@mra-refund.top does not designate) smtp.mailfrom=mra-refund.top;',
  '       dkim=none;',
  '       dmarc=fail (p=REJECT) header.from=mra.mu',
  'Authentication-Results: fake.example; spf=pass; dkim=pass; dmarc=pass', // lower down = added by the sender: ignored
  'From: "Mauritius Revenue Authority" <refunds@MRA.mu>',
  'Reply-To: claims@mra-refund.top',
  'Subject: =?UTF-8?B?VGF4IHJlZnVuZA==?= =?UTF-8?Q?_=E2=80=93_action?=',
  'Content-Type: multipart/alternative; boundary="b1"',
  '',
  '--b1',
  'Content-Type: text/html; charset=utf-8',
  '',
  '<p>html part</p>',
  '--b1',
  'Content-Type: text/plain; charset=utf-8',
  'Content-Transfer-Encoding: quoted-printable',
  '',
  'You are owed Rs 4,500. Claim within 24 hours=',
  ' at mra-refund.top =E2=80=93 MRA',
  '--b1--',
].join('\r\n');

assert.deepEqual(parseHeaders(spoofed), {
  spf: 'fail',
  dkim: 'none',
  dmarc: 'fail',
  fromDomain: 'mra.mu',
  replyToDomain: 'mra-refund.top',
  returnPathDomain: 'mra-refund.top',
  displayName: 'Mauritius Revenue Authority',
  subject: 'Tax refund – action',
  body: 'You are owed Rs 4,500. Claim within 24 hours at mra-refund.top – MRA',
});

// Newsletter: folded subject, base64 single-part body, no Authentication-Results, bare address.
const newsletter = [
  'From: news@emtel.com',
  'Subject: November offers',
  '  for you',
  'Content-Type: text/plain; charset=utf-8',
  'Content-Transfer-Encoding: base64',
  '',
  btoa('Hello from Emtel'),
].join('\n');
const n = parseHeaders(newsletter);
assert.equal(n.subject, 'November offers for you');
assert.equal(n.body, 'Hello from Emtel');
assert.equal(n.fromDomain, 'emtel.com');
assert.equal(n.displayName, '');
assert.deepEqual([n.spf, n.dkim, n.dmarc, n.replyToDomain], ['unknown', 'unknown', 'unknown', null]);

// HTML-only body: tags stripped, never rendered. Headers only: empty body.
const htmlOnly = parseHeaders('From: A <a@b.com>\nContent-Type: text/html\n\n<p>Pay <b>now</b></p><style>p{}</style>');
assert.equal(htmlOnly.body, 'Pay now');
const htmlLink = parseHeaders('From: a@b.com\nContent-Type: text/html\n\nLocked. <a href="https://mcb-secure.com/login">Click here</a>');
assert.equal(htmlLink.body, 'Locked. https://mcb-secure.com/login Click here', 'the link target is kept for extract');
assert.equal(parseHeaders('From: A <a@b.com>\nSubject: hi').body, '');

console.log('email ok');
