// Run: node src/lib/reports.test.ts
import assert from 'node:assert/strict';
import { communityReports, hashReporter, memoryStore, trending, validateReport } from './reports.ts';

const base = { institution: 'MAURITIUS_POST', vector: 'SMS', district: 'MOKA' };

// validateReport: enums only, domain normalised, allowlisted refused, shortener/shared stored as null, snippet redacted.
assert.deepEqual(validateReport({ ...base, domain: 'https://Pay.Parcel-Track-MU.com/x?otp=1' }).domain, 'parcel-track-mu.com');
assert.equal(validateReport({ ...base, domain: 'evil[.]co.uk' }).domain, 'evil.co.uk', 'refanged, two-level suffix kept');
assert.throws(() => validateReport({ ...base, domain: 'www.mcb.mu' }), /official/, 'allowlisted domain refused');
assert.throws(() => validateReport({ ...base, domain: 'telecom.mu' }), /official/, 'same allowlist as the scan (extract.ts)');
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

// Evidence step: DISTINCT reporters per registrable domain. The levels (3rd reporter → HIGH_RISK, immune domains never
// count) are the rule floor's job and tested in rules.test.ts.
const store = memoryStore([]);
const report = (hash: string, domain: string | null = 'parcel-track-mu.com') =>
  store.add({ ...base, domain, snippet: '', reporterHash: hash, createdAt: Date.now() });
const count = async (d: string, s = store) => (await communityReports([d], s))[0]?.reporters;
assert.equal(await count('parcel-track-mu.com'), 0);
await report('r1');
await report('r2');
await report('r2');
await report('r2');
assert.equal(await count('parcel-track-mu.com'), 2, 'same reporter repeated is still 2 distinct');
await report('r3');
assert.equal(await count('parcel-track-mu.com'), 3, 'third distinct reporter');
assert.deepEqual(await communityReports(['a.com', 'parcel-track-mu.com'], store), [
  { domain: 'a.com', reporters: 0 },
  { domain: 'parcel-track-mu.com', reporters: 3 },
]);
// A failing store adds no evidence (evidence step must never throw).
assert.deepEqual(await communityReports(['x.com'], { ...store, countReporters: () => Promise.reject(new Error('down')) }), []);

// Default demo store has 2 seeded reporters on the demo domain.
assert.equal(await count('parcel-track-mu.com', memoryStore()), 2);

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
