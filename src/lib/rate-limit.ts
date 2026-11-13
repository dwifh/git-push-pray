// shortcut: in-memory sliding window per server instance; resets on restart, not shared across instances. Move to a KV/Redis store when deployed multi-instance.
const WINDOW_MS = 60_000;
// On globalThis because the Expo dev server re-evaluates API route modules per request.
const store = globalThis as { __rateLimitHits?: Map<string, number[]> };
const hits = (store.__rateLimitHits ??= new Map<string, number[]>());

// Per-user and global buckets are per route, so scans never eat the strict /api/alert allowance.
export function allowRequest(
  route: string,
  ip: string,
  perUser = Number(process.env.ALERTS_RATE_LIMIT_PER_USER_PER_MINUTE) || 5,
  global = Number(process.env.ALERTS_RATE_LIMIT_GLOBAL_PER_MINUTE) || 60,
  now = Date.now(),
) {
  const key = `${route}:${ip}`;
  const globalKey = `${route}:\0global`;
  const recent = (k: string) => (hits.get(k) ?? []).filter((t) => t > now - WINDOW_MS);
  const user = recent(key);
  const all = recent(globalKey);
  const ok = user.length < perUser && all.length < global;
  if (ok) {
    user.push(now);
    all.push(now);
  }
  hits.set(key, user);
  hits.set(globalKey, all);
  // Bound memory when many distinct keys show up.
  if (hits.size > 10_000) for (const [k, ts] of hits) if (!ts.some((t) => t > now - WINDOW_MS)) hits.delete(k);
  return ok;
}

// Only trust Cloudflare's header (set by EAS Hosting; clients can't forge it there). x-forwarded-for is client-controlled.
// Without it (local dev) everyone shares one key.
export function clientKey(request: Request) {
  return request.headers.get('cf-connecting-ip') ?? 'anonymous';
}
