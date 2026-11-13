// Run: node src/shared/feed.test.ts
import assert from 'node:assert/strict';
import { DISTRICT_LABEL, institutionLabel, toTrending } from './feed.ts';
import { DISTRICTS, INSTITUTIONS } from './types.ts';

const expected = {
  byInstitution: [{ institution: 'MCB', count: 3 }],
  byDistrict: [{ district: 'PORT_LOUIS', count: 2 }],
  topDomains: [{ domain: 'parcel-track-mu.com', count: 2 }],
};

// What /api/reports sends today (src/lib/reports.ts `top()` rows: { key, count }).
assert.deepEqual(
  toTrending({ total: 5, byInstitution: [{ key: 'MCB', count: 3 }], byDistrict: [{ key: 'PORT_LOUIS', count: 2 }], topDomains: [{ key: 'parcel-track-mu.com', count: 2 }] }),
  expected,
);
// The types.ts contract shape passes through unchanged.
assert.deepEqual(toTrending(expected), expected);
// Unknown enums, junk rows and a missing body are dropped, never crash the Feed.
assert.deepEqual(
  toTrending({ byInstitution: [{ key: 'NASA', count: 1 }, null, { key: 'MCB', count: 'x' }], byDistrict: 'nope' }),
  { byInstitution: [], byDistrict: [], topDomains: [] },
);
assert.deepEqual(toTrending(null), { byInstitution: [], byDistrict: [], topDomains: [] });

// Every enum has a label.
for (const i of INSTITUTIONS) assert.ok(institutionLabel(i));
for (const d of DISTRICTS) assert.ok(DISTRICT_LABEL[d]);
assert.equal(institutionLabel('POLICE'), 'Police');

console.log('feed ok');
