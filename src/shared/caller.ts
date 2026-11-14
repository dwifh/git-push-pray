// Client-safe, pure: rate an incoming caller's number on the device (no API call, works offline).
// shortcut: country-code list and Mauritian number formats are unverified; a teammate should check them against ICT Authority / MAUCORS notices.
import type { ScanResult, Verdict } from './types.ts';

// Codes behind most "missed call, call back" (wangiri) and premium-rate scams reported abroad.
const HIGH_RISK_CODES = ['216', '222', '225', '243', '252', '870', '881', '882', '883', '979'];

const ADVICE: Record<Verdict, string> = {
  SAFE: 'No known scam signs found. Scammers can still fake a local number: never share an OTP, PIN or password on a call.',
  SUSPICIOUS: 'Do not answer or call back. If it matters, they will leave a message or you can call the organisation on its official number.',
  HIGH_RISK: 'Do not answer and never call this number back: calling back can cost you money. Block the number.',
};

export function checkCaller(input: string): ScanResult {
  const raw = input.trim();
  const digits = raw.replace(/\D/g, '');
  const intl = raw.startsWith('+') || raw.startsWith('00');
  const full = raw.startsWith('00') ? digits.slice(2) : digits;
  const flags: string[] = [];
  let verdict: Verdict = 'SAFE';

  if (intl && !full.startsWith('230')) {
    const code = HIGH_RISK_CODES.find((c) => full.startsWith(c));
    verdict = code ? 'HIGH_RISK' : 'SUSPICIOUS';
    flags.push(code ? `Country code +${code} is often used for "call me back" scams that charge you` : 'The call comes from outside Mauritius');
  } else {
    const local = intl ? full.slice(3) : full;
    // Mauritius: mobiles are 8 digits starting with 5, landlines 7 digits.
    if (!/^5\d{7}$/.test(local) && !/^[2-8]\d{6}$/.test(local)) {
      verdict = 'SUSPICIOUS';
      flags.push('This is not a normal Mauritian phone number');
    }
  }
  return { verdict, flags, advice: ADVICE[verdict], scamType: '', evidence: { domains: [], intel: [], communityReports: [], ragMatches: [] }, metadata: { modelsUsed: [], latencyMs: 0 } };
}
