// Run: node src/shared/feed.test.ts
import assert from 'node:assert/strict';
import { DISTRICT_LABEL, institutionLabel, realSiteFor, toTrending } from './feed.ts';
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

// Real vs fake address: the official site a reported domain copies, and the part that differs.
assert.deepEqual(realSiteFor('mcb-secure-login.com'), { real: 'mcb.mu', name: 'MCB', same: 'mcb', extra: '-secure-login.com' });
assert.deepEqual(realSiteFor('parcel-track-mu.com'), { real: 'mauritiuspost.mu', name: 'Mauritius Post', same: '', extra: 'parcel-track-mu.com' });
assert.deepEqual(realSiteFor('mauritiuspost-delivery.top'), { real: 'mauritiuspost.mu', name: 'Mauritius Post', same: 'mauritiuspost', extra: '-delivery.top' });
assert.equal(realSiteFor('sbm-refund.xyz')?.real, 'sbmgroup.mu');
assert.equal(realSiteFor('my-t-promo.win'), null, 'needs the whole token, not a fragment');
assert.equal(realSiteFor('lexpress-mu-news.top'), null, 'no known brand → no real site shown');
assert.equal(realSiteFor('postcard-shop.com'), null, '"post" must be a whole word');
assert.equal(realSiteFor('mcb.mu'), null, 'the official site itself is never a fake');
assert.equal(realSiteFor('login.mcb.mu'), null, 'nor its subdomains');

console.log('feed ok');
