// Server-only. Threat intel by registrable domain / host only (PLAN D6, §3.2): the server never fetches
// untrusted URLs and never submits a full URL. Each lookup has a timeout; any failure → 'unknown'.
import { Level } from './verdict.ts';

export type VtResult = { malicious: number; suspicious: number } | 'unknown';
export type UrlhausResult = 'listed' | 'not_listed' | 'unknown';
export type Intel = { vt: VtResult; urlhaus: UrlhausResult };

// PLAN §3.2, exact host match. Platforms that host files for anyone: a hit caps at SUSPICIOUS.
// Per-tenant subdomains (x.workers.dev, x.pages.dev, x.github.io, …) are deliberately absent.
export const SHARED_HOSTS = new Set([
  'github.com', 'raw.githubusercontent.com', 'codeload.github.com', 'gitlab.com', 'bitbucket.org',
  'discord.com', 'cdn.discordapp.com', 'drive.google.com', 'docs.google.com', 'www.dropbox.com',
  'dl.dropboxusercontent.com', 'pastebin.com', 'linktr.ee', 'pixeldrain.com', 'www.mediafire.com',
  'res.cloudinary.com', 'web.archive.org',
]);

export const refang = (d: string) => d.replaceAll('[.]', '.');

const normalise = (d: string) => d.trim().toLowerCase().replace(/\.$/, '');
export const DOMAIN = /^(?=.{4,253}$)([a-z0-9-]{1,63}\.)+[a-z]{2,63}$/;
const UNKNOWN: Intel = { vt: 'unknown', urlhaus: 'unknown' };
// shortcut: per-isolate Map, lost on cold start; fine for a demo, move to Turso/KV if quota bites.
const cache = new Map<string, Intel>();

type Opts = { fetch?: typeof fetch; timeoutMs?: number };

async function vtLookup(domain: string, f: typeof fetch, timeoutMs: number): Promise<VtResult> {
  try {
    const res = await f(`https://www.virustotal.com/api/v3/domains/${domain}`, {
      headers: { 'x-apikey': process.env.VIRUSTOTAL_API_KEY ?? '' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return 'unknown';
    const s = (await res.json())?.data?.attributes?.last_analysis_stats;
    const count = (n: unknown) => Number.isInteger(n) && (n as number) >= 0;
    return count(s?.malicious) && count(s?.suspicious) ? { malicious: s.malicious, suspicious: s.suspicious } : 'unknown';
  } catch {
    return 'unknown';
  }
}

async function urlhausLookup(host: string, f: typeof fetch, timeoutMs: number): Promise<UrlhausResult> {
  try {
    const res = await f('https://urlhaus-api.abuse.ch/v1/host/', {
      method: 'POST',
      headers: { 'Auth-Key': process.env.URLHAUS_AUTH_KEY ?? '', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ host }).toString(),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return 'unknown';
    const status = (await res.json())?.query_status;
    return status === 'ok' ? 'listed' : status === 'no_results' ? 'not_listed' : 'unknown';
  } catch {
    return 'unknown';
  }
}

export async function checkDomain(domain: string, { fetch: f = fetch, timeoutMs = 3000 }: Opts = {}): Promise<Intel> {
  const d = normalise(domain);
  if (!DOMAIN.test(d)) return UNKNOWN; // never send anything that is not a bare domain
  const hit = cache.get(d);
  if (hit) return hit;
  const [vt, urlhaus] = await Promise.all([vtLookup(d, f, timeoutMs), urlhausLookup(d, f, timeoutMs)]);
  const intel = { vt, urlhaus };
  if (vt !== 'unknown' && urlhaus !== 'unknown') cache.set(d, intel);
  return intel;
}

// PLAN §3.2 rule floor contribution from intel. 'unknown' adds nothing. A lone engine is noise
// (VirusTotal had google.com at malicious 1 on 2026-11-13), so the weak signal needs two votes.
export function intelLevel(host: string, { vt, urlhaus }: Intel): Level {
  const strong = urlhaus === 'listed' || (vt !== 'unknown' && vt.malicious >= 2);
  if (strong) return SHARED_HOSTS.has(normalise(host)) ? Level.SUSPICIOUS : Level.HIGH_RISK;
  return vt !== 'unknown' && vt.malicious + vt.suspicious >= 2 ? Level.SUSPICIOUS : Level.SAFE;
}
