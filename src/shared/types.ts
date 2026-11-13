// Client-safe API contract (TEAM-PLAN §3): screens and server routes both import from here.
// No secrets and no runtime imports. Change a shape only after announcing it in the team chat.
// Enums are `as const` arrays: Node type stripping has no `enum`, and routes validate input with `isOneOf`.

export const isOneOf = <T extends string>(list: readonly T[], x: unknown): x is T => list.includes(x as T);

export const VERDICTS = ['SAFE', 'SUSPICIOUS', 'HIGH_RISK'] as const;
export type Verdict = (typeof VERDICTS)[number];

export const IMPORTANCES = ['URGENT', 'ROUTINE', 'PROMOTIONAL'] as const;
export type Importance = (typeof IMPORTANCES)[number];

export const INSTITUTIONS = ['MCB', 'SBM', 'MAURITIUS_POST', 'CEB', 'CWA', 'MRA', 'EMTEL', 'MYT', 'POLICE', 'OTHER'] as const;
export type Institution = (typeof INSTITUTIONS)[number];

// Display names, also sent as `scam_warning` {{2}} (docs/WHATSAPP-TEMPLATES.md): never a dot, so never domain-like.
export const INSTITUTION_LABEL: Record<Institution, string> = {
  MCB: 'MCB',
  SBM: 'SBM Bank',
  MAURITIUS_POST: 'Mauritius Post',
  CEB: 'CEB',
  CWA: 'CWA',
  MRA: 'MRA',
  EMTEL: 'Emtel',
  MYT: 'Mauritius Telecom',
  POLICE: 'the Police',
  OTHER: 'a well-known organisation',
};

export const VECTORS = ['SMS', 'WHATSAPP', 'CALL', 'EMAIL'] as const;
export type Vector = (typeof VECTORS)[number];

export const DISTRICTS = [
  'PORT_LOUIS',
  'PAMPLEMOUSSES',
  'RIVIERE_DU_REMPART',
  'FLACQ',
  'GRAND_PORT',
  'SAVANNE',
  'PLAINES_WILHEMS',
  'MOKA',
  'BLACK_RIVER',
  'RODRIGUES',
] as const;
export type District = (typeof DISTRICTS)[number];

// Input caps, in characters, shared so the screens can stop over-long input before the server rejects it.
export const LIMITS = { text: 4000, sender: 100, emailRaw: 100_000, snippet: 280 } as const;

// ---- POST /api/scan, POST /api/email ----

export type ScanRequest = { text: string; sender?: string };
export type EmailRequest = { raw: string };

// 'unknown' = the lookup failed or timed out (3 s); it never counts as clean.
export type DomainIntel = {
  domain: string;
  vt: { malicious: number; suspicious: number } | 'unknown';
  urlhaus: 'listed' | 'not_listed' | 'unknown';
};

export type ScanResult = {
  verdict: Verdict;
  flags: string[]; // plain English; render as plain <Text>, never as links or markdown
  advice: string;
  scamType: string;
  clarify?: string; // set when the message looks cut off; show the question, keep the verdict
  evidence: {
    domains: string[];
    intel: DomainIntel[];
    communityReports: { domain: string; reporters: number }[];
    ragMatches: { title: string; score: number }[];
  };
  metadata: { modelsUsed: string[]; latencyMs: number };
};

export type EmailResult = ScanResult & { importance: Importance };

// ---- POST /api/coach ----

export type CoachRequest = { text: string };
export type CoachResponse = { score: number }; // 0–1; the screen takes the max with its own score

// ---- GET / POST /api/reports ----

export type Report = { institution: Institution; vector: Vector; district: District; domain?: string; snippet?: string };
export type ReportResponse = { ok: true };

// Last 7 days, each list sorted by count, highest first.
export type Trending = {
  byInstitution: { institution: Institution; count: number }[];
  byDistrict: { district: District; count: number }[];
  topDomains: { domain: string; count: number }[];
};

// ---- POST /api/alert ----

// The server swaps in Meta's `hello_world` while WHATSAPP_TEMPLATE_MODE=test; clients always name the real template.
export const ALERT_TEMPLATES = ['call_alert', 'scam_warning'] as const;
export type AlertTemplate = (typeof ALERT_TEMPLATES)[number];

export type AlertRequest = { template: AlertTemplate; to: string; vars: string[] }; // to: E.164 digits; vars fill {{1}}, {{2}}, …
export type AlertResponse = { sent: true } | { sent: false; fallback: 'wa.me' };

// ---- /api/help (Helping Hands, PLAN §7.3) ----
// Elder: POST → WhatsApp code to the helper, keep `token`; poll GET ?token= every 3 s until `reply` is set.
// Helper: GET ?code= → the redacted message and the verdict; PUT { code, reply } once. Codes expire after 30 min.

export const HELP_REPLIES = ['CALL_YOU', 'DELETE_IT', 'GENUINE'] as const;
export type HelpReply = (typeof HELP_REPLIES)[number];
// The elder's screen shows "<helper> says: <label>". GENUINE is refused on HIGH_RISK (400).
export const HELP_REPLY_LABEL: Record<HelpReply, string> = {
  CALL_YOU: "Don't reply. I'll call you.",
  DELETE_IT: 'Block it and delete it.',
  GENUINE: "It's genuine. Go ahead.",
};

export type HelpRequest = { elderName: string; to: string; text: string; sender?: string; verdict: Verdict }; // verdict: what the elder saw
export type HelpCreated = { code: string; token: string; sent: boolean };
export type HelpView = { elderName: string; text: string; verdict: Verdict; flags: string[]; advice: string; reply: HelpReply | null }; // text is redacted
export type HelpPoll = { reply: HelpReply | null };
export type HelpAnswer = { code: string; reply: HelpReply };

// ---- Every route ----

export type ApiError = { error: string }; // status 400 bad input, 429 rate limit, 502 upstream down
