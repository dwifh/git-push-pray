// Builds data/eval/messages.jsonl from DIFrauD (MIT; Boumber et al., LREC-COLING 2024; labels Cleanlab-cleaned
// and hand-curated). Their validation split becomes our `dev` (calibration) and their test split our `test` (report).
// Run: npm run fetch-data
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = 'https://huggingface.co/datasets/difraud/difraud/resolve/main';
const DOMAINS = { sms: 'SMS', phishing: 'EMAIL', job_scams: 'WEB' };
const SPLITS = { validation: 'dev', test: 'test' };
const PER_CLASS = 30; // per domain, per split, per label
const MAX_CHARS = 2000; // the scan route's input cap

// Seeded shuffle so the sample is reproducible.
function shuffle(arr, seed) {
  let s = seed >>> 0;
  const rand = () => ((s = (s + 0x6d2b79f5) >>> 0), ((s ^ (s >>> 15)) * (s | 1) >>> 0) / 2 ** 32);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const out = [];
for (const [domain, channel] of Object.entries(DOMAINS)) {
  for (const [theirs, ours] of Object.entries(SPLITS)) {
    const url = `${BASE}/${domain}/${theirs}.jsonl`;
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`${url} → ${res.status}`);
    const rows = (await res.text())
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .filter((r) => typeof r.text === 'string' && r.text.trim().length >= 20 && (r.label === 0 || r.label === 1));
    for (const label of [1, 0]) {
      const picked = shuffle(rows.filter((r) => r.label === label), 42).slice(0, PER_CLASS);
      if (picked.length < PER_CLASS) console.warn(`${domain}/${theirs}: only ${picked.length} rows with label ${label}`);
      picked.forEach((r, i) =>
        out.push({
          id: `difraud-${domain}-${ours}-${label ? 'scam' : 'genuine'}-${i}`,
          text: r.text.slice(0, MAX_CHARS),
          channel,
          label: label ? 'scam' : 'genuine',
          split: ours,
          source: `${url} (MIT)`,
        }),
      );
    }
  }
}

mkdirSync('data/eval', { recursive: true });
writeFileSync('data/eval/messages.jsonl', out.map((r) => JSON.stringify(r)).join('\n') + '\n');
const count = (k, v) => out.filter((r) => r[k] === v).length;
console.log(`wrote ${out.length} messages: dev ${count('split', 'dev')}, test ${count('split', 'test')}, scam ${count('label', 'scam')}`);
