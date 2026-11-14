// Client fetch helper. Every API error is `{ error: string }` (TEAM-PLAN §3); the thrown message is safe to show.
// Same call, but resolves to { error } instead of throwing (the Scan and Email pages use this shape).
export const post = <T,>(path: string, body: unknown): Promise<T | { error: string }> =>
  api<T>(path, body).catch((e: Error) => ({ error: e.message }));

export async function api<T>(path: string, body?: unknown, method = 'POST'): Promise<T> {
  let res: Response;
  try {
    res = await fetch(
      path,
      body === undefined ? undefined : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    );
  } catch {
    throw new Error("Can't reach the server. Check your internet and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Something went wrong. Please try again.');
  return data as T;
}
