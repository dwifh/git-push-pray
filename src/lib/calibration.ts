// Pure: turns a labelled eval run into the cutoffs and trust levels the pipeline routes on,
// so a model's verdict counts only as far as the dataset shows it is right.
// A model can be demoted (HIGH_RISK → SUSPICIOUS), never silenced: a scam only one model caught must not end up SAFE.
import { PLAN_WEIGHTS, SIGNAL_NAMES, scamScore, signalValue, type SignalName, type Weights } from './scam-signals.ts';

export type Verdict = 'SAFE' | 'SUSPICIOUS' | 'HIGH_RISK';
export type EvalRow = {
  label: 'scam' | 'genuine';
  signals?: Partial<Record<SignalName, number>> | null; // null = the Jev call failed
  claude?: Verdict | null; // null = the Claude call failed
};

const MIN_ROWS = 20; // fewer successful calls than this → PLAN defaults
const MIN_CALLS = 10; // fewer Claude HIGH_RISK verdicts than this → keep the default trust
const CLAUDE_HIGH_RISK_PRECISION = 0.9;
const MIN_AUC = 0.7; // below this the Jev score can add SUSPICIOUS but never HIGH_RISK
// Only a signal that fires more on genuine messages is dropped. AUC punishes rare-but-precise signals
// (an OTP request in 3 of 30 scams scores ~0.55), which is fine for one input to a noisy-OR.
const MIN_SIGNAL_AUC = 0.5;

export const DEFAULT_CALIBRATION = {
  jev: {
    n: 0,
    auc: null as number | null,
    signalAuc: {} as Partial<Record<SignalName, number | null>>,
    weights: PLAN_WEIGHTS as Weights,
    suspicious: 0.6,
    highRisk: 0.85 as number | null,
    reliability: [] as { from: number; to: number; n: number; scamRate: number }[],
  },
  claude: {
    n: 0,
    accuracy: null as number | null,
    precision: {} as Partial<Record<'SUSPICIOUS' | 'HIGH_RISK', number>>,
    highRiskTrusted: true, // false → Claude HIGH_RISK counts as SUSPICIOUS
  },
};
export type Calibration = typeof DEFAULT_CALIBRATION;

const round = (x: number) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : null);

export function calibrate(rows: readonly EvalRow[]): Calibration {
  return { jev: calibrateJev(rows.filter((r) => r.signals)), claude: calibrateClaude(rows.filter((r) => r.claude)) };
}

function calibrateJev(rows: readonly EvalRow[]): Calibration['jev'] {
  if (rows.length < MIN_ROWS) return DEFAULT_CALIBRATION.jev;
  const isScam = rows.map((r) => r.label === 'scam');
  const signalAuc: Calibration['jev']['signalAuc'] = {};
  const weights = { ...PLAN_WEIGHTS };
  for (const name of SIGNAL_NAMES) {
    if (!rows.some((r) => r.signals![name] != null)) continue; // Jev never answered it: no evidence either way
    const auc = rocAuc(rows.map((r) => signalValue(r.signals![name])), isScam);
    signalAuc[name] = round(auc);
    if (auc < MIN_SIGNAL_AUC) weights[name] = 0;
  }
  const scores = rows.map((r) => scamScore(r.signals!, weights));
  const auc = rocAuc(scores, isScam);
  // Score reliability (score bin → share that were scams): shows whether the score reads as a confidence.
  const reliability = [0, 1, 2, 3, 4].flatMap((bin) => {
    const inBin = scores.map((s, i) => [s, isScam[i]] as const).filter(([s]) => Math.min(4, Math.floor(s * 5)) === bin);
    return inBin.length ? [{ from: bin / 5, to: (bin + 1) / 5, n: inBin.length, scamRate: round(inBin.filter(([, y]) => y).length / inBin.length)! }] : [];
  });
  const cutoffs = pickCutoffs(scores, isScam);
  if (!(auc >= MIN_AUC)) cutoffs.highRisk = null;
  return { n: rows.length, auc: round(auc), signalAuc, weights, ...cutoffs, reliability };
}

function calibrateClaude(rows: readonly EvalRow[]): Calibration['claude'] {
  if (rows.length < MIN_ROWS) return DEFAULT_CALIBRATION.claude;
  const right = rows.filter((r) => (r.claude !== 'SAFE') === (r.label === 'scam')).length;
  const precision: Calibration['claude']['precision'] = {};
  for (const v of ['SUSPICIOUS', 'HIGH_RISK'] as const) {
    const said = rows.filter((r) => r.claude === v);
    if (said.length) precision[v] = round(said.filter((r) => r.label === 'scam').length / said.length)!;
  }
  const highRiskCalls = rows.filter((r) => r.claude === 'HIGH_RISK').length;
  const highRiskTrusted = highRiskCalls < MIN_CALLS || precision.HIGH_RISK! >= CLAUDE_HIGH_RISK_PRECISION;
  return { n: rows.length, accuracy: round(right / rows.length), precision, highRiskTrusted };
}

// ROC-AUC via pairwise comparison (Mann-Whitney). O(n²) is fine for a few hundred eval rows.
export function rocAuc(scores: number[], isScam: boolean[]) {
  const pos = scores.filter((_, i) => isScam[i]);
  const neg = scores.filter((_, i) => !isScam[i]);
  if (!pos.length || !neg.length) return NaN;
  let wins = 0;
  for (const p of pos) for (const n of neg) wins += p > n ? 1 : p === n ? 0.5 : 0;
  return wins / (pos.length * neg.length);
}

export const TARGET = { recall: 0.95, precision: 0.95 };
const SUSPICIOUS_BOUNDS = [0.3, 0.7] as const; // keeps a small eval set from dragging the cutoff to an extreme
const HIGH_RISK_MIN = 0.7;

export function pickCutoffs(scores: number[], isScam: boolean[]) {
  const total = isScam.filter(Boolean).length;
  const at = (t: number) => {
    const flagged = scores.map((s, i) => [s, isScam[i]] as const).filter(([s]) => s >= t);
    const hits = flagged.filter(([, scam]) => scam).length;
    return { recall: hits / total, precision: hits / flagged.length };
  };
  const desc = [...new Set(scores)].sort((a, b) => b - a);
  const recallCut = desc.find((t) => at(t).recall >= TARGET.recall) ?? 0;
  const suspicious = Math.min(SUSPICIOUS_BOUNDS[1], Math.max(SUSPICIOUS_BOUNDS[0], recallCut));
  // Precision is not monotonic in t, so only cutoffs at or above the floor are candidates.
  const floor = Math.max(HIGH_RISK_MIN, suspicious);
  const highRisk = desc.filter((t) => t >= floor && at(t).precision >= TARGET.precision).at(-1) ?? null;
  return { suspicious, highRisk };
}
