// Run: node src/shared/coach.test.ts
import assert from 'node:assert/strict';
import { HANG_UP_CUTOFF, QUESTIONS, coachScore, isHangUp, topFlag, type Answers } from './coach.ts';
import { validateVars } from './messages.ts';

const ids = QUESTIONS.map((q) => q.id);
assert.deepEqual(ids, ['secret', 'money', 'authority', 'pressure', 'family', 'appOrLink'], 'PLAN §4 order: OTP question first');

// PLAN §4: the five cutoff cases.
assert.equal(coachScore({ authority: 1 }), 0.4);
assert.equal(isHangUp(coachScore({ authority: 1 })), false, '1. a claim alone is not a scam');
assert.equal(coachScore({ authority: 1, pressure: 1 }), 0.76);
assert.equal(isHangUp(coachScore({ authority: 1, pressure: 1 })), true, '2. claim + rushing');
assert.equal(coachScore({ authority: 1, money: 1 }), 0.88);
assert.equal(isHangUp(coachScore({ authority: 1, money: 1 })), true, '3. claim + money');
assert.equal(coachScore({ secret: 1 }), 1);
assert.equal(isHangUp(coachScore({ secret: 1 })), true, '4. OTP/PIN alone');
for (const x of ids) for (const y of ids) {
  if (x !== y) assert.equal(isHangUp(coachScore({ [x]: 0.5, [y]: 0.5 })), false, `5. two NOT SUREs (${x}, ${y}) never hang up`);
}
assert.equal(HANG_UP_CUTOFF, 0.75);

// 12 call scenarios, written from Mauritius Police / bank scam-call warnings. Unanswered = NO.
const SCENARIOS: [name: string, answers: Answers, hangUp: boolean][] = [
  ['fake Police: son arrested, pay a fine now', { money: 1, authority: 1, pressure: 1, family: 1 }, true],
  ['fake bank: "read me the OTP we just sent"', { secret: 1, authority: 1 }, true],
  ['fake bank: card blocked, install a remote-help app', { authority: 1, appOrLink: 1 }, true],
  ['"Hi Mum, new number": child in trouble, send money', { money: 1, family: 1 }, true],
  ['fake MRA refund: confirm your card PIN', { secret: 1, authority: 1 }, true],
  ['fake CEB: pay today or we cut your power', { money: 1, authority: 1, pressure: 1 }, true],
  ['prize call: pay a small fee to claim', { money: 1 }, true],
  ['investment "advisor": download our trading app, deposit now', { money: 1, appOrLink: 1, pressure: 1 }, true],
  ['real bank: checking a card payment, asks for nothing', { authority: 1 }, false],
  ['real family call', {}, false],
  ['delivery driver, caller unsure if official', { authority: 0.5 }, false],
  ['unsure on rushing and family', { pressure: 0.5, family: 0.5 }, false],
];
assert.equal(SCENARIOS.length, 12);
for (const [name, answers, hangUp] of SCENARIOS) assert.equal(isHangUp(coachScore(answers)), hangUp, name);

// Short-circuit (PLAN §4): OTP YES ends the questionnaire, whatever comes after.
assert.equal(isHangUp(coachScore({ secret: 1 })), true);
// Demo step 5 / "done when": fake Police reaches HANG UP by question 2, on-device, no network.
assert.equal(isHangUp(coachScore({ secret: 0, money: 1 })), true);

// The optional /api/coach score can only raise risk; junk is ignored.
assert.equal(coachScore({ authority: 1 }, 0.9), 0.9);
assert.equal(coachScore({ secret: 1 }, 0.1), 1);
assert.equal(coachScore({ authority: 1 }, NaN), 0.4);
assert.equal(coachScore({ authority: 1 }, 7), 1, 'server score capped at 1');
assert.equal(coachScore({}), 0);

// Top red flag → call_alert {{2}}: highest weight × answer, fixed wording only.
assert.equal(topFlag({ authority: 1, money: 1 }), 'the caller asked for money to be paid or moved now');
assert.equal(topFlag({ secret: 1, money: 1 }), 'the caller asked for an OTP, PIN or password');
assert.equal(topFlag({}), 'the caller showed signs of a scam');
// Every flag must pass the WhatsApp template check, or the alert silently falls back to wa.me only.
for (const flag of [...QUESTIONS.map((q) => q.flag), topFlag({})]) validateVars('call_alert', ['Asha', flag]);

console.log('coach ok');
