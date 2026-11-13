// Pure. PLAN §3.2: the rule floor. Code owns it; models can only raise the verdict above it.
import { INSTITUTION_LABEL, type DomainIntel } from '../shared/types.ts';
import type { EmailFacts } from './email.ts';
import { BRANDS, isReportImmune, isSharedHost, isShortener, lookalikeOf, registrableDomain } from './extract.ts';
import { intelLevel } from './threat-intel.ts';
import { Level, maxLevel } from './verdict.ts';

export type RuleFacts = {
  text: string; // redacted
  domains: string[]; // extractDomains(text)
  intel?: DomainIntel[]; // domain = the exact host, so the SHARED_HOSTS cap applies
  communityReports?: { domain: string; reporters: number }[]; // domain = registrableDomain, as stored (PLAN §5)
  ragMatches?: { title: string; score: number }[];
  email?: EmailFacts; // Email Guard only (PLAN §6)
};

const RAG_MATCH_THRESHOLD = 0.55; // shortcut: PLAN start value; calibrate on the demo messages (TEAM-PLAN §5)

// Rules read redacted text: an OTP is "[CODE]", a number is "[PHONE …]". Wording within one sentence (no . ! ? or newline).
const CREDENTIAL = String.raw`(?:otp|one[- ]time (?:password|pin|code)|pin|password|passcode|cvv|cvc|card (?:number|details)|security code|verification code|(?:login|bank|banking) details)`;
const CREDENTIAL_ASK_RE = new RegExp(
  String.raw`\b(?:send|share|give|enter|confirm|provide|verify|update|reply with|tell|submit|type|forward)\b[^.!?\n]{0,40}\b${CREDENTIAL}\b|\b${CREDENTIAL}\b[^.!?\n]{0,20}\b(?:is|are) (?:required|needed)\b`,
  'gi',
);
const NEGATED_RE = /\b(?:not|never|n't|no one|nobody)\b[^.!?\n]{0,15}$/i; // "Never share your OTP" is advice, not a request
const PAYMENT_RE =
  /\b(?:pay|transfer|send|deposit|settle)\b[^.!?\n]{0,40}(?:\b(?:fees?|fines?|charges?|rs|mur|rupees|money|amount|penalty)\b|[£$€]\s?\d)|\b(?:customs|delivery|redelivery|processing|release|clearance|admin) (?:fees?|charges?)\b|\b(?:buy|send|purchase)\b[^.!?\n]{0,30}\b(?:gift ?cards?|vouchers?)\b/i; // a promo voucher is not a request
const PRESSURE_RE =
  /\bwithin \d+ ?(?:hours?|hrs?|minutes?|mins?|days?)\b|\b(?:account|card|line|service|number)\b[^.!?\n]{0,20}\b(?:blocked|suspended|locked|deactivated|disabled|terminated)\b|\bdisconnect(?:ed|ion)?\b|\barrest(?:ed)?\b|\b(?:act|respond|reply|call|pay|verify|confirm|click|update) (?:now|immediately|urgently|today)\b|\burgent (?:action|attention|response)\b|\b(?:final (?:notice|warning|reminder)|last (?:chance|warning)|legal action|expires? today)\b/i;
// Bare "immediately" / "urgent" are everyday business words (DIFrauD genuine mail): only a demand counts.

const asksForCredential = (text: string) =>
  [...text.matchAll(CREDENTIAL_ASK_RE)].some((m) => !NEGATED_RE.test(text.slice(0, m.index)));

// Whole words only: "MRA Refunds" names MRA, "Mramar Hotels" does not.
const brandIn = (displayName: string) => {
  const words = ` ${displayName.toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
  return BRANDS.find((b) => b.names.some((n) => words.includes(` ${n} `)));
};

export function ruleFloor(f: RuleFacts): { level: Level; flags: string[] } {
  const hits: [Level, string][] = [];
  const add = (level: Level, flag: string) => hits.push([level, flag]);

  for (const d of f.domains) {
    const imitated = lookalikeOf(d);
    if (imitated) add(Level.HIGH_RISK, `A link pretends to be ${imitated} but goes to a different website.`);
    if (isShortener(d)) add(Level.SUSPICIOUS, 'A shortened link hides where it really goes.');
  }
  for (const i of f.intel ?? []) {
    const lvl = intelLevel(i.domain, i);
    if (lvl === Level.HIGH_RISK) add(lvl, 'Security services list a link in this message as dangerous.');
    else if (lvl === Level.SUSPICIOUS && isSharedHost(i.domain))
      add(lvl, 'A link goes to a site that hosts files for anyone; one of them was reported as malware.');
    else if (lvl === Level.SUSPICIOUS) add(lvl, 'A security service flagged a link in this message.');
  }
  const reporters = Math.max(0, ...(f.communityReports ?? []).filter((r) => !isReportImmune(r.domain)).map((r) => r.reporters));
  if (reporters >= 3) add(Level.HIGH_RISK, `${reporters} people reported this website as a scam.`);
  else if (reporters > 0) add(Level.SUSPICIOUS, `${reporters === 1 ? '1 person' : '2 people'} reported this website as a scam.`);

  if (asksForCredential(f.text)) {
    if (f.domains.length || /\[PHONE/.test(f.text))
      add(Level.HIGH_RISK, 'It asks for a secret code, PIN or password and gives a link or number to send it to.');
    else add(Level.SUSPICIOUS, 'It asks for a secret code, PIN or password. Your bank never asks for these.');
  }
  if (PAYMENT_RE.test(f.text)) add(Level.SUSPICIOUS, 'It asks you to pay a fee or send money.');
  if (PRESSURE_RE.test(f.text)) add(Level.SUSPICIOUS, 'It rushes or threatens you (a deadline, a blocked account, disconnection or arrest).');
  const rag = (f.ragMatches ?? []).find((m) => m.score >= RAG_MATCH_THRESHOLD);
  if (rag) add(Level.SUSPICIOUS, `It looks like a known scam: ${rag.title}.`);

  const e = f.email;
  if (e) {
    const brand = brandIn(e.displayName);
    if (brand && (e.dmarc === 'fail' || e.spf === 'fail'))
      add(Level.HIGH_RISK, `The sender's name says ${INSTITUTION_LABEL[brand.institution]} but the email failed its authenticity check.`);
    const imitated = e.fromDomain && lookalikeOf(e.fromDomain);
    if (imitated) add(Level.HIGH_RISK, `The sender's address pretends to be ${imitated}.`);
    if (e.fromDomain && e.replyToDomain && registrableDomain(e.fromDomain) !== registrableDomain(e.replyToDomain))
      add(Level.SUSPICIOUS, "Replies would go to a different address from the sender's.");
  }

  return { level: maxLevel(...hits.map(([l]) => l)), flags: [...new Set(hits.map(([, flag]) => flag))] };
}
