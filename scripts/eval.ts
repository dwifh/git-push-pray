// Calibrates model routing on data/eval/messages.jsonl.
//   npm run eval -- record [limit]   calls Jev + Claude on every message (redacted first), appends to data/eval/runs/latest.jsonl;
//                                    re-running skips ids already recorded, so an interrupted run resumes.
//   npm run eval -- calibrate        offline: fits src/lib/calibration.json on the dev split, reports on the test split.
//   npm run eval -- rules            offline, no keys (CI): rule floor per message, and lookalike false positives on
//                                    data/eval/domains.jsonl (must be 0; exit code 1 otherwise).
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { calibrate, DEFAULT_CALIBRATION, rocAuc, type Calibration, type EvalRow } from '../src/lib/calibration.ts';
import { callClaude } from '../src/lib/claude.ts';
import { extractDomains, lookalikeOf } from '../src/lib/extract.ts';
import { callJevDecision, type JevQuestion } from '../src/lib/jev.ts';
import { redact } from '../src/lib/redact.ts';
import { ruleFloor } from '../src/lib/rules.ts';
import { SIGNAL_NAMES, SIGNALS, scamScore, type SignalName } from '../src/lib/scam-signals.ts';
import { LEVEL_NAME, Level, claudeLevel, jevLevel, maxLevel } from '../src/lib/verdict.ts';
import { VERDICTS, type Verdict } from '../src/shared/types.ts';

type Message = { id: string; text: string; label: 'scam' | 'genuine'; split: 'dev' | 'test'; channel: string; expected?: Verdict };
type RunRow = EvalRow & { id: string; split: 'dev' | 'test'; channel: string };

const MESSAGES = 'data/eval/messages.jsonl';
const RUN = 'data/eval/runs/latest.jsonl';
const OUT = 'src/lib/calibration.json';
const DOMAINS = 'data/eval/domains.jsonl';
// Same evidence line for every message: the pipeline that gathers rules + intel evidence lands in step 3; re-record then.
const EVIDENCE = 'None available for this message.';
// Messages only. DIFrauD job ads (WEB) are long postings whose labels hinge on metadata, not message red flags:
// Jev AUC 0.30 there on 2026-11-13. Fitting on them dragged the cutoffs down; they stay in the report as out-of-domain.
const IN_DOMAIN = new Set(['SMS', 'EMAIL']);

const readJsonl = <T>(file: string): T[] =>
  existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l: string) => JSON.parse(l)) : [];

const QUESTIONS = Object.fromEntries(
  SIGNAL_NAMES.map((n) => [n, { type: 'noul', instructions: SIGNALS[n].question } satisfies JevQuestion]),
);

async function jevSignals(text: string) {
  try {
    const answers = await callJevDecision({ message: text }, QUESTIONS);
    // A malformed reply counts as a failed call (skipped), never as "no risk": JSON would turn NaN into null → 0.
    if (!SIGNAL_NAMES.every((n) => Number.isFinite(answers?.[n]?.noul))) return null;
    return Object.fromEntries(SIGNAL_NAMES.map((n) => [n, answers[n].noul!])) as Record<SignalName, number>;
  } catch {
    return null;
  }
}

async function record(limit: number) {
  mkdirSync('data/eval/runs', { recursive: true });
  const done = new Set(readJsonl<RunRow>(RUN).map((r) => r.id));
  const todo = readJsonl<Message>(MESSAGES).filter((m) => !done.has(m.id)).slice(0, limit);
  console.log(`recording ${todo.length} messages (${done.size} already done)`);
  let i = 0;
  const worker = async () => {
    for (let m = todo[i++]; m; m = todo[i++]) {
      const text = redact(m.text);
      const [signals, claude] = await Promise.all([jevSignals(text), callClaude(text, EVIDENCE)]);
      const row: RunRow = { id: m.id, split: m.split, channel: m.channel, label: m.label, signals, claude: claude?.verdict ?? null };
      appendFileSync(RUN, JSON.stringify(row) + '\n');
      process.stdout.write(signals ? (claude ? '.' : 'c') : claude ? 'j' : 'x'); // c/j = that call failed, x = both
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  console.log('\ndone');
}

function report(name: string, rows: RunRow[], cal: Calibration) {
  const levels = rows.map((r) => {
    const jev = r.signals ? jevLevel(scamScore(r.signals, cal.jev.weights), cal.jev) : Level.SAFE;
    return maxLevel(jev, claudeLevel(r.claude ?? null, cal.claude));
  });
  const scams = rows.filter((r) => r.label === 'scam');
  const missed = rows.filter((r, i) => r.label === 'scam' && levels[i] === Level.SAFE);
  const alarms = rows.filter((r, i) => r.label === 'genuine' && levels[i] !== Level.SAFE);
  const genuine = rows.length - scams.length;
  const jevRows = rows.filter((r) => r.signals);
  const auc = rocAuc(jevRows.map((r) => scamScore(r.signals!, cal.jev.weights)), jevRows.map((r) => r.label === 'scam'));
  console.log(
    `${name.padEnd(11)} Jev AUC ${auc.toFixed(3)} | scams rated SAFE ${missed.length}/${scams.length} | ` +
      `genuine above SAFE ${alarms.length}/${genuine} (${((100 * alarms.length) / genuine).toFixed(1)}%)`,
  );
  return { missed, alarms };
}

function calibrateRun() {
  const rows = readJsonl<RunRow>(RUN);
  const dev = rows.filter((r) => r.split === 'dev' && IN_DOMAIN.has(r.channel));
  const test = rows.filter((r) => r.split === 'test' && IN_DOMAIN.has(r.channel));
  const cal = calibrate(dev);
  writeFileSync(OUT, JSON.stringify({ ...cal, fittedOn: { rows: dev.length, run: RUN, date: new Date().toISOString().slice(0, 10) } }, null, 2) + '\n');
  console.log(`wrote ${OUT} from ${dev.length} dev rows`);
  console.log(JSON.stringify({ jev: { ...cal.jev, reliability: undefined }, claude: cal.claude }, null, 2));
  console.log('Jev score reliability (dev): score bin → share that were scams');
  for (const b of cal.jev.reliability) console.log(`  ${b.from.toFixed(1)}–${b.to.toFixed(1)}  n=${String(b.n).padStart(3)}  scam rate ${b.scamRate}`);
  console.log(`\nHeld-out test split (${test.length} rows), models only (no rules yet):`);
  report('PLAN cutoffs', test, DEFAULT_CALIBRATION);
  const { missed } = report('calibrated', test, cal);
  for (const ch of IN_DOMAIN) report(`  ${ch}`, test.filter((r) => r.channel === ch), cal);
  report('  WEB (out)', rows.filter((r) => r.split === 'test' && !IN_DOMAIN.has(r.channel)), cal);
  if (missed.length) console.log(`missed scams: ${missed.map((r) => r.id).join(', ')}`);
}

// Rules only: no intel, community reports or RAG (they need keys), so this is the text + lookalike floor.
function rulesRun() {
  const domains = readJsonl<{ domain: string; label: 'good' | 'bad' }>(DOMAINS).map((r) => ({ ...r, domain: r.domain.replaceAll('[.]', '.') }));
  const good = domains.filter((r) => r.label === 'good');
  const fp = good.filter((r) => lookalikeOf(r.domain));
  console.log(`lookalike false positives: ${fp.length}/${good.length} good domains${list(fp.map((r) => r.domain))}`);
  if (fp.length) process.exitCode = 1;

  const rows = readJsonl<Message>(MESSAGES).map((m) => {
    const text = redact(m.text);
    return { m, floor: ruleFloor({ text, domains: extractDomains(text) }).level };
  });
  // Rows = expected verdict (3 × 3 once the hand-built Mauritius set lands) or binary label (DIFrauD); columns = rule floor.
  const table = new Map<string, number[]>();
  for (const { m, floor } of rows) {
    const key = m.expected ?? m.label;
    if (!table.has(key)) table.set(key, [0, 0, 0]);
    table.get(key)![floor]++;
  }
  console.log(`\nrule floor on ${rows.length} messages\n${'expected'.padEnd(11)}${VERDICTS.map((v) => v.padStart(11)).join('')}`);
  for (const [k, counts] of table) console.log(k.padEnd(11) + counts.map((c) => String(c).padStart(11)).join(''));

  const named = (r: typeof rows) => list(r.map(({ m, floor }) => `${m.id}=${LEVEL_NAME[floor]}`));
  const missed = rows.filter(({ m, floor }) => m.expected && floor < Level[m.expected]);
  const unflagged = rows.filter(({ m, floor }) => m.label === 'scam' && floor === Level.SAFE);
  // A rule false alarm is final: the models can only add risk on top of the floor.
  const alarms = rows.filter(({ m, floor }) => m.label === 'genuine' && floor > Level.SAFE);
  console.log(`\nbelow expected: ${missed.length}${named(missed)}`);
  console.log(`scams the rules leave SAFE (the models must catch them): ${unflagged.length}/${rows.filter(({ m }) => m.label === 'scam').length}`);
  console.log(`genuine above SAFE: ${alarms.length}/${rows.filter(({ m }) => m.label === 'genuine').length}${named(alarms)}`);
}
const list = (items: string[]) => (items.length ? ` (${items.join(', ')})` : '');

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'record') await record(Number(arg) || Infinity);
else if (cmd === 'calibrate') calibrateRun();
else if (cmd === 'rules') rulesRun();
else console.log('usage: npm run eval -- record [limit] | calibrate | rules');
