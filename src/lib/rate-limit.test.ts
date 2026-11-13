// Run: node src/lib/rate-limit.test.ts
import assert from 'node:assert/strict';
import { allowRequest } from './rate-limit.ts';

const t = 1_000_000;
assert.equal(allowRequest('scan', 'a', 2, 10, t), true);
assert.equal(allowRequest('scan', 'a', 2, 10, t + 1), true);
assert.equal(allowRequest('scan', 'a', 2, 10, t + 2), false, 'per-user cap');
assert.equal(allowRequest('alert', 'a', 2, 10, t + 2), true, 'other routes keep their own per-user bucket');
assert.equal(allowRequest('scan', 'b', 2, 10, t + 3), true, 'other users unaffected');
assert.equal(allowRequest('scan', 'a', 2, 10, t + 60_001), true, 'window slides');
// Global cap on 'scan': 'a' (t+60_001) and 'b' (t+3) are both still in window -> 2 of 3 used.
assert.equal(allowRequest('scan', 'c', 5, 3, t + 60_002), true);
assert.equal(allowRequest('scan', 'd', 5, 3, t + 60_002), false, 'global cap');
assert.equal(allowRequest('alert', 'd', 5, 3, t + 60_002), true, 'global cap is per route');
console.log('rate-limit ok');
