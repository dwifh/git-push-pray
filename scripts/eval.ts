// Calibrates model routing on data/eval/messages.jsonl.
//   npm run eval -- record [limit]   runs every message through runScanPipeline (live Jev + Claude, real rule evidence in the
//                                    Claude prompt) and appends the raw model outputs to data/eval/runs/latest.jsonl;
//                                    re-running skips ids already recorded, so an interrupted run resumes. Delete it for a fresh run.
//   npm run eval -- calibrate        offline: fits src/lib/calibration.json on the dev split, reports verdicts
//                                    (rule floor + models) on the test split against the TEAM-PLAN §5 pass bar.
//   npm run eval -- rules            offline, no keys (CI): rule floor per message, and lookalike false positives on
//                                    data/eval/domains.jsonl (must be 0; exit code 1 otherwise).
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { calibrate, DEFAULT_CALIBRATION, rocAuc, type Calibration, type EvalRow } from '../src/lib/calibration.ts';
import type { ClaudeResult } from '../src/lib/claude.ts';
import { extractDomains, lookalikeOf } from '../src/lib/extract.ts';
import { redact } from '../src/lib/redact.ts';
import { ruleFloor } from '../src/lib/rules.ts';
import { LIVE_DEPS, runScanPipeline, type JevResult } from '../src/lib/scan-pipeline.ts';
import { SIGNAL_NAMES, scamScore, type SignalName } from '../src/lib/scam-signals.ts';
import { refang } from '../src/lib/threat-intel.ts';
import { LEVEL_NAME, Level, claudeLevel, jevLevel, maxLevel } from '../src/lib/verdict.ts';
import { VERDICTS, type Verdict } from '../src/shared/types.ts';

type Message = { id: string; text: string; sender?: string; label: 'scam' | 'genuine'; split: 'dev' | 'test'; channel: string; expected?: Verdict };
// clarify: Claude skipped on purpose. floor: the pipeline's rule floor with the evidence it saw (rows recorded before 2026-11-13
// evening lack it and fall back to the offline floor).
type RunRow = EvalRow & { id: string; split: 'dev' | 'test'; channel: string; clarify?: true; floor?: Verdict };

const MESSAGES = 'data/eval/messages.jsonl';
const RUN = 'data/eval/runs/latest.jsonl';
const OUT = 'src/lib/calibration.json';
const DOMAINS = 'data/eval/domains.jsonl';
// Messages only. DIFrauD job ads (WEB) are long postings whose labels hinge on metadata, not message red flags:
// Jev AUC 0.30 there on 2026-11-13. Fitting on them dragged the cutoffs down; they stay in the report as out-of-domain.
const IN_DOMAIN = new Set(['SMS', 'EMAIL']);

const readJsonl = <T>(file: string): T[] =>
  existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l: string) => JSON.parse(l)) : [];
// Committed scam domains are defanged (`evil[.]com`, CLAUDE.md); scan them the way a user would paste them.
const readMessages = () => readJsonl<Message>(MESSAGES).map((m) => ({ ...m, text: refang(m.text) }));

// A malformed Jev reply counts as a failed call (skipped), never as "no risk": JSON would turn NaN into null → 0.
const completeSignals = (s?: JevResult['signals']) =>
  s && SIGNAL_NAMES.every((n) => Number.isFinite(s[n])) ? (s as Record<SignalName, number>) : null;

async function record(limit: number) {
  mkdirSync('data/eval/runs', { recursive: true });
  const done = new Set(readJsonl<RunRow>(RUN).map((r) => r.id));
  const todo = readMessages().filter((m) => !done.has(m.id)).slice(0, limit);
  console.log(`recording ${todo.length} messages (${done.size} already done)`);
  let i = 0;
  const worker = async () => {
    for (let m = todo[i++]; m; m = todo[i++]) {
      // The live deps, wrapped to keep their raw outputs: the eval records exactly what the pipeline sends and gets back.
      const raw: { jev?: JevResult | null; claude?: ClaudeResult | null } = {};
      const r = await runScanPipeline(
        { text: m.text, sender: m.sender },
        {
          ...LIVE_DEPS,
          // No threat intel: 440 messages would burn VirusTotal's 500/day free quota before the demo.
          intel: async () => [],
          jev: async (t) => (raw.jev = await LIVE_DEPS.jev(t)),
          claude: async (t, e) => (raw.claude = await LIVE_DEPS.claude(t, e)),
        },
      );
      const signals = completeSignals(raw.jev?.signals);
      const claude = raw.claude?.verdict ?? null;
      // Same facts as the pipeline's floor, with the reports and RAG matches it actually got back.
      const text = redact(m.text);
      const floor = ruleFloor({ text, domains: r.evidence.domains, communityReports: r.evidence.communityReports, ragMatches: r.evidence.ragMatches });
      const row: RunRow = {
        id: m.id, split: m.split, channel: m.channel, label: m.label, signals, claude, floor: LEVEL_NAME[floor.level],
        ...(r.clarify && { clarify: true as const }),
      };
      appendFileSync(RUN, JSON.stringify(row) + '\n');
      process.stdout.write(r.clarify ? '?' : signals ? (claude ? '.' : 'c') : claude ? 'j' : 'x'); // ? = clarified, c/j = that call failed, x = both
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  console.log('\ndone');
}

// The rule floor per message id without evidence: only for run rows recorded before `floor` was saved.
const ruleFloors = () =>
  new Map(
    readMessages().map((m) => {
      const text = redact(m.text);
      return [m.id, ruleFloor({ text, domains: extractDomains(text) }).level];
    }),
  );

function report(name: string, rows: RunRow[], cal: Calibration, floors: Map<string, Level>) {
  const levels = rows.map((r) => {
    const jev = r.signals ? jevLevel(scamScore(r.signals, cal.jev.weights), cal.jev) : Level.SAFE;
    return maxLevel(r.floor ? Level[r.floor] : (floors.get(r.id) ?? Level.SAFE), jev, claudeLevel(r.claude ?? null, cal.claude));
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
  const floors = ruleFloors();
  console.log(`\nHeld-out test split (${test.length} rows), verdict = max(rule floor, Jev, Claude):`);
  report('PLAN cutoffs', test, DEFAULT_CALIBRATION, floors);
  const { missed, alarms } = report('calibrated', test, cal, floors);
  for (const ch of IN_DOMAIN) report(`  ${ch}`, test.filter((r) => r.channel === ch), cal, floors);
  report('  WEB (out)', rows.filter((r) => r.split === 'test' && !IN_DOMAIN.has(r.channel)), cal, floors);
  report('models only', test, cal, new Map());
  console.log(`clarified (Claude skipped on purpose): ${test.filter((r) => r.clarify).length}/${test.length}`);
  if (missed.length) console.log(`missed scams: ${missed.map((r) => r.id).join(', ')}`);
  if (alarms.length) console.log(`genuine above SAFE: ${alarms.map((r) => `${r.id} (Claude ${r.claude ?? '-'})`).join(', ')}`);
  const pass = !missed.length && alarms.length < 0.1 * test.filter((r) => r.label === 'genuine').length;
  console.log(`TEAM-PLAN §5 pass bar (no scam SAFE, under 10% genuine above SAFE): ${pass ? 'PASS' : 'FAIL'}`);
}

// Rules only: no intel, community reports or RAG (they need keys), so this is the text + lookalike floor.
function rulesRun() {
  const domains = readJsonl<{ domain: string; label: 'good' | 'bad' }>(DOMAINS).map((r) => ({ ...r, domain: r.domain.replaceAll('[.]', '.') }));
  const good = domains.filter((r) => r.label === 'good');
  const fp = good.filter((r) => lookalikeOf(r.domain));
  console.log(`lookalike false positives: ${fp.length}/${good.length} good domains${list(fp.map((r) => r.domain))}`);
  if (fp.length) process.exitCode = 1;

  const rows = readMessages().map((m) => {
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
