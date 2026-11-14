import { LIMITS } from './types.ts';

// A message shared into the Android app, waiting for the Scan screen (PLAN §7.4).
// Memory only: never in a URL, storage or a log. shortcut: lost if Android kills the app before Scan opens; fine for a share that opens Scan at once.
let pending: string | null = null;

export function sharedText(payloads: readonly { value?: string; shareType?: string }[]): string | null {
  for (const p of payloads) {
    if (p.shareType !== 'text' && p.shareType !== 'url') continue;
    const text = (p.value ?? '').trim();
    if (text) return text.slice(0, LIMITS.text);
  }
  return null;
}

export function holdShare(text: string | null) {
  if (text) pending = text;
}

export function takeShare(): string | null {
  const text = pending;
  pending = null;
  return text;
}
