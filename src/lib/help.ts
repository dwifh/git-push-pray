// Server-only. Helping Hands requests (PLAN §7.3): Turso `help_requests` table, in-memory fallback.
// Holds only redacted text, for 30 minutes. The helper's phone number is never stored.
import type { HelpReply, Verdict } from '../shared/types.ts';

export const HELP_TTL = 30 * 60_000;

export type HelpRow = {
  code: string; // 6 digits, typed by the helper
  token: string; // random, kept by the elder's device for polling
  elderName: string;
  text: string; // redacted
  verdict: Verdict;
  flags: string[];
  advice: string;
  reply: HelpReply | null;
  createdAt: number;
};
export type HelpStore = {
  add(row: HelpRow): Promise<boolean>; // false if the code is live already
  get(code: string, now?: number): Promise<HelpRow | null>;
  byToken(token: string, now?: number): Promise<HelpRow | null>;
  setReply(code: string, reply: HelpReply, now?: number): Promise<boolean>; // false if expired, missing or answered
};

export function memoryHelpStore(rows = new Map<string, HelpRow>()): HelpStore {
  const live = (r: HelpRow | undefined, now: number) => (r && r.createdAt > now - HELP_TTL ? r : null);
  return {
    async add(row) {
      if (live(rows.get(row.code), row.createdAt)) return false;
      for (const [k, r] of rows) if (!live(r, row.createdAt)) rows.delete(k); // bound memory
      rows.set(row.code, row);
      return true;
    },
    async get(code, now = Date.now()) {
      return live(rows.get(code), now);
    },
    async byToken(token, now = Date.now()) {
      for (const r of rows.values()) if (r.token === token) return live(r, now);
      return null;
    },
    async setReply(code, reply, now = Date.now()) {
      const r = live(rows.get(code), now);
      if (!r || r.reply) return false;
      r.reply = reply;
      return true;
    },
  };
}

function tursoHelpStore(url: string, authToken: string | undefined, fallback: HelpStore): HelpStore {
  const ready = import('@libsql/client/web').then(async ({ createClient }) => {
    const db = createClient({ url, authToken });
    await db.execute(`CREATE TABLE IF NOT EXISTS help_requests (code TEXT PRIMARY KEY, token TEXT UNIQUE, created_at INTEGER,
      elder_name TEXT, text TEXT, verdict TEXT, flags TEXT, advice TEXT, reply TEXT NULL)`);
    return db;
  });
  type Db = Awaited<typeof ready>;
  const toRow = (r: Record<string, unknown>): HelpRow => ({
    code: String(r.code), token: String(r.token), elderName: String(r.elder_name), text: String(r.text),
    verdict: String(r.verdict) as Verdict, flags: JSON.parse(String(r.flags)), advice: String(r.advice),
    reply: r.reply == null ? null : (String(r.reply) as HelpReply), createdAt: Number(r.created_at),
  });
  const one = async (db: Db, where: string, arg: string, now: number) => {
    const { rows } = await db.execute({ sql: `SELECT * FROM help_requests WHERE ${where} = ? AND created_at > ?`, args: [arg, now - HELP_TTL] });
    return rows[0] ? toRow(rows[0]) : null;
  };
  // shortcut: on a Turso failure this isolate falls back to memory, which the other phone's isolate cannot see; fine for a demo with Turso up.
  const orFallback = <T>(f: (db: Db) => Promise<T>, g: () => Promise<T>) => ready.then(f).catch(g);
  return {
    add: (r) =>
      orFallback(
        async (db) => {
          // Expired rows go first, so their codes can be reused and old text does not linger.
          const [, res] = await db.batch([
            { sql: 'DELETE FROM help_requests WHERE created_at <= ?', args: [r.createdAt - HELP_TTL] },
            {
              sql: 'INSERT OR IGNORE INTO help_requests VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)',
              args: [r.code, r.token, r.createdAt, r.elderName, r.text, r.verdict, JSON.stringify(r.flags), r.advice],
            },
          ]);
          return res.rowsAffected === 1;
        },
        () => fallback.add(r),
      ),
    get: (code, now = Date.now()) => orFallback((db) => one(db, 'code', code, now), () => fallback.get(code, now)),
    byToken: (token, now = Date.now()) => orFallback((db) => one(db, 'token', token, now), () => fallback.byToken(token, now)),
    setReply: (code, reply, now = Date.now()) =>
      orFallback(
        async (db) =>
          (await db.execute({
            sql: 'UPDATE help_requests SET reply = ? WHERE code = ? AND reply IS NULL AND created_at > ?',
            args: [reply, code, now - HELP_TTL],
          })).rowsAffected === 1,
        () => fallback.setReply(code, reply, now),
      ),
  };
}

// On globalThis because the Expo dev server re-evaluates API route modules per request.
const g = globalThis as { __helpStore?: HelpStore };
export function getHelpStore(): HelpStore {
  if (g.__helpStore) return g.__helpStore;
  const memory = memoryHelpStore();
  const url = process.env.TURSO_DATABASE_URL;
  return (g.__helpStore = url ? tursoHelpStore(url, process.env.TURSO_AUTH_TOKEN, memory) : memory);
}
