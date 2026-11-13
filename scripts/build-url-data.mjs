// Derives a small committed eval file from the raw URL lists (kept out of git in data/raw/):
//   data/raw/tranco.csv   Tranco top-1M "rank,domain"  (https://tranco-list.eu/)
//   data/raw/urlhaus.csv  URLhaus CSV dump              (https://urlhaus.abuse.ch/api/)
// Output: data/eval/domains.jsonl, labelled domains for the lookalike + intel rules (PLAN step 2, TEAM-PLAN §5).
// Bad domains are defanged ("evil[.]com"): a plain malware host list gets quarantined by Windows Defender.
// It also prints shared-platform candidates (top-10k sites listed by URLhaus) for the hand-curated SHARED_HOSTS
// list in PLAN §3.2. Only exact hosts count: x.workers.dev / x.r2.dev subdomains belong to the attacker.
// Run: npm run build-url-data
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

const SHARED_TOP = 10_000; // a top-10k site that appears in URLhaus is a shared platform, not a scam site
const BRAND_TOKENS = ['mcb', 'sbm', 'ceb', 'cwa', 'mra', 'mauritiuspost', 'emtel', 'myt']; // PLAN §3.2 brands

const rank = new Map(
  readFileSync('data/raw/tranco.csv', 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const [r, d] = l.trim().split(',');
      return [d, Number(r)];
    }),
);
// shortcut: last-two-labels guess at the registrable domain; misses co.uk-style suffixes. Fine for a top-10k filter.
const topRank = (host) => rank.get(host) ?? rank.get(host.split('.').slice(-2).join('.'));

const hosts = new Map(); // host → { urls, online }
for (const line of readFileSync('data/raw/urlhaus.csv', 'utf8').split('\n')) {
  const m = line.match(/^\d+,[^,]+,"?(https?:\/\/[^,"]+)"?,(\w+),/);
  if (!m) continue;
  let host;
  try {
    host = new URL(m[1]).hostname.toLowerCase();
  } catch {
    continue;
  }
  if (/^[\d.]+$|^\[/.test(host)) continue; // raw IPs: botnet payloads, never in a scam SMS as a domain
  const h = hosts.get(host) ?? { urls: 0, online: false };
  hosts.set(host, { urls: h.urls + 1, online: h.online || m[2] === 'online' });
}

const shared = [...hosts.keys()].filter((h) => rank.get(h) <= SHARED_TOP).sort();
assert.ok(shared.includes('github.com'), 'shared platforms detected');

// Seeded pick so the eval file is reproducible.
let s = 42;
const rand = () => ((s = (s * 1103515245 + 12345) % 2 ** 31), s / 2 ** 31);
const pick = (arr, n) => arr.map((x) => [rand(), x]).sort((a, b) => a[0] - b[0]).slice(0, n).map(([, x]) => x);

const byRank = [...rank.entries()].sort((a, b) => a[1] - b[1]);
const top = byRank.slice(0, 100).map(([d]) => d);
// The hard false-positive cases for the lookalike rule: popular domains that merely contain a brand token.
const brandLike = byRank.filter(([d]) => BRAND_TOKENS.some((t) => d.split('.')[0].includes(t))).slice(0, 100).map(([d]) => d);
const bad = pick([...hosts].filter(([h, v]) => v.online && !(topRank(h) <= 1_000_000)).map(([h]) => h), 100);

const rows = [
  ...top.map((domain) => ({ domain, label: 'good', why: 'tranco-top-100' })),
  ...brandLike.filter((d) => !top.includes(d)).map((domain) => ({ domain, label: 'good', why: 'tranco-brand-token' })),
  ...bad.map((domain) => ({ domain: domain.replaceAll('.', '[.]'), label: 'bad', why: 'urlhaus-online' })),
];
writeFileSync('data/eval/domains.jsonl', rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
console.log(`domains.jsonl: ${rows.length} (${bad.length} bad, defanged)\nshared-platform candidates: ${shared.join(' ')}`);
