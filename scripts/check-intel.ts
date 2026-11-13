// PLAN §10 step 2 check: live intel on a few known-good and known-bad rows of data/eval/domains.jsonl,
// plus a forced timeout. Run: npm run check-intel [perLabel=2]  (VirusTotal free tier: 4 lookups/min, 500/day)
import { readFileSync } from 'node:fs';
import { checkDomain, intelLevel, refang } from '../src/lib/threat-intel.ts';
import { LEVEL_NAME } from '../src/lib/verdict.ts';

const n = Number(process.argv[2] ?? 2);
const rows = readFileSync('data/eval/domains.jsonl', 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const pick = (label: string) => rows.filter((r) => r.label === label).slice(0, n);

let wrong = 0;
for (const r of [...pick('good'), ...pick('bad')]) {
  const domain = refang(r.domain);
  const intel = await checkDomain(domain);
  const level = LEVEL_NAME[intelLevel(domain, intel)];
  const ok = r.label === 'good' ? level === 'SAFE' : level !== 'SAFE';
  if (!ok) wrong++;
  console.log(`${ok ? 'ok  ' : 'MISS'} ${r.label} ${r.domain} → ${level} ${JSON.stringify(intel)}`);
}
const t = await checkDomain('timeout-check.example', { timeoutMs: 1 });
console.log(`forced timeout → ${JSON.stringify(t)}`);
console.log(`${wrong} wrong`);
