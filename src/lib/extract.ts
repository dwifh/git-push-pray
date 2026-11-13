// Pure. PLAN §3.2: the hosts in a (redacted) message, and the facts the rules need about each one.
import type { Institution } from '../shared/types.ts';
import { BARE_DOMAIN_RE, URL_RE } from './redact.ts';

// shortcut: unverified until a teammate checks each domain against the brand's own site (CLAUDE.md); never present as official.
// token = the brand as one host part; names = how it appears in an email display name (PLAN §6).
export const BRANDS: { token: string; institution: Institution; names: string[]; domains: string[] }[] = [
  { token: 'mcb', institution: 'MCB', names: ['mcb', 'mauritius commercial bank'], domains: ['mcb.mu'] },
  { token: 'sbm', institution: 'SBM', names: ['sbm', 'state bank of mauritius'], domains: ['sbmgroup.mu'] },
  { token: 'ceb', institution: 'CEB', names: ['ceb', 'central electricity board'], domains: ['ceb.mu'] },
  { token: 'cwa', institution: 'CWA', names: ['cwa', 'central water authority'], domains: ['cwa.govmu.org'] },
  { token: 'mra', institution: 'MRA', names: ['mra', 'mauritius revenue authority'], domains: ['mra.mu'] },
  { token: 'mauritiuspost', institution: 'MAURITIUS_POST', names: ['mauritius post'], domains: ['mauritiuspost.mu'] },
  { token: 'emtel', institution: 'EMTEL', names: ['emtel'], domains: ['emtel.com'] },
  { token: 'myt', institution: 'MYT', names: ['my t', 'myt', 'mauritius telecom'], domains: ['myt.mu', 'telecom.mu'] },
];
const ALLOWLIST = [...BRANDS.flatMap((b) => b.domains), 'govmu.org'];
const SHORTENERS = new Set(['bit.ly', 'tinyurl.com', 't.ly', 'cutt.ly', 'rb.gy', 'is.gd', 'shorturl.at']);
// Popular platforms that host files for anyone, so they also show up in URLhaus (PLAN §3.2). Exact host only.
const SHARED_HOSTS = new Set([
  'github.com', 'raw.githubusercontent.com', 'codeload.github.com', 'gitlab.com', 'bitbucket.org', 'discord.com',
  'cdn.discordapp.com', 'drive.google.com', 'docs.google.com', 'www.dropbox.com', 'dl.dropboxusercontent.com',
  'pastebin.com', 'linktr.ee', 'pixeldrain.com', 'www.mediafire.com', 'res.cloudinary.com', 'web.archive.org',
]);
// x.workers.dev belongs to whoever registered x, so it is its own registrable domain (and never a shared host).
const TENANT_SUFFIXES = ['workers.dev', 'pages.dev', 'r2.dev', 'vercel.app', 'github.io'];
// shortcut: common second-level suffixes (co.uk, gov.in) instead of the Public Suffix List; switch to the PSL if the Feed
// shows reports merged across unrelated sites.
const SLD = new Set(['co', 'com', 'net', 'org', 'gov', 'ac', 'edu', 'gouv']);
// Suffixes only a government can register (cwa.gov.tw and sbm.gov.in are real). Not gov.<any cc>: gov.cc is for sale.
// shortcut: a short list; add a country when one of its real government sites gets flagged.
const GOV_SUFFIXES = ['gov', 'gov.uk', 'gov.in', 'gov.tw', 'gov.au', 'gov.sg', 'gov.za', 'gov.my', 'gov.br', 'gov.cn', 'gov.hk', 'gouv.fr'];

// WHATWG URL does the IDNA work on Workers and Node: lowercases, drops the port, turns "mсb.mu" into "xn--mb-omc.mu".
export function toHost(raw: string) {
  try {
    return new URL(`http://${raw}`).hostname.replace(/\.$/, '') || null;
  } catch {
    return null;
  }
}

// shortcut: a bare "file.txt" also reads as a domain; harmless (no brand part, intel says unknown). If such names start
// filling the Feed, check the TLD against a list.
export function extractDomains(text: string) {
  const raw: string[] = [];
  const rest = text.replace(URL_RE, (_, authority: string) => {
    raw.push(authority.slice(authority.lastIndexOf('@') + 1).replace(/[),.;:!'"\]]+$/, ''));
    return ' ';
  });
  for (const m of rest.matchAll(BARE_DOMAIN_RE)) raw.push(m[1]);
  return [...new Set(raw.map(toHost).filter((h): h is string => h != null))];
}

export function registrableDomain(host: string) {
  const labels = host.split('.');
  const tenant = TENANT_SUFFIXES.find((s) => host.endsWith(`.${s}`));
  const n = tenant ? tenant.split('.').length + 1 : labels.length > 2 && SLD.has(labels.at(-2)!) && labels.at(-1)!.length === 2 ? 3 : 2;
  return labels.slice(-n).join('.');
}

export const isShortener = (host: string) => SHORTENERS.has(host);
export const isSharedHost = (host: string) => SHARED_HOSTS.has(host);
const under = (host: string, suffixes: string[]) => suffixes.some((d) => host === d || host.endsWith(`.${d}`));
export const isAllowlisted = (host: string) => under(host, ALLOWLIST);
// Community reports are keyed by registrable domain (PLAN §5), so drive.google.com is stored as google.com: parents of
// shared hosts are immune too, along with allowlisted brands and shorteners (PLAN D9).
const SHARED_PARENTS = new Set([...SHARED_HOSTS].map(registrableDomain));
export const isReportImmune = (domain: string) =>
  isAllowlisted(domain) || isShortener(domain) || isSharedHost(domain) || SHARED_PARENTS.has(domain);

// Cyrillic and Greek letters that render like Latin ones (IDN homographs), plus dotless ı and ł.
// shortcut: a hand-picked subset of Unicode confusables.txt; load the full table if a homograph slips through.
const CONFUSABLE: Record<string, string> = {
  а: 'a', в: 'b', е: 'e', к: 'k', м: 'm', н: 'h', о: 'o', р: 'p', с: 'c', т: 't', у: 'y', х: 'x', ь: 'b',
  і: 'i', ј: 'j', ѕ: 's', ԁ: 'd', һ: 'h', ӏ: 'l', ԛ: 'q', ԝ: 'w',
  α: 'a', ε: 'e', ι: 'i', κ: 'k', ν: 'v', ο: 'o', ρ: 'p', τ: 't', υ: 'u', χ: 'x', ı: 'i', ł: 'l',
};
// ASCII look-alikes inside a part: "rnauritiuspost" reads as "mauritiuspost".
const foldAscii = (s: string) =>
  s.replace(/rn/g, 'm').replace(/vv/g, 'w').replace(/0/g, 'o').replace(/1/g, 'l').replace(/3/g, 'e').replace(/5/g, 's').replace(/7/g, 't');

// The domain this host imitates (a brand's official domain, or the Latin text a homograph spells), else null.
// Brand match = a brand token equals a whole dot- or hyphen-separated part, never a substring (PLAN §3.2).
export function lookalikeOf(host: string): string | null {
  if (isAllowlisted(host) || under(host, GOV_SUFFIXES)) return null;
  let homograph = false;
  const labels = host.split('.').map((label) => {
    if (!label.startsWith('xn--')) return label;
    const text = decodePunycode(label.slice(4));
    if (text == null) return (homograph = true), label; // unreadable punycode: fail closed
    const skeleton = [...text.normalize('NFD').replace(/\p{M}/gu, '')].map((c) => CONFUSABLE[c] ?? c).join('');
    // Homograph = uses Latin look-alike letters and reads as plain ASCII. Thai, or "café", does not.
    if ([...text].some((c) => c in CONFUSABLE) && /^[\x21-\x7e]+$/.test(skeleton)) homograph = true;
    return skeleton;
  });
  const parts = labels.flatMap((l) => [l, l.replaceAll('-', ''), ...l.split('-')]).flatMap((p) => [p, foldAscii(p)]);
  const brand = BRANDS.find((b) => parts.includes(b.token));
  return brand ? brand.domains[0] : homograph ? labels.join('.') : null;
}

// RFC 3492 decoder: Workers has no punycode module and URL keeps hosts in xn-- form. null when malformed.
function decodePunycode(s: string): string | null {
  const d = s.lastIndexOf('-');
  const out = d > 0 ? [...s.slice(0, d)] : [];
  let n = 128;
  let i = 0;
  let bias = 72;
  for (let p = d > 0 ? d + 1 : 0; p < s.length; ) {
    const old = i;
    for (let w = 1, k = 36; ; k += 36) {
      const c = s.charCodeAt(p++);
      const digit = c >= 48 && c <= 57 ? c - 22 : c >= 97 && c <= 122 ? c - 97 : 36; // NaN past the end → 36
      if (digit === 36) return null;
      i += digit * w;
      const t = k <= bias ? 1 : k >= bias + 26 ? 26 : k - bias;
      if (digit < t) break;
      w *= 36 - t;
    }
    const len = out.length + 1;
    let delta = old === 0 ? Math.floor((i - old) / 700) : Math.floor((i - old) / 2);
    delta += Math.floor(delta / len);
    let k = 0;
    for (; delta > 455; k += 36) delta = Math.floor(delta / 35);
    bias = k + Math.floor((36 * delta) / (delta + 38));
    n += Math.floor(i / len);
    i %= len;
    if (n > 0x10ffff) return null;
    out.splice(i++, 0, String.fromCodePoint(n));
  }
  return out.join('');
}
