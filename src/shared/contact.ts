// Trusted contact, kept on this device only (PLAN D10). Keys from TEAM-PLAN §4.
const KEYS = { to: 'trustedContact', firstName: 'firstName' } as const;

function read(key: string) {
  try {
    return globalThis.localStorage?.getItem(key) ?? '';
  } catch {
    return '';
  }
}
function write(key: string, value: string) {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the app still works, the contact just isn't remembered.
  }
}

export const getContact = () => ({ to: read(KEYS.to), firstName: read(KEYS.firstName) });

export function saveContact(to: string, firstName: string) {
  write(KEYS.to, to);
  write(KEYS.firstName, firstName.trim().slice(0, 30)); // call_alert {{1}} max length
}

// E.164 digits only (no "+"). shortcut: a bare 7–8 digit number is assumed Mauritian (+230); fine for Mauritius users.
export function normalizeNumber(input: string): string | null {
  let d = input.replace(/[\s\-().]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('00')) d = d.slice(2);
  else if (/^\d{7,8}$/.test(d)) d = '230' + d;
  return /^\d{8,15}$/.test(d) ? d : null;
}
