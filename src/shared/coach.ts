// Elder Call Coach scoring (PLAN §4). Pure, no imports: runs on-device, so it works offline.
// `flag` is the fixed call_alert {{2}} text; it never carries what the user typed.
export const QUESTIONS = [
  { id: 'secret', weight: 1, text: 'Are they asking for an OTP, PIN or password?', flag: 'the caller asked for an OTP, PIN or password' },
  { id: 'money', weight: 0.8, text: 'Are they asking you to pay or move money right now?', flag: 'the caller asked for money to be paid or moved now' },
  { id: 'authority', weight: 0.4, text: 'Do they say they are Police, your bank, or a government office?', flag: 'the caller claimed to be Police, a bank or a government office' },
  { id: 'pressure', weight: 0.6, text: 'Are they rushing you or telling you not to tell anyone?', flag: 'the caller was rushing them and asking for secrecy' },
  { id: 'family', weight: 0.6, text: 'Do they say a family member is in trouble?', flag: 'the caller said a family member is in trouble' },
  { id: 'appOrLink', weight: 0.8, text: 'Did they ask you to install an app or open a link?', flag: 'the caller asked them to install an app or open a link' },
] as const;

export type QuestionId = (typeof QUESTIONS)[number]['id'];
export type Answer = 0 | 0.5 | 1; // NO | NOT SURE | YES
export type Answers = Partial<Record<QuestionId, Answer>>;
export const HANG_UP_CUTOFF = 0.75;

/** Noisy-OR of the answers, then the max with the optional /api/coach score (it can only raise risk). */
export function coachScore(answers: Answers, serverScore?: number) {
  let safe = 1;
  for (const q of QUESTIONS) safe *= 1 - q.weight * (answers[q.id] ?? 0);
  const local = Math.round((1 - safe) * 1000) / 1000;
  return Number.isFinite(serverScore) ? Math.max(local, Math.min(1, serverScore as number)) : local;
}

export const isHangUp = (score: number) => score >= HANG_UP_CUTOFF;

/** The strongest warning sign answered, for the call_alert template. */
export function topFlag(answers: Answers): string {
  let best = 0;
  let flag = 'the caller showed signs of a scam';
  for (const q of QUESTIONS) {
    const v = q.weight * (answers[q.id] ?? 0);
    if (v > best) [best, flag] = [v, q.flag];
  }
  return flag;
}
