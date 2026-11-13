// Run: node src/lib/reports.test.ts
import assert from 'node:assert/strict';
import { communityLevel, hashReporter, memoryStore, registrableDomain, trending, validateReport } from './reports.ts';
import { Level } from './verdict.ts';

const base = { institution: 'MAURITIUS_POST', vector: 'SMS', district: 'MOKA' };

// validateReport: enums only, domain normalised, allowlisted refused, shortener/shared stored as null, snippet redacted.
assert.deepEqual(validateReport({ ...base, domain: 'https://Pay.Parcel-Track-MU.com/x?otp=1' }).domain, 'parcel-track-mu.com');
assert.equal(validateReport({ ...base, domain: 'evil[.]co.uk' }).domain, 'evil.co.uk', 'refanged, two-level suffix kept');
assert.equal(registrableDomain('a.b.gov.mu'), 'b.gov.mu');
assert.throws(() => validateReport({ ...base, domain: 'www.mcb.mu' }), /official/, 'allowlisted domain refused');
assert.equal(validateReport({ ...base, domain: 'bit.ly' }).domain, null, 'shortener stored as null');
assert.equal(validateReport({ ...base, domain: 'drive.google.com' }).domain, null, 'shared host stored as null');
assert.equal(validateReport({ ...base, domain: 'github.com' }).domain, null);
assert.equal(validateReport({ ...base, domain: 'x.workers.dev' }).domain, 'x.workers.dev', 'per-tenant subdomain is not shared');
assert.equal(validateReport(base).domain, null);
assert.throws(() => validateReport({ ...base, institution: 'NASA' }), /institution/);
assert.throws(() => validateReport({ ...base, vector: 1 }), /vector/);
assert.throws(() => validateReport({ ...base, district: 'X' }), /district/);
assert.throws(() => validateReport({ ...base, domain: 'not a domain' }), /domain/);
assert.throws(() => validateReport(null), /institution/);
assert.equal(validateReport({ ...base, snippet: 'Call 5712 3456 OTP 482913' }).snippet, 'Call [PHONE] OTP [CODE]');
assert.equal(validateReport({ ...base, snippet: 'a'.repeat(1000) }).snippet.length, 280);

// Third DISTINCT reporter lifts a domain to HIGH_RISK (PLAN D9, step 6 Done-when).
const store = memoryStore([]);
const report = (hash: string, domain: string | null = 'parcel-track-mu.com') =>
  store.add({ ...base, domain, snippet: '', reporterHash: hash, createdAt: Date.now() });
assert.equal(await communityLevel('parcel-track-mu.com', store), Level.SAFE);
await report('r1');
assert.equal(await communityLevel('parcel-track-mu.com', store), Level.SUSPICIOUS);
await report('r2');
await report('r2');
await report('r2');
assert.equal(await communityLevel('parcel-track-mu.com', store), Level.SUSPICIOUS, 'same reporter repeated is still 2 distinct');
await report('r3');
assert.equal(await communityLevel('PARCEL-TRACK-MU.com', store), Level.HIGH_RISK, 'third distinct reporter');
assert.equal(await communityLevel('www.parcel-track-mu.com', store), Level.HIGH_RISK, 'subdomain looks up registrable domain');
// Immune domains never get a level, even if rows exist (e.g. seeded or legacy).
for (const h of ['a', 'b', 'c']) await report(h, 'bit.ly');
assert.equal(await communityLevel('bit.ly', store), Level.SAFE, 'shortener never counts');
for (const h of ['a', 'b', 'c']) await report(h, 'mcb.mu');
assert.equal(await communityLevel('mcb.mu', store), Level.SAFE, 'allowlisted never counts');
assert.equal(await communityLevel('raw.githubusercontent.com', store), Level.SAFE);
// A failing store degrades to SAFE (evidence step must never throw).
assert.equal(await communityLevel('x.com', { ...store, countReporters: () => Promise.reject(new Error('down')) }), Level.SAFE);

// Default demo store has 2 seeded reporters on the demo domain.
const seeded = memoryStore();
assert.equal(await communityLevel('parcel-track-mu.com', seeded), Level.SUSPICIOUS);

// trending: last 7 days, counts by institution and district, top domains.
const now = 10 * 86_400_000;
const rows = [
  { ...base, domain: 'a.com', snippet: '', reporterHash: 'x', createdAt: now - 1000 },
  { ...base, institution: 'MCB', domain: 'a.com', snippet: '', reporterHash: 'y', createdAt: now - 1000 },
  { ...base, institution: 'MCB', district: 'FLACQ', domain: null, snippet: '', reporterHash: 'y', createdAt: now - 2000 },
  { ...base, domain: 'old.com', snippet: '', reporterHash: 'z', createdAt: now - 8 * 86_400_000 },
];
assert.deepEqual(trending(rows, now), {
  total: 3,
  byInstitution: [{ key: 'MCB', count: 2 }, { key: 'MAURITIUS_POST', count: 1 }],
  byDistrict: [{ key: 'MOKA', count: 2 }, { key: 'FLACQ', count: 1 }],
  topDomains: [{ key: 'a.com', count: 2 }],
});

// Reporter hash: salted, hex, stable, never the raw IP.
const h1 = await hashReporter('1.2.3.4', 'salt');
assert.match(h1, /^[0-9a-f]{64}$/);
assert.equal(h1, await hashReporter('1.2.3.4', 'salt'));
assert.notEqual(h1, await hashReporter('1.2.3.4', 'other'));
await assert.rejects(hashReporter('1.2.3.4', ''), /HASH_SALT/, 'no salt fails closed');
console.log('reports ok');
