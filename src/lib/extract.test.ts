// Run: node src/lib/extract.test.ts
import assert from 'node:assert/strict';
import { domainToASCII } from 'node:url';
import { redact } from './redact.ts';
import { extractDomains, isAllowlisted, isReportImmune, isSharedHost, isShortener, lookalikeOf, registrableDomain } from './extract.ts';

// Hosts from URLs and bare domains: lowercased, userinfo/port/trailing punctuation dropped, emails ignored.
assert.deepEqual(extractDomains('Confirm at https://MCB-Secure-Login.com/x?otp=1, or www.mcb.mu.'), ['mcb-secure-login.com', 'www.mcb.mu']);
assert.deepEqual(extractDomains('http://mcb.mu@evil.com:8080/a'), ['evil.com'], 'userinfo is not the host');
assert.deepEqual(extractDomains('Mail john@gmail.com or call [PHONE +230]'), []);
assert.deepEqual(extractDomains('(see https://bit.ly/x) and bit.ly/y'), ['bit.ly'], 'deduplicated');
// A raw Cyrillic host is read as its punycode form, so the lookalike check sees it.
const cyrillicMcb = domainToASCII('mсb.mu'); // "с" is Cyrillic
assert.deepEqual(extractDomains('Login: mсb.mu/reset'), [cyrillicMcb]);
assert.deepEqual(extractDomains(redact('Login: mсb-2024.mu now')), [domainToASCII('mсb-2024.mu')], 'redaction keeps digits in a Unicode host');

assert.equal(registrableDomain('a.b.mcb.mu'), 'mcb.mu');
assert.equal(registrableDomain('www.bbc.co.uk'), 'bbc.co.uk');
assert.equal(registrableDomain('login.x.workers.dev'), 'x.workers.dev', 'per-tenant host: the attacker owns x.workers.dev');

assert.ok(isShortener('bit.ly') && isShortener('t.ly') && !isShortener('evilbit.ly'));
assert.ok(isSharedHost('github.com') && isSharedHost('raw.githubusercontent.com'));
assert.ok(!isSharedHost('x.workers.dev') && !isSharedHost('x.github.io') && !isSharedHost('evil.github.com'), 'exact host only');

assert.ok(isAllowlisted('mcb.mu') && isAllowlisted('internet.mcb.mu') && isAllowlisted('police.govmu.org'));
assert.ok(!isAllowlisted('mcb.mu.evil.com') && !isAllowlisted('evilmcb.mu'));

// Lookalike: a brand token equals a whole dot- or hyphen-separated part, never a substring.
assert.equal(lookalikeOf('mcb-secure-login.com'), 'mcb.mu');
assert.equal(lookalikeOf('mcb.mu.evil.com'), 'mcb.mu');
assert.equal(lookalikeOf('rnauritiuspost.com'), 'mauritiuspost.mu', 'rn reads as m');
assert.equal(lookalikeOf('mauritius-post.info'), 'mauritiuspost.mu', 'hyphen inside the brand');
assert.equal(lookalikeOf('mcb.github.io'), 'mcb.mu', 'per-tenant host is attacker-owned');
for (const ok of ['mcb.mu', 'internet.mcb.mu', 'cebupacific.com', 'smcb.org', 'symcb.com', 'facebook.net', 'sonicwall.com'])
  assert.equal(lookalikeOf(ok), null, ok);
// Government suffixes cannot be registered by a scammer.
assert.equal(lookalikeOf('cwa.gov.tw'), null);
assert.equal(lookalikeOf('sbm.gov.in'), null);
assert.equal(lookalikeOf('mcb-login.gov.cc'), 'mcb.mu', 'gov.cc is for sale: only suffixes a government reserves');

// Community reports are keyed by registrable domain, so a shared host's parent is immune too.
assert.ok(isReportImmune('mcb.mu') && isReportImmune('bit.ly') && isReportImmune('github.com'));
assert.ok(isReportImmune('google.com') && isReportImmune('githubusercontent.com'), 'drive.google.com, raw.githubusercontent.com');
assert.ok(!isReportImmune('parcel-track-mu.com') && !isReportImmune('x.workers.dev'));
// Punycode: a homograph (foreign letters that look Latin) is flagged; a genuine foreign-script name is not.
assert.equal(lookalikeOf(cyrillicMcb), 'mcb.mu');
assert.equal(lookalikeOf(domainToASCII('аpple.com')), 'apple.com', 'homograph of a non-brand: report what it imitates');
assert.equal(lookalikeOf('xn--l3cg7a8a0cwa3f.website'), null, 'Thai script is not a Latin lookalike');
assert.equal(lookalikeOf(domainToASCII('café.fr')), null, 'an accent alone is not a lookalike');
assert.equal(lookalikeOf('xn--99.com'), 'xn--99.com', 'unreadable punycode fails closed');

console.log('extract ok');
