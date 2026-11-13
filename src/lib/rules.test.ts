// Run: node src/lib/rules.test.ts
import assert from 'node:assert/strict';
import type { DomainIntel } from '../shared/types.ts';
import type { EmailFacts } from './email.ts';
import { extractDomains } from './extract.ts';
import { redact } from './redact.ts';
import { ruleFloor, type RuleFacts } from './rules.ts';
import { Level } from './verdict.ts';

// Facts the way the pipeline builds them: redact, then extract from the redacted text.
const facts = (raw: string, extra: Partial<RuleFacts> = {}): RuleFacts => {
  const text = redact(raw);
  return { text, domains: extractDomains(text), ...extra };
};
const level = (raw: string, extra?: Partial<RuleFacts>) => ruleFloor(facts(raw, extra)).level;
const intel = (domain: string, vt: DomainIntel['vt'], urlhaus: DomainIntel['urlhaus'] = 'not_listed'): DomainIntel => ({ domain, vt, urlhaus });

// Demo script (PLAN §11).
const demo1 = ruleFloor(facts('MCB: your account is blocked. Confirm your OTP at mcb-secure-login.com within 24 hours.'));
assert.equal(demo1.level, Level.HIGH_RISK);
assert.ok(demo1.flags.length >= 3, 'lookalike, credential + link, urgency each add a flag');
const demo2 = 'Mauritius Post: your parcel is held. Pay Rs 75 at parcel-track-mu.com/pay';
const reported = (n: number) => ({ communityReports: [{ domain: 'parcel-track-mu.com', reporters: n }] });
assert.equal(level(demo2, reported(2)), Level.SUSPICIOUS);
assert.equal(level(demo2, reported(3)), Level.HIGH_RISK, '3rd distinct reporter: community zero-day');
const demo3 = ruleFloor(facts('CEB: Scheduled power outage on 14 Nov from 09:00 to 13:00 in Moka for maintenance works. We apologise for any inconvenience.'));
assert.deepEqual(demo3, { level: Level.SAFE, flags: [] });

// Credentials: a request is SUSPICIOUS, a request plus somewhere to send it is HIGH_RISK, a warning is nothing.
assert.equal(level('Your OTP is 482913. Never share it with anyone.'), Level.SAFE);
assert.equal(level('Do not share your PIN with anyone.'), Level.SAFE);
assert.equal(level('Please send us the OTP you received.'), Level.SUSPICIOUS);
assert.equal(level('Please send us the OTP you received. Call +230 5712 3456'), Level.HIGH_RISK);

// Shorteners, allowlist and shared hosts never take community reports.
assert.equal(level('Track it: bit.ly/abc', { communityReports: [{ domain: 'bit.ly', reporters: 9 }] }), Level.SUSPICIOUS);
assert.equal(level('Log in at mcb.mu', { communityReports: [{ domain: 'mcb.mu', reporters: 9 }] }), Level.SAFE);
assert.equal(level('See github.com/x/y', { communityReports: [{ domain: 'github.com', reporters: 9 }] }), Level.SAFE);
assert.equal(level('See drive.google.com/x', { communityReports: [{ domain: 'google.com', reporters: 9 }] }), Level.SAFE);

// Threat intel: SHARED_HOSTS cap at SUSPICIOUS, per-tenant hosts do not.
assert.equal(level('See github.com/x/y', { intel: [intel('github.com', 'unknown', 'listed')] }), Level.SUSPICIOUS);
assert.equal(level('See x.workers.dev', { intel: [intel('x.workers.dev', 'unknown', 'listed')] }), Level.HIGH_RISK);
assert.equal(level('See evil.com', { intel: [intel('evil.com', { malicious: 2, suspicious: 0 })] }), Level.HIGH_RISK);
// PLAN §3.2: the weak signal needs two votes; a lone engine is noise (VT had google.com at malicious 1).
assert.equal(level('See evil.com', { intel: [intel('evil.com', { malicious: 1, suspicious: 1 })] }), Level.SUSPICIOUS);
assert.equal(level('See evil.com', { intel: [intel('evil.com', { malicious: 0, suspicious: 2 })] }), Level.SUSPICIOUS);
assert.equal(level('See google.com', { intel: [intel('google.com', { malicious: 1, suspicious: 0 })] }), Level.SAFE);
assert.equal(level('See google.com', { intel: [intel('google.com', { malicious: 0, suspicious: 1 })] }), Level.SAFE);
assert.equal(level('See evil.com', { intel: [intel('evil.com', 'unknown', 'unknown')] }), Level.SAFE, 'a failed lookup adds nothing');

// Pressure, payment, RAG.
assert.equal(level('Your electricity will be disconnected today.'), Level.SUSPICIOUS);
assert.equal(level('Urgent action required: verify immediately.'), Level.SUSPICIOUS);
assert.equal(level('Effective immediately, Stan is chairman. Urgent packages go to desk 4.'), Level.SAFE, 'business wording');
assert.equal(level('Buy a Google Play gift card and send me the code.'), Level.SUSPICIOUS);
assert.equal(level('Emtel news: enjoy a free voucher with your next top-up!'), Level.SAFE, 'a promo voucher is not a payment request');
assert.equal(level('Hello', { ragMatches: [{ title: 'Parcel fee', score: 0.6 }] }), Level.SUSPICIOUS);
assert.equal(level('Hello', { ragMatches: [{ title: 'Parcel fee', score: 0.5 }] }), Level.SAFE);

// Email rules (PLAN §6).
const mail = (e: Partial<EmailFacts>): EmailFacts => ({
  spf: 'pass', dkim: 'pass', dmarc: 'pass', fromDomain: 'emtel.com', replyToDomain: null, returnPathDomain: null,
  displayName: 'Emtel', subject: '', body: '', ...e,
});
const emailLevel = (e: Partial<EmailFacts>) => ruleFloor({ text: '', domains: [], email: mail(e) }).level;
assert.equal(emailLevel({}), Level.SAFE, 'real newsletter');
assert.equal(emailLevel({ replyToDomain: 'news.emtel.com' }), Level.SAFE, 'same registrable domain');
assert.equal(emailLevel({ dmarc: 'fail', displayName: 'Mauritius Revenue Authority', fromDomain: 'mra.mu' }), Level.HIGH_RISK);
assert.equal(emailLevel({ spf: 'fail', displayName: 'MRA Refunds' }), Level.HIGH_RISK);
assert.equal(emailLevel({ spf: 'fail', displayName: 'Mramar Hotels' }), Level.SAFE, 'a failed check alone, no brand: no floor');
assert.equal(emailLevel({ replyToDomain: 'mra-refund.top' }), Level.SUSPICIOUS, 'Reply-To elsewhere');
assert.equal(emailLevel({ fromDomain: 'mra-refunds.com', displayName: '' }), Level.HIGH_RISK, 'lookalike From');

console.log('rules ok');
