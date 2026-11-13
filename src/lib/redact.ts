// Pure. PLAN §3.1: everything downstream (LLMs, logs, Feed) sees only this output.
// shortcut: regex misses names and free-form addresses; say so openly (PLAN D7). senderHash is still to do (step 1).

const URL_RE = /\bhttps?:\/\/([^\s/?#]+)([^\s?#]*)(?:[?#]\S*)?/gi;
const EMAIL_RE = /[\w.+-]+@(?:[a-z0-9-]+\.)+[a-z]{2,}/gi;
// Host, then an optional path (kept, redacted below); a query or fragment (needs ≥1 char after ? or #) is dropped.
const BARE_DOMAIN_RE = /(?<![@\w.-])((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,})(?![\w-])(\/[^\s?#]*)?(?:[?#]\S+)?/gi;

// Digit rules use (?<!\d)/(?!\d), not \b, so "OTP482913" is caught too.
const NIC_RE = /(?<![a-z0-9])[a-z]\d{12}[a-z0-9](?![a-z0-9])/gi; // before CARD: its 13 digits would read as a card
const CARD_RE = /(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g;
// shortcut: a run-together "+447..." number reads its country code greedily (447); fine as a coarse signal.
const INTL_PHONE_RE = /\+(\d{1,3})[\s-]?(?:\d[\s-]?){5,12}\d(?!\d)/g;
const LOCAL_PHONE_RE = /(?<!\d)(?:\d{9,12}|\d{3,4}[\s-]\d{4})(?!\d)/g;
const CODE_RE = /(?<!\d)\d{4,8}(?!\d)/g;
const NUMBER_RE = /(?<!\d)(?:\d[\s.-]?){6,}\d(?!\d)/g; // runs after CODE: catches leftover grouped digits ("57 12 34 56")

export function redact(text: string) {
  const hosts: string[] = [];
  // Private-use sentinel with no digits, so later digit rules never touch a stashed host.
  const stash = (host: string) => `${String.fromCharCode(0xe100 + hosts.push(host) - 1)}`;

  return text
    .replace(URL_RE, (m, authority: string, path: string) => {
      const scheme = m.slice(0, m.indexOf('://') + 3);
      return stash(scheme + authority.slice(authority.lastIndexOf('@') + 1)) + path;
    })
    .replace(EMAIL_RE, '[EMAIL]')
    .replace(BARE_DOMAIN_RE, (_, host: string, path?: string) => stash(host) + (path ?? ''))
    .replace(NIC_RE, '[NIC]')
    .replace(CARD_RE, '[CARD]')
    .replace(INTL_PHONE_RE, (_, cc: string) => `[PHONE +${cc}]`)
    .replace(LOCAL_PHONE_RE, '[PHONE]')
    .replace(CODE_RE, '[CODE]')
    .replace(NUMBER_RE, '[NUMBER]')
    .replace(/(.)/g, (_, c: string) => hosts[c.charCodeAt(0) - 0xe100]);
}
