import assert from 'node:assert/strict';
import { checkCaller } from './caller.ts';

const v = (n: string) => checkCaller(n).verdict;
assert.equal(v('5712 3456'), 'SAFE'); // local mobile
assert.equal(v('+230 5712 3456'), 'SAFE');
assert.equal(v('00230 212 3456'), 'SAFE'); // landline
assert.equal(v('+225 0701 2345'), 'HIGH_RISK'); // wangiri code
assert.equal(v('00243 812 345 678'), 'HIGH_RISK');
assert.equal(v('+44 7700 900123'), 'SUSPICIOUS'); // other foreign
assert.equal(v('123'), 'SUSPICIOUS'); // malformed
assert.equal(v('+230 999'), 'SUSPICIOUS');
assert.ok(checkCaller('+225 0701 2345').flags[0].includes('+225'));
console.log('caller ok');
