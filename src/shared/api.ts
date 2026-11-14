import { mockPost } from './mocks';

const MOCK = process.env.EXPO_PUBLIC_MOCK_API === '1';

// POST to our API. Resolves to the result, or { error } with a friendly message (server text shown as-is).
export async function post<T>(path: string, body: unknown): Promise<T | { error: string }> {
  if (MOCK) return mockPost(path, body) as Promise<T | { error: string }>;
  try {
    const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json) return { error: json?.error ?? 'Could not check this right now. If unsure, do not click links or reply.' };
    return json as T;
  } catch {
    return { error: 'No internet connection. If unsure, do not click links or reply.' };
  }
}

// Client fetch helper. Every API error is `{ error: string }` (TEAM-PLAN §3); the thrown message is safe to show.
export async function api<T>(path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(
      path,
      body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    );
  } catch {
    throw new Error("Can't reach the server. Check your internet and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Something went wrong. Please try again.');
  return data as T;
}
