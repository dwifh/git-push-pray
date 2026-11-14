// Client-safe. The device profile (PLAN §7.3, TEAM-PLAN §4.1): who uses this phone and who their helper is.
// Lives only in this browser's localStorage; the server gets `trustedContact` per send and never stores it.
import { carriesLink } from './messages.ts';

export type Profile = { role: 'helper' } | { role: 'elder'; firstName: string; helperName: string; trustedContact: string };
export type ProfileField = 'role' | 'firstName' | 'helperName' | 'trustedContact';
export type SaveResult = { ok: true; profile: Profile } | { ok: false; field?: ProfileField; error: string };
type Store = { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void };

const KEY = 'scamshield.profile';
const NAME_ERROR = 'Use a name of up to 30 letters, with no numbers or links.';

/** Typed number → E.164 digits ("23057123456"), or null. A bare 8-digit 5xxxxxxx is a Mauritian mobile. */
export function normalizePhone(typed: string): string | null {
  const s = typed.replace(/\(0\)/g, '').replace(/[\s\-.()]/g, '');
  const digits = /^\+\d+$/.test(s) ? s.slice(1) : /^00\d+$/.test(s) ? s.slice(2) : /^5\d{7}$/.test(s) ? `230${s}` : /^\d{9,15}$/.test(s) ? s : '';
  return /^\d{8,15}$/.test(digits) ? digits : null;
}

// Stricter than a WhatsApp name variable (messages.ts validateVars): one line, ≤ 30, no link, and no digits at all.
const cleanName = (x: unknown) => {
  const n = typeof x === 'string' ? x.trim() : '';
  return n && n.length <= 30 && !/[\p{N}\p{Cc}\p{Cf}]/u.test(n) && !carriesLink(n) ? n : null;
};

function check(x: unknown): SaveResult {
  const p = (typeof x === 'object' && x !== null ? x : {}) as Record<string, unknown>;
  if (p.role === 'helper') return { ok: true, profile: { role: 'helper' } };
  if (p.role !== 'elder') return { ok: false, field: 'role', error: 'Choose who uses this phone.' };
  const firstName = cleanName(p.firstName);
  if (!firstName) return { ok: false, field: 'firstName', error: NAME_ERROR };
  const helperName = cleanName(p.helperName);
  if (!helperName) return { ok: false, field: 'helperName', error: NAME_ERROR };
  const trustedContact = typeof p.trustedContact === 'string' ? normalizePhone(p.trustedContact) : null;
  if (!trustedContact) return { ok: false, field: 'trustedContact', error: 'Enter a WhatsApp number, for example 5712 3456 or +44 7700 900123.' };
  return { ok: true, profile: { role: 'elder', firstName, helperName, trustedContact } };
}

// Reading localStorage itself can throw (blocked site data), and it is missing outside a browser.
const device = (): Store | undefined => {
  try {
    return (globalThis as { localStorage?: Store }).localStorage;
  } catch {
    return undefined;
  }
};

/** The saved profile, or null when not set up, unreadable or edited into something invalid. Never throws. */
export function loadProfile(store = device()): Profile | null {
  try {
    const r = check(JSON.parse(store!.getItem(KEY) ?? 'null'));
    return r.ok ? r.profile : null;
  } catch {
    return null;
  }
}

/** Validates the setup form and saves it. On `ok: false`, show `error` next to `field`. Never throws. */
export function saveProfile(input: unknown, store = device()): SaveResult {
  const r = check(input);
  if (!r.ok) return r;
  try {
    store!.setItem(KEY, JSON.stringify(r.profile));
    return r;
  } catch {
    return { ok: false, error: 'This phone could not save the settings. Turn off private browsing and try again.' };
  }
}

/** "Change setup" / "Start again". Never throws. */
export function clearProfile(store = device()): void {
  try {
    store!.removeItem(KEY);
  } catch {
    // nothing saved, nothing to clear
  }
}
