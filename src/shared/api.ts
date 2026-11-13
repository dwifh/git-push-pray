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
