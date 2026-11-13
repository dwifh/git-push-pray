// Server-only. PLAN §3 / CLAUDE.md pipeline, shared by /api/scan and /api/email:
// redact → extract + rules → evidence (parallel, 3 s, `unknown` on failure) → Jev → Claude → max(floor, Jev, Claude).
// Every step after redaction sees only redacted text. Deps are injectable so tests and the eval run offline or capture raw outputs.
import { IMPORTANCES, LIMITS, VERDICTS, isOneOf, type DomainIntel, type Importance, type ScanRequest, type ScanResult, type Verdict } from '../shared/types.ts';
import calibrationJson from './calibration.json' with { type: 'json' };
import { CLAUDE_MODEL, callClaude, type ClaudeResult } from './claude.ts';
import { parseHeaders, type EmailFacts } from './email.ts';
import { extractDomains, registrableDomain } from './extract.ts';
import { JEV_MODEL, callJevDecision, type JevQuestion } from './jev.ts';
import { checkDomain } from './threat-intel.ts';
import { searchKnowledgeBase } from './rag.ts';
import { redact } from './redact.ts';
import { communityReports } from './reports.ts';
import { RAG_MATCH_THRESHOLD, ruleFloor } from './rules.ts';
import { SIGNAL_NAMES, SIGNALS, clarifyFor, scamScore, signalFlags, type SignalName } from './scam-signals.ts';
import { LEVEL_NAME, Level, claudeLevel, jevLevel, loadCalibration, maxLevel } from './verdict.ts';

const CAL = loadCalibration(calibrationJson);
const EVIDENCE_TIMEOUT_MS = 3000;
const INCOMPLETE = 'Automatic check incomplete: one of our checks did not answer, so this result rests on fewer signals.';
// Used when Claude is down, skipped, or rated lower than the final verdict (its "looks fine" must not sit on a red card).
const ADVICE: Record<Verdict, string> = {
  SAFE: 'No known scam signs found. Still, never share a PIN, password or OTP with anyone.',
  SUSPICIOUS: 'Be careful. Do not click links, pay or share codes until you have checked with the organisation on a number you already trust.',
  HIGH_RISK: 'Do not click any link, reply, pay or share any code. If it claims to be your bank, call the number on the back of your card.',
};

export type JevResult = { signals: Partial<Record<SignalName, number>>; isFragment: number; missingField: string; importance?: string };
export type Deps = {
  jev: (text: string, email?: boolean) => Promise<JevResult | null>; // email: also ask `importance`
  claude: (text: string, evidence: string) => Promise<ClaudeResult | null>;
  intel: (hosts: string[]) => Promise<DomainIntel[]>;
  reports: (domains: string[]) => Promise<{ domain: string; reporters: number }[]>; // registrable domains
  rag: (text: string) => Promise<{ title: string; score: number }[]>;
};

const JEV_QUESTIONS: Record<string, JevQuestion> = {
  ...Object.fromEntries(SIGNAL_NAMES.map((n) => [n, { type: 'noul', instructions: SIGNALS[n].question }])),
  // Narrow on purpose: "…or missing what it refers to" read as a fragment on 56% of eval messages (2026-11-13), skipping Claude.
  isFragment: { type: 'noul', instructions: 'Is this text visibly cut off: does it stop mid-sentence, or clearly start partway through a longer message?' },
  missingField: {
    type: 'choice',
    instructions: 'What one missing thing would most help decide whether this is a scam?',
    criteria: { sender: 'Who sent it', link: 'The link or number it refers to', full_text: 'The rest of the message', none: 'Nothing important is missing' },
  },
};

// Email path only: /api/scan still sends JEV_QUESTIONS unchanged, so its calibration (record + calibrate) still holds.
const EMAIL_JEV_QUESTIONS: Record<string, JevQuestion> = {
  ...JEV_QUESTIONS,
  importance: {
    type: 'choice',
    instructions: "If this email is genuine, how much does it need the reader's attention?",
    criteria: { URGENT: 'Needs action soon (a bill, a deadline, an account problem)', ROUTINE: 'Normal personal or service mail', PROMOTIONAL: 'Newsletter, advert or marketing' },
  },
};
// Jev down or off-list answer → ROUTINE: URGENT would rush the reader (what scams want), PROMOTIONAL could bury real mail.
const DEFAULT_IMPORTANCE: Importance = 'ROUTINE';

async function liveJev(text: string, email = false): Promise<JevResult | null> {
  const a = await callJevDecision({ message: text }, email ? EMAIL_JEV_QUESTIONS : JEV_QUESTIONS);
  if (!SIGNAL_NAMES.some((n) => a?.[n]?.noul != null)) return null; // a reply with no signals is a failed call, not "no risk"
  return {
    signals: Object.fromEntries(SIGNAL_NAMES.map((n) => [n, a[n]?.noul])),
    isFragment: a.isFragment?.noul ?? 0,
    missingField: a.missingField?.choice ?? 'none',
    ...(email && { importance: a.importance?.choice }),
  };
}

// shortcut: first 3 hosts only, because VirusTotal's free tier allows 4 lookups/min; raise it with a paid key.
const MAX_INTEL_HOSTS = 3;

export const LIVE_DEPS: Deps = {
  jev: liveJev,
  claude: callClaude,
  intel: (hosts) => Promise.all(hosts.slice(0, MAX_INTEL_HOSTS).map(async (domain) => ({ domain, ...(await checkDomain(domain)) }))),
  reports: (domains) => communityReports(domains),
  // Title and score only: the ScanResult contract, and the KB text never needs to reach the client.
  rag: async (text) => (await searchKnowledgeBase(text)).map(({ title, score }) => ({ title, score })),
};

async function withTimeout<T>(run: () => Promise<T>, fallback: T) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => (timer = setTimeout(resolve, EVIDENCE_TIMEOUT_MS, fallback)));
  try {
    return await Promise.race([Promise.resolve().then(run).catch(() => fallback), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function runScanPipeline(
  input: ScanRequest & { emailFacts?: EmailFacts },
  deps: Deps = LIVE_DEPS,
): Promise<ScanResult & { importance?: Importance }> {
  const email = input.emailFacts;
  const started = Date.now();
  const text = redact(input.text);
  // The sender reaches the models only: a sender number must not count as "a number to call back" in the rules.
  const modelText = input.sender ? `From: ${redact(input.sender)}\n${text}` : text;
  const domains = extractDomains(text);
  const registrable = [...new Set(domains.map(registrableDomain))];
  const unknownIntel = domains.map((domain): DomainIntel => ({ domain, vt: 'unknown', urlhaus: 'unknown' }));

  const jevCall = Promise.resolve().then(() => deps.jev(modelText, !!email)).catch(() => null);
  const [intel, communityReports, ragMatches] = await Promise.all([
    domains.length ? withTimeout(() => deps.intel(domains), unknownIntel) : [],
    registrable.length ? withTimeout(() => deps.reports(registrable), []) : [],
    withTimeout(() => deps.rag(modelText), []),
  ]);
  const floor = ruleFloor({ text, domains, intel, communityReports, ragMatches, email });

  const jev = await jevCall;
  const jevScore = jev ? scamScore(jev.signals, CAL.jev.weights) : null;
  const jevLvl = jevLevel(jevScore, CAL.jev);
  // A clear scam is never stalled by a question: HIGH_RISK from the rules or Jev answers first.
  const clarify = jev
    ? clarifyFor({ floorIsHighRisk: maxLevel(floor.level, jevLvl) === Level.HIGH_RISK, isFragment: jev.isFragment >= 0.5, missingField: jev.missingField })
    : undefined;

  const evidence = [
    `Rule checks: ${floor.flags.join(' ') || 'nothing found.'}`,
    `Links: ${domains.join(', ') || 'none'}`,
    ...intel.map((i) => `Threat intel for ${i.domain}: VirusTotal ${i.vt === 'unknown' ? 'unknown' : `${i.vt.malicious} malicious, ${i.vt.suspicious} suspicious`}; URLhaus ${i.urlhaus}`),
    ...communityReports.map((r) => `Community reports for ${r.domain}: ${r.reporters} distinct reporters`),
    // Strong matches only: weak ones (0.2–0.4) read as "similar known scam" and pushed genuine messages up (eval 2026-11-13).
    ...ragMatches.filter((m) => m.score >= RAG_MATCH_THRESHOLD).map((m) => `Similar known scam pattern: ${m.title} (similarity ${m.score})`),
    ...(email
      ? [`Email checks by the receiving server: SPF ${email.spf}, DKIM ${email.dkim}, DMARC ${email.dmarc}; From domain ${email.fromDomain ?? 'unknown'}, Reply-To domain ${email.replyToDomain ?? 'none'}`]
      : []),
    `Scam-signal score from a first model: ${jevScore ?? 'unavailable'} (0 = no signs, 1 = clear scam)`,
  ].join('\n');
  const claude = clarify ? null : await Promise.resolve().then(() => deps.claude(modelText, evidence)).catch(() => null);

  const level = maxLevel(floor.level, jevLvl, claudeLevel(claude?.verdict ?? null, CAL.claude));
  const verdict = LEVEL_NAME[level];
  const useClaudeText = claude != null && VERDICTS.indexOf(claude.verdict) >= level;
  const incomplete = !jev || (!clarify && !claude);
  // Jev's reasons only when Jev lifted the verdict above the rules: otherwise they repeat the rule flags.
  const jevFlags = jev && jevLvl > floor.level ? signalFlags(jev.signals, CAL.jev.weights) : [];
  return {
    verdict,
    flags: [...new Set([...floor.flags, ...jevFlags, ...(claude?.redFlags ?? []), ...(incomplete ? [INCOMPLETE] : [])])],
    // SAFE always uses our wording: a model's "this is safe" must never reach the card (CLAUDE.md UX rules).
    advice: useClaudeText && verdict !== 'SAFE' ? claude.advice : ADVICE[verdict],
    scamType: useClaudeText ? claude.scamType : '',
    ...(clarify && { clarify }),
    ...(email && { importance: isOneOf(IMPORTANCES, jev?.importance) ? jev.importance : DEFAULT_IMPORTANCE }),
    evidence: { domains, intel, communityReports, ragMatches },
    metadata: { modelsUsed: [...(jev ? [JEV_MODEL] : []), ...(claude ? [CLAUDE_MODEL] : [])], latencyMs: Date.now() - started },
  };
}

// PLAN §6: subject + body are scanned; display name + From domain go in as the sender (models only, redacted).
// shortcut: text capped at LIMITS.text like /api/scan (model cost, Jev 5 s timeout), so a link past it is missed; raise if real mail needs it.
export function scanEmail(raw: string, deps: Deps = LIVE_DEPS) {
  const e = parseHeaders(raw);
  const text = [e.subject, e.body].filter(Boolean).join('\n').slice(0, LIMITS.text);
  const sender = [e.displayName, e.fromDomain && `(${e.fromDomain})`].filter(Boolean).join(' ');
  return runScanPipeline({ text, sender: sender || undefined, emailFacts: e }, deps);
}
