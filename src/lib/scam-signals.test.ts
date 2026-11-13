// Run: node src/lib/scam-signals.test.ts
import assert from 'node:assert/strict';
import { PLAN_WEIGHTS, SIGNALS, clarifyFor, scamScore, signalFlags } from './scam-signals.ts';

const none = { asksForSecret: 0, paymentRequest: 0, impersonation: 0, pressure: 0, tooGoodToBeTrue: 0 };
assert.equal(scamScore(none), 0);
assert.equal(scamScore({ ...none, asksForSecret: 0.9 }), 0.9, 'secret request alone carries its full weight');
assert.equal(scamScore({ ...none, pressure: 0.8 }), 0.4, 'pressure alone is weak (0.5 × 0.8)');
assert.equal(scamScore({ ...none, impersonation: 0.5, pressure: 0.6 }), 0.51, '1 − 0.7 × 0.7');
assert.equal(scamScore({}), 0, 'no signals adds no risk (a failed Jev call is skipped, never scored)');
assert.equal(scamScore({ ...none, asksForSecret: 7 }), 1, 'out-of-range input is clamped');
assert.equal(scamScore({ ...none, asksForSecret: NaN }), 1, 'non-finite probability fails closed');

// Calibrated weights: a signal the eval showed to be noise (weight 0) adds nothing.
assert.equal(scamScore({ ...none, pressure: 1 }, { ...PLAN_WEIGHTS, pressure: 0 }), 0);
assert.equal(scamScore({ ...none, pressure: NaN }, { ...PLAN_WEIGHTS, pressure: 0 }), 0, 'dropped signal cannot fail closed either');

assert.equal(clarifyFor({ floorIsHighRisk: true, isFragment: true, missingField: 'sender' }), undefined, 'never stall high risk');
assert.match(clarifyFor({ floorIsHighRisk: false, isFragment: true, missingField: 'sender' }) ?? '', /Who sent this/);
assert.equal(clarifyFor({ floorIsHighRisk: false, isFragment: true, missingField: 'none' }), undefined);
assert.equal(clarifyFor({ floorIsHighRisk: false, isFragment: false, missingField: 'link' }), undefined);
assert.equal(clarifyFor({ floorIsHighRisk: false, isFragment: true, missingField: 'constructor' }), undefined);

// A raised Jev score always names its reasons, strongest first; a zero-weight signal never does.
assert.deepEqual(signalFlags({ ...none, pressure: 0.9, asksForSecret: 0.8 }), [SIGNALS.asksForSecret.flag, SIGNALS.pressure.flag]);
assert.deepEqual(signalFlags({ ...none, pressure: 0.4, paymentRequest: 0.3 }), [SIGNALS.paymentRequest.flag], 'only weak signals: the biggest one');
assert.deepEqual(signalFlags({ ...none, pressure: 1, impersonation: 0.6 }, { ...PLAN_WEIGHTS, pressure: 0 }), [SIGNALS.impersonation.flag]);
console.log('scam-signals ok');
