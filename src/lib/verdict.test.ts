// Run: node src/lib/verdict.test.ts
import assert from 'node:assert/strict';
import { DEFAULT_CALIBRATION } from './calibration.ts';
import { Level, claudeLevel, jevLevel, loadCalibration, maxLevel } from './verdict.ts';

const cal = loadCalibration(DEFAULT_CALIBRATION);

// Monotonic: a lower model verdict never lowers the rule floor.
assert.equal(maxLevel(Level.HIGH_RISK, Level.SAFE, Level.SAFE), Level.HIGH_RISK);
assert.equal(maxLevel(Level.SAFE, Level.SUSPICIOUS), Level.SUSPICIOUS);

// Jev: cutoffs come from the calibration (PLAN defaults 0.6 / 0.85).
assert.equal(jevLevel(null, cal.jev), Level.SAFE, 'failed Jev call adds no level');
assert.equal(jevLevel(0.59, cal.jev), Level.SAFE);
assert.equal(jevLevel(0.6, cal.jev), Level.SUSPICIOUS);
assert.equal(jevLevel(0.85, cal.jev), Level.HIGH_RISK);
assert.equal(jevLevel(0.99, { ...cal.jev, highRisk: null }), Level.SUSPICIOUS, 'low AUC or never precise: Jev caps at SUSPICIOUS, never SAFE');
assert.equal(jevLevel(0.4, { ...cal.jev, suspicious: 0.35 }), Level.SUSPICIOUS, 'calibrated cutoff is used');

// Claude: an imprecise HIGH_RISK is demoted to SUSPICIOUS, never silenced.
assert.equal(claudeLevel(null, cal.claude), Level.SAFE, 'failed Claude call adds no level');
assert.equal(claudeLevel('SAFE', cal.claude), Level.SAFE);
assert.equal(claudeLevel('HIGH_RISK', cal.claude), Level.HIGH_RISK, 'default: full trust');
const shaky = { ...cal.claude, highRiskTrusted: false };
assert.equal(claudeLevel('HIGH_RISK', shaky), Level.SUSPICIOUS, 'imprecise HIGH_RISK is demoted');
assert.equal(claudeLevel('SUSPICIOUS', shaky), Level.SUSPICIOUS, 'SUSPICIOUS always counts');
assert.equal(maxLevel(Level.HIGH_RISK, claudeLevel('HIGH_RISK', shaky)), Level.HIGH_RISK, 'distrust never lowers the floor');

// A missing or corrupt calibration file falls back to the PLAN defaults instead of crashing.
assert.deepEqual(loadCalibration(undefined), DEFAULT_CALIBRATION);
assert.deepEqual(loadCalibration({ jev: { suspicious: 'x' } }), DEFAULT_CALIBRATION);
assert.deepEqual(loadCalibration({ ...DEFAULT_CALIBRATION, claude: { ...cal.claude, highRiskTrusted: 'yes' } }), DEFAULT_CALIBRATION);
assert.deepEqual(loadCalibration({ ...DEFAULT_CALIBRATION, jev: { ...cal.jev, suspicious: 0.9, highRisk: 0.8 } }), DEFAULT_CALIBRATION, 'cutoffs out of order');
assert.deepEqual(loadCalibration({ ...DEFAULT_CALIBRATION, jev: { ...cal.jev, weights: { ...cal.jev.weights, pressure: -1 } } }), DEFAULT_CALIBRATION);
const tuned = { ...DEFAULT_CALIBRATION, jev: { ...cal.jev, suspicious: 0.45 } };
assert.equal(loadCalibration(tuned).jev.suspicious, 0.45, 'a valid file is used');

console.log('verdict ok');
