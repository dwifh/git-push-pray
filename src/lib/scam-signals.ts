// Pure rules (no runtime imports) so they can be tested with plain Node.
// `flag` is the plain-English red flag shown when this signal raises the verdict.
export const SIGNALS = {
  asksForSecret: {
    weight: 1,
    question: 'Does the message ask for an OTP, PIN, password, card number or bank login?',
    flag: 'It seems to ask for a secret code, PIN, password or card details.',
  },
  paymentRequest: {
    weight: 0.7,
    question: 'Does it ask the reader to pay, transfer money or buy vouchers or gift cards?',
    flag: 'It seems to ask you to pay or send money.',
  },
  // A claim alone is not a scam: genuine CEB and bank notices name themselves (scored 0.96 on "claims to be from" on 2026-11-13).
  impersonation: {
    weight: 0.6,
    question:
      'Does it pretend to be a bank, Mauritius Post, CEB, CWA, MRA, Police, a telecom company or a family member, with signs it is not really them (a link or number that is not theirs, a new number, or a request they would not make)?',
    flag: 'It seems to pretend to be an organisation or person you trust.',
  },
  pressure: { weight: 0.5, question: 'Does it threaten, rush or create panic?', flag: 'It seems to rush or frighten you.' },
  tooGoodToBeTrue: {
    weight: 0.4,
    question: 'Does it promise a prize, refund, job or investment return?',
    flag: 'It promises a prize, refund, job or return that sounds too good to be true.',
  },
} as const;

export type SignalName = keyof typeof SIGNALS;
export type Weights = Record<SignalName, number>;
export const SIGNAL_NAMES = Object.keys(SIGNALS) as SignalName[];
export const PLAN_WEIGHTS = Object.fromEntries(SIGNAL_NAMES.map((n) => [n, SIGNALS[n].weight])) as Weights;

// A missing signal adds nothing (0): Jev can only raise risk, and when the Jev call fails the pipeline
// skips Jev entirely. A present but non-finite value (NaN) fails closed (1).
export function signalValue(raw: number | undefined | null) {
  return raw == null ? 0 : Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 1;
}

// Noisy-OR: score = 1 - Π(1 - weight·p). One strong signal is enough; weak ones add up.
// Weights come from the calibration run (a signal that does not separate scams gets 0).
export function scamScore(p: Partial<Record<SignalName, number>>, weights: Weights = PLAN_WEIGHTS) {
  let safe = 1;
  for (const name of SIGNAL_NAMES) safe *= 1 - weights[name] * signalValue(p[name]);
  return Math.round((1 - safe) * 1000) / 1000;
}

// The reasons behind a raised Jev score, strongest first: every signal at p ≥ 0.5, or else the single biggest contributor.
export function signalFlags(p: Partial<Record<SignalName, number>>, weights: Weights = PLAN_WEIGHTS) {
  const ranked = SIGNAL_NAMES.filter((n) => weights[n] > 0).sort((a, b) => weights[b] * signalValue(p[b]) - weights[a] * signalValue(p[a]));
  const strong = ranked.filter((n) => signalValue(p[n]) >= 0.5);
  return (strong.length ? strong : ranked.slice(0, 1)).map((n) => SIGNALS[n].flag);
}

const CLARIFY: Record<string, string> = {
  sender: 'Who sent this? Add the number or name shown.',
  link: 'Please paste the whole message, including any link.',
  full_text: 'This looks cut off. Please paste the whole message.',
};

// Never stall a clear scam with a question: HIGH_RISK answers first.
export function clarifyFor(t: { floorIsHighRisk: boolean; isFragment: boolean; missingField: string }) {
  return !t.floorIsHighRisk && t.isFragment && Object.hasOwn(CLARIFY, t.missingField) ? CLARIFY[t.missingField] : undefined;
}
