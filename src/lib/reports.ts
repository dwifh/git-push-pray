// Server-only. Community reports (PLAN §5, D9, D12, D13): Turso `reports` table, in-memory fallback.
import { DISTRICTS, INSTITUTIONS, VECTORS } from '../shared/types.ts';
import { isAllowlisted, isReportImmune, registrableDomain } from './extract.ts';
import { redact } from './redact.ts';
import { DOMAIN, refang } from './threat-intel.ts';

export type ReportRow = {
  institution: string;
  vector: string;
  district: string;
  domain: string | null;
  snippet: string;
  reporterHash: string;
  createdAt: number;
};
export type Store = {
  add(row: ReportRow): Promise<void>;
  countReporters(domain: string): Promise<number>;
  since(ms: number): Promise<ReportRow[]>;
};

/** "https://Pay.Evil.com/x", "evil[.]com" → "evil.com"; null if not a domain. */
function normaliseDomain(raw: string) {
  const host = refang(raw.trim().toLowerCase()).replace(/^[a-z]+:\/\//, '').replace(/^[^/@]*@/, '').split(/[/?#:]/)[0].replace(/\.$/, '');
  return DOMAIN.test(host) ? registrableDomain(host) : null;
}

const pick = (v: unknown, allowed: readonly string[], field: string) => {
  if (typeof v !== 'string' || !allowed.includes(v)) throw new Error(`Choose a valid ${field}`);
  return v;
};

/** Pure. Throws a user-facing message on bad input (route returns 400). */
export function validateReport(body: unknown) {
  const b = (body ?? {}) as Record<string, unknown>;
  const institution = pick(b.institution, INSTITUTIONS, 'institution');
  const vector = pick(b.vector, VECTORS, 'vector');
  const district = pick(b.district, DISTRICTS, 'district');
  let domain: string | null = null;
  if (b.domain != null && b.domain !== '') {
    if (typeof b.domain !== 'string' || b.domain.length > 2000) throw new Error('That domain is not valid');
    domain = normaliseDomain(b.domain);
    if (!domain) throw new Error('That domain is not valid');
    if (isAllowlisted(domain)) throw new Error('That is an official website, so it cannot be reported');
    if (isReportImmune(domain)) domain = null; // still counts by institution, never against bit.ly or github.com
  }
  if (b.snippet != null && typeof b.snippet !== 'string') throw new Error('The message text is not valid');
  const snippet = redact(String(b.snippet ?? '').slice(0, 2000)).slice(0, 280);
  return { institution, vector, district, domain, snippet };
}

/** Evidence step (PLAN §3.2): distinct reporters per registrable domain; `ruleFloor` turns them into a level. Never throws. */
export async function communityReports(domains: string[], store: Store = getStore()) {
  try {
    return await Promise.all(domains.map(async (domain) => ({ domain, reporters: await store.countReporters(domain) })));
  } catch {
    return []; // evidence failure adds nothing
  }
}

export const WEEK = 7 * 86_400_000;
const top = (rows: ReportRow[], key: (r: ReportRow) => string | null) => {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const k = key(r);
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count).slice(0, 10);
};

/** Pure. Feed data for the last 7 days. */
export function trending(rows: ReportRow[], now = Date.now()) {
  const recent = rows.filter((r) => r.createdAt > now - WEEK);
  return {
    total: recent.length,
    byInstitution: top(recent, (r) => r.institution),
    byDistrict: top(recent, (r) => r.district),
    topDomains: top(recent, (r) => r.domain),
  };
}

/** Salted SHA-256 of the reporter's IP (Web Crypto). */
export async function hashReporter(ip: string, salt = process.env.HASH_SALT) {
  if (!salt) throw new Error('HASH_SALT is not set'); // fail closed: an unsalted IPv4 hash is brute-forceable
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ip));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

// PLAN §5: 18 demo reports so the Feed is not empty; exactly 2 distinct reporters on the demo-step-2 domain.
function demoRows(now = Date.now()): ReportRow[] {
  const plan: [string, string, string, string | null][] = [
    ['MAURITIUS_POST', 'SMS', 'PORT_LOUIS', 'parcel-track-mu.com'],
    ['MAURITIUS_POST', 'SMS', 'MOKA', 'parcel-track-mu.com'],
    ['MCB', 'SMS', 'PLAINES_WILHEMS', null], ['MCB', 'CALL', 'PORT_LOUIS', null], ['MCB', 'WHATSAPP', 'FLACQ', null],
    ['SBM', 'SMS', 'GRAND_PORT', null], ['SBM', 'EMAIL', 'PAMPLEMOUSSES', null], ['CEB', 'SMS', 'SAVANNE', null],
    ['CEB', 'CALL', 'BLACK_RIVER', null], ['CWA', 'SMS', 'RIVIERE_DU_REMPART', null], ['MRA', 'EMAIL', 'PLAINES_WILHEMS', null],
    ['MRA', 'EMAIL', 'MOKA', null], ['POLICE', 'CALL', 'PORT_LOUIS', null], ['POLICE', 'CALL', 'FLACQ', null],
    ['EMTEL', 'WHATSAPP', 'GRAND_PORT', null], ['MYT', 'SMS', 'RODRIGUES', null], ['OTHER', 'WHATSAPP', 'PAMPLEMOUSSES', null],
    ['MAURITIUS_POST', 'SMS', 'PLAINES_WILHEMS', null],
  ];
  return plan.map(([institution, vector, district, domain], i) => ({
    institution, vector, district, domain, snippet: '', reporterHash: `seed-${i}`, createdAt: now - (i + 1) * 3_600_000 * 7,
  }));
}

export function memoryStore(rows: ReportRow[] = demoRows()): Store {
  return {
    async add(row) {
      rows.push(row);
      if (rows.length > 5000) rows.shift(); // bound memory
    },
    async countReporters(domain) {
      return new Set(rows.filter((r) => r.domain === domain).map((r) => r.reporterHash)).size;
    },
    async since(ms) {
      return rows.filter((r) => r.createdAt > ms);
    },
  };
}

function tursoStore(url: string, authToken: string | undefined, fallback: Store): Store {
  const ready = import('@libsql/client/web').then(async ({ createClient }) => {
    const db = createClient({ url, authToken });
    // One round trip: a cold start must fit the scan's 3 s evidence timeout.
    const [, { rows }] = await db.batch([
      `CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, created_at INTEGER, institution TEXT,
      vector TEXT, district TEXT, domain TEXT NULL, snippet TEXT, reporter_hash TEXT)`,
      'SELECT COUNT(*) AS n FROM reports',
    ]);
    if (Number(rows[0].n) === 0) for (const r of demoRows()) await insert(db, r);
    return db;
  });
  type Db = Awaited<ReturnType<typeof import('@libsql/client/web').createClient>>;
  const insert = (db: Db, r: ReportRow) =>
    db.execute({
      sql: 'INSERT INTO reports VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: [crypto.randomUUID(), r.createdAt, r.institution, r.vector, r.district, r.domain, r.snippet, r.reporterHash],
    });
  // shortcut: a failed cold-start connection stays on memory for this isolate's life; retry `ready` if that bites.
  // Any Turso failure degrades to the in-memory store (D12): the demo never crashes on a DB outage.
  const orFallback = <T>(f: (db: Db) => Promise<T>, g: () => Promise<T>) => ready.then(f).catch(g);
  return {
    add: (r) => orFallback(async (db) => void (await insert(db, r)), () => fallback.add(r)),
    countReporters: (d) =>
      orFallback(
        async (db) => Number((await db.execute({ sql: 'SELECT COUNT(DISTINCT reporter_hash) AS n FROM reports WHERE domain = ?', args: [d] })).rows[0].n),
        () => fallback.countReporters(d),
      ),
    since: (ms) =>
      orFallback(
        async (db) =>
          (await db.execute({ sql: 'SELECT * FROM reports WHERE created_at > ? ORDER BY created_at DESC LIMIT 5000', args: [ms] })).rows.map((r) => ({
            institution: String(r.institution), vector: String(r.vector), district: String(r.district),
            domain: r.domain == null ? null : String(r.domain), snippet: String(r.snippet ?? ''),
            reporterHash: String(r.reporter_hash), createdAt: Number(r.created_at),
          })),
        () => fallback.since(ms),
      ),
  };
}

// On globalThis because the Expo dev server re-evaluates API route modules per request.
const g = globalThis as { __reportsStore?: Store };
export function getStore(): Store {
  if (g.__reportsStore) return g.__reportsStore;
  const memory = memoryStore();
  const url = process.env.TURSO_DATABASE_URL;
  return (g.__reportsStore = url ? tursoStore(url, process.env.TURSO_AUTH_TOKEN, memory) : memory);
}
