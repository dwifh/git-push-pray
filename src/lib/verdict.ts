// Pure. Verdict = max(rule floor, jevLevel, claudeLevel): models can only add risk. The calibration run
// (src/lib/calibration.json, `npm run eval`, PLAN §3.6) decides whether they may add HIGH_RISK or only SUSPICIOUS.
import { DEFAULT_CALIBRATION, type Calibration, type Verdict } from './calibration.ts';
import { SIGNAL_NAMES } from './scam-signals.ts';

export const Level = { SAFE: 0, SUSPICIOUS: 1, HIGH_RISK: 2 } as const;
export type Level = (typeof Level)[keyof typeof Level];
export const LEVEL_NAME: Record<Level, Verdict> = { 0: 'SAFE', 1: 'SUSPICIOUS', 2: 'HIGH_RISK' };

export const maxLevel = (...levels: Level[]) => Math.max(Level.SAFE, ...levels) as Level;

// score = Jev noisy-OR score with calibrated weights, or null when the Jev call failed.
export function jevLevel(score: number | null, jev: Calibration['jev']): Level {
  if (score == null) return Level.SAFE;
  if (jev.highRisk != null && score >= jev.highRisk) return Level.HIGH_RISK;
  return score >= jev.suspicious ? Level.SUSPICIOUS : Level.SAFE;
}

export function claudeLevel(verdict: Verdict | null, claude: Calibration['claude']): Level {
  if (verdict === 'HIGH_RISK') return claude.highRiskTrusted ? Level.HIGH_RISK : Level.SUSPICIOUS;
  return verdict === 'SUSPICIOUS' ? Level.SUSPICIOUS : Level.SAFE;
}

const unit = (x: unknown) => typeof x === 'number' && x >= 0 && x <= 1;

// Validates the generated file; anything off → PLAN defaults, so a bad file cannot crash a scan.
// Even a valid file can only demote HIGH_RISK to SUSPICIOUS; nothing here can make a flagged scan SAFE.
export function loadCalibration(json: unknown): Calibration {
  const c = json as Calibration | undefined;
  if (!c) return DEFAULT_CALIBRATION;
  const ok =
    unit(c.jev?.suspicious) &&
    (c.jev.highRisk === null || (unit(c.jev.highRisk) && c.jev.highRisk >= c.jev.suspicious)) &&
    SIGNAL_NAMES.every((n) => unit(c.jev.weights?.[n])) &&
    typeof c.claude?.highRiskTrusted === 'boolean';
  return ok ? c : DEFAULT_CALIBRATION;
}
