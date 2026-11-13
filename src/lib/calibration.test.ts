// Run: node src/lib/calibration.test.ts
import assert from 'node:assert/strict';
import { DEFAULT_CALIBRATION, calibrate, pickCutoffs, rocAuc } from './calibration.ts';

// AUC = chance a random scam scores above a random genuine message (ties count half).
assert.equal(rocAuc([0.9, 0.8, 0.2, 0.1], [true, true, false, false]), 1, 'perfect separation');
assert.equal(rocAuc([0.1, 0.2, 0.8, 0.9], [true, true, false, false]), 0, 'perfectly reversed');
assert.equal(rocAuc([0.5, 0.5, 0.5, 0.5], [true, true, false, false]), 0.5, 'all ties');
assert.equal(rocAuc([0.9, 0.4, 0.6, 0.1], [true, true, false, false]), 0.75, '3 of 4 pairs ordered');
assert.ok(Number.isNaN(rocAuc([0.9, 0.8], [true, true])), 'undefined without both classes');

// SUSPICIOUS = highest cutoff that still catches 95% of scams, kept in [0.3, 0.7].
// HIGH_RISK = lowest cutoff ≥ max(0.7, SUSPICIOUS) whose flags are ≥95% scams; null if none.
const scams = [0.95, 0.9, 0.8, 0.5];
const genuine = [0.6, 0.2, 0.1, 0];
const isScam = [...scams.map(() => true), ...genuine.map(() => false)];
assert.deepEqual(pickCutoffs([...scams, ...genuine], isScam), { suspicious: 0.5, highRisk: 0.8 });
assert.deepEqual(pickCutoffs([0.1, 0.05, 0], [true, true, false]), { suspicious: 0.3, highRisk: null }, 'clamped up; no evidence above 0.7');
assert.deepEqual(pickCutoffs([0.95, 0.9, 0.1], [true, true, false]), { suspicious: 0.7, highRisk: 0.9 }, 'clamped down');
assert.deepEqual(pickCutoffs([0.5, 0.9], [true, false]), { suspicious: 0.5, highRisk: null }, 'never precise enough');
const lowScams = [0.9, 0.75, ...Array(40).fill(0.5)];
assert.equal(pickCutoffs(lowScams, lowScams.map((_, i) => i >= 2)).highRisk, null, 'precise only below 0.7: no HIGH_RISK cutoff');

// calibrate. Models can be demoted, never silenced: a scam only one model caught must not end up SAFE.
const scamRow = { label: 'scam', signals: { asksForSecret: 0.9, pressure: 0.1 }, claude: 'HIGH_RISK' } as const;
const safeRow = { label: 'genuine', signals: { asksForSecret: 0, pressure: 0.9 }, claude: 'SAFE' } as const;
const alarmRow = { label: 'genuine', signals: { asksForSecret: 0, pressure: 0.9 }, claude: 'SUSPICIOUS' } as const;
const rows = [...Array(10).fill(scamRow), ...Array(8).fill(safeRow), ...Array(12).fill(alarmRow)];
const cal = calibrate(rows);
assert.equal(cal.jev.signalAuc.asksForSecret, 1);
assert.equal(cal.jev.weights.asksForSecret, 1, 'informative signal keeps its weight');
assert.equal(cal.jev.weights.pressure, 0, 'signal that fires more on genuine messages (AUC < 0.5) is dropped');
assert.equal(cal.jev.weights.paymentRequest, 0.7, 'signal with no data keeps the PLAN weight');
assert.equal(cal.jev.auc, 1);
assert.deepEqual([cal.jev.suspicious, cal.jev.highRisk], [0.7, 0.9]);
assert.equal(cal.claude.accuracy, 0.6, '18 of 30 right');
assert.deepEqual(cal.claude.precision, { SUSPICIOUS: 0, HIGH_RISK: 1 });
assert.equal(cal.claude.highRiskTrusted, true, '10/10 HIGH_RISK calls were scams');

const rare = calibrate([
  ...Array(3).fill({ label: 'scam', signals: { asksForSecret: 0.9 } }),
  ...Array(27).fill({ label: 'scam', signals: { asksForSecret: 0 } }),
  ...Array(30).fill({ label: 'genuine', signals: { asksForSecret: 0 } }),
]);
assert.equal(rare.jev.signalAuc.asksForSecret, 0.55);
assert.equal(rare.jev.weights.asksForSecret, 1, 'rare but precise signal (AUC 0.55) keeps its weight');

const mixed = calibrate([...Array(8).fill(scamRow), ...Array(2).fill({ ...safeRow, claude: 'HIGH_RISK' }), ...Array(20).fill(safeRow)]);
assert.equal(mixed.claude.highRiskTrusted, false, '80% precise HIGH_RISK is demoted to SUSPICIOUS');
const fewCalls = calibrate([...Array(5).fill({ ...safeRow, claude: 'HIGH_RISK' }), ...Array(20).fill(safeRow)]);
assert.equal(fewCalls.claude.highRiskTrusted, true, 'fewer than 10 HIGH_RISK calls: keep the default');

const coinFlip = calibrate([...Array(15).fill(scamRow), ...Array(15).fill({ ...scamRow, label: 'genuine' })]);
assert.equal(coinFlip.jev.auc, 0.5);
assert.equal(coinFlip.jev.highRisk, null, 'Jev no better than chance can still add SUSPICIOUS, never HIGH_RISK');
assert.deepEqual(calibrate(rows.slice(0, 5)).jev, DEFAULT_CALIBRATION.jev, 'too few rows: PLAN defaults');
assert.deepEqual(calibrate(rows.map((r) => ({ ...r, signals: null, claude: null }))), DEFAULT_CALIBRATION, 'failed calls are skipped');

const edge = calibrate([...Array(10).fill({ label: 'scam', signals: { asksForSecret: 0.6 } }), ...Array(10).fill({ label: 'genuine', signals: {} })]);
assert.deepEqual(edge.jev.reliability, [{ from: 0, to: 0.2, n: 10, scamRate: 0 }, { from: 0.6, to: 0.8, n: 10, scamRate: 1 }], 'a 0.6 score lands in one bin');

console.log('calibration ok');
