// Mock API results for offline frontend work, on when EXPO_PUBLIC_MOCK_API=1 (TEAM-PLAN §4).
// Type "mock:400", "mock:429" or "mock:502" in any input to see that error.
import type { EmailResult, ScanResult } from './types';

const evidence = (domains: string[] = []): ScanResult['evidence'] => ({
  domains,
  intel: domains.map((domain) => ({ domain, vt: 'unknown', urlhaus: 'unknown' })),
  communityReports: [],
  ragMatches: [],
});
const metadata = { modelsUsed: ['mock'], latencyMs: 800 };

export const MOCK_SCAN: Record<'safe' | 'suspicious' | 'highRisk' | 'clarify', ScanResult> = {
  safe: { verdict: 'SAFE', flags: [], advice: 'If something still feels off, call the organisation on its official number.', scamType: 'none', evidence: evidence(), metadata },
  suspicious: {
    verdict: 'SUSPICIOUS',
    flags: ['Link uses a URL shortener that hides where it goes', 'Asks you to act quickly'],
    advice: 'Do not tap the link. Check with the organisation using its official number.',
    scamType: 'parcel_delivery',
    evidence: evidence(['bit.ly']),
    metadata,
  },
  highRisk: {
    verdict: 'HIGH_RISK',
    flags: ['Asks for your OTP', 'Pretends to be bank staff', 'Rushes you'],
    advice: 'Do not reply and never share an OTP. Call your bank on the number on your card.',
    scamType: 'bank_impersonation',
    evidence: { ...evidence(['mcb-secure-login[.]top']), communityReports: [{ domain: 'mcb-secure-login[.]top', reporters: 6 }] },
    metadata,
  },
  clarify: {
    verdict: 'SUSPICIOUS',
    flags: ['Mentions a payment but the message looks cut off'],
    advice: 'Do not pay anything until you have checked.',
    scamType: 'unknown',
    clarify: 'Did the message include a link? If so, paste the whole message.',
    evidence: evidence(),
    metadata,
  },
};

export const MOCK_EMAIL: Record<'spoofedMra' | 'promo' | 'routine', EmailResult> = {
  spoofedMra: {
    verdict: 'HIGH_RISK',
    importance: 'URGENT',
    flags: [
      'Claims to be from MRA but was not sent by an MRA server (SPF and DMARC failed)',
      'Reply-To goes to a different address than the sender',
      'Link points to mra-refund-portal[.]top, not mra.mu',
    ],
    advice: 'Do not click the link or reply. MRA never asks for card details by email.',
    scamType: 'government_impersonation',
    evidence: evidence(['mra-refund-portal[.]top']),
    metadata,
  },
  promo: { ...MOCK_SCAN.safe, importance: 'PROMOTIONAL' },
  routine: { ...MOCK_SCAN.safe, importance: 'ROUTINE' },
};

const ERRORS: Record<string, string> = {
  '400': 'Please paste the email headers or the whole email (up to 100 KB).',
  '429': 'Too many requests. Please wait a minute.',
  '502': 'Could not check this right now. If unsure, do not click links or reply.',
};

export async function mockPost(path: string, body: unknown): Promise<ScanResult | EmailResult | { error: string }> {
  const input = JSON.stringify(body ?? '').toLowerCase();
  await new Promise((r) => setTimeout(r, 800)); // show the loading state
  const code = /mock:(400|429|502)/.exec(input)?.[1];
  if (code) return { error: ERRORS[code] };
  if (path === '/api/email') {
    if (/fail|mra/.test(input)) return MOCK_EMAIL.spoofedMra;
    return /unsubscribe/.test(input) ? MOCK_EMAIL.promo : MOCK_EMAIL.routine;
  }
  if (/otp|bank/.test(input)) return MOCK_SCAN.highRisk;
  if (/http|bit\.ly/.test(input)) return MOCK_SCAN.suspicious;
  if (input.length < 40) return MOCK_SCAN.clarify;
  return MOCK_SCAN.safe;
}
