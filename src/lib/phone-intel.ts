// Server-only. Phone reputation via isMalicious (`GET ismalicious.com/api/check/phone`, CLAUDE.md security exception): only the bare digits of the
// sender and of callback numbers in the message go to isMalicious. Never to an LLM, a log, storage or the client.
// Failure → 'unknown'.
import { redact, type FoundPhone } from './redact.ts';
import { Level } from './verdict.ts';

export type PhoneHit = { level: string; score: number; blacklisted: boolean }; // a flagged number only
// 'unlisted': isMalicious answered and did not flag it (absence of evidence, never "clean"); 'unknown': the lookup failed.
export type PhoneResult = PhoneHit | 'unlisted' | 'unknown';
export type PhoneIntel = { label: string; result: PhoneResult }; // label: a placeholder, never the number

export const MAX_PHONES = 2; // shortcut: isMalicious free tier is 250 requests/month; raise with a paid plan
// "+" and 7-15 digits, or a Mauritian local number (7-digit landline, 8-digit mobile). A 9-12 digit run without "+"
// is more likely an account number (redact calls it [PHONE] too), so it is never sent.
const SENDABLE_PHONE = /^(?:\+\d{7,15}|\d{7,8})$/;
const SENDER_LABEL = "the sender's number";
const LEVELS = new Set(['info', 'safe', 'low', 'medium', 'high', 'critical']); // riskScore.level
const FLAGGED = new Set(['high', 'critical']); // "medium" fires on heuristics alone (repeated digits, VOIP)

// Pure. Sender first (the number that wrote to you), then numbers in the text, international before local (redact's
// order; a foreign callback number is the stronger sign); unique, at most MAX_PHONES.
export function phonesToCheck(rawText: string, sender?: string): FoundPhone[] {
  const fromSender: FoundPhone[] = [];
  if (sender) {
    redact(sender, fromSender);
    const digits = sender.replace(/[\s().-]/g, '');
    if (!fromSender.length && /^\d+$/.test(digits)) fromSender.push({ number: digits, label: '' }); // "57123456" reads as [CODE]
  }
  const inText: FoundPhone[] = [];
  redact(rawText, inText);
  const seen = new Set<string>();
  return [...fromSender.map((p) => ({ ...p, label: SENDER_LABEL })), ...inText]
    .filter((p) => SENDABLE_PHONE.test(p.number) && !seen.has(p.number) && seen.add(p.number))
    .slice(0, MAX_PHONES);
}

// shortcut: per-isolate Map (in memory only, never persisted), lost on cold start; fine for a demo.
const cache = new Map<string, PhoneResult>();

type Opts = { fetch?: typeof fetch; timeoutMs?: number };

export async function checkPhone(number: string, { fetch: f = fetch, timeoutMs = 3000 }: Opts = {}): Promise<PhoneResult> {
  if (!SENDABLE_PHONE.test(number)) return 'unknown';
  const hit = cache.get(number);
  if (hit) return hit;
  try {
    const key = process.env.IsMalicious_API_KEY, secret = process.env.IsMalicious_API_SECRET;
    // The phone route also answers anonymously (lower quota); auth needs the key + secret pair.
    const headers: Record<string, string> = key && secret ? { Authorization: `Basic ${btoa(`${key}:${secret}`)}` } : {};
    const query = new URLSearchParams({ phone: number.startsWith('+') ? number : `+230${number}` }); // local → Mauritius
    const res = await f(`https://ismalicious.com/api/check/phone?${query}`, { headers, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return 'unknown';
    const j = await res.json();
    const level = j?.riskScore?.level, score = j?.riskScore?.score;
    if (!LEVELS.has(level) || typeof score !== 'number' || !(score >= 0 && score <= 100)) return 'unknown';
    const blacklisted = j.localBlacklistHit === true;
    const result: PhoneResult = blacklisted || FLAGGED.has(level) ? { level, score, blacklisted } : 'unlisted';
    cache.set(number, result);
    return result;
  } catch {
    return 'unknown';
  }
}

// Pure. Uncalibrated, so isMalicious alone never reaches HIGH_RISK (like 1-2 community reporters).
export const phoneLevel = (r: PhoneResult): Level => (typeof r === 'object' ? Level.SUSPICIOUS : Level.SAFE);

// Enum level, number and a boolean only: no third-party free text (riskScore.factors) reaches Claude's prompt.
export const describePhone = (label: string, r: PhoneHit) =>
  `Phone check for ${label}: isMalicious risk ${r.level} (${r.score}/100)${r.blacklisted ? ', on its blocklist' : ''}`;
