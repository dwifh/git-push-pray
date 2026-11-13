// Pure. PLAN §6 / D14: facts from a pasted raw email. No DNS lookups, no attachment decoding, no HTML rendering:
// the verdict reads the Authentication-Results header the receiving server already wrote.
import { toHost } from './extract.ts';

export type AuthResult = 'pass' | 'fail' | 'softfail' | 'none' | 'unknown';
export type EmailFacts = {
  spf: AuthResult;
  dkim: AuthResult;
  dmarc: AuthResult;
  fromDomain: string | null;
  replyToDomain: string | null;
  returnPathDomain: string | null;
  displayName: string;
  subject: string;
  body: string; // first text/plain part (else text/html with tags stripped); raw, so redact before use
};

export function parseHeaders(raw: string): EmailFacts {
  const text = raw.replace(/\r\n?/g, '\n').replace(/^\s+/, '');
  const { headers } = splitPart(text);
  // Topmost header = written by the receiving server; ones further down can come from the sender.
  const auth = headers.get('authentication-results')?.[0] ?? '';
  const result = (key: string): AuthResult => {
    const r = auth.match(new RegExp(`\\b${key}=(\\w+)`, 'i'))?.[1].toLowerCase();
    return r === 'hardfail' ? 'fail' : r === 'pass' || r === 'fail' || r === 'softfail' || r === 'none' ? r : 'unknown';
  };
  const from = address(headers.get('from')?.[0]);
  const parts = textParts(text);
  return {
    spf: result('spf'),
    dkim: result('dkim'),
    dmarc: result('dmarc'),
    fromDomain: from.domain,
    replyToDomain: address(headers.get('reply-to')?.[0]).domain,
    returnPathDomain: address(headers.get('return-path')?.[0]).domain,
    displayName: from.name,
    subject: decodeWords(headers.get('subject')?.[0] ?? ''),
    body: (parts.find((p) => !p.html && p.text) ?? parts.find((p) => p.text))?.text ?? '',
  };
}

// Headers (unfolded, lower-cased names, every occurrence in order) and body. A part with no headers starts with a blank line.
function splitPart(text: string) {
  const cut = `\n${text}`.indexOf('\n\n');
  const head = cut < 0 ? text : text.slice(0, Math.max(0, cut - 1));
  const headers = new Map<string, string[]>();
  for (const line of head.replace(/\n[ \t]+/g, ' ').split('\n')) {
    const m = line.match(/^([\w-]+):\s*(.*)$/);
    if (m) headers.set(m[1].toLowerCase(), [...(headers.get(m[1].toLowerCase()) ?? []), m[2].trim()]);
  }
  return { headers, body: cut < 0 ? '' : text.slice(cut + 1) };
}

// Leaf text parts in order; multiparts flattened (nesting capped), attachments skipped.
function textParts(raw: string, depth = 0): { html: boolean; text: string }[] {
  const { headers, body } = splitPart(raw);
  const type = headers.get('content-type')?.[0] ?? 'text/plain';
  if (/^multipart\//i.test(type)) {
    const boundary = type.match(/boundary="?([^";\s]+)"?/i)?.[1];
    if (!boundary || depth > 5) return [];
    const line = new RegExp(`^--${boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:--)?[ \\t]*$`, 'm');
    return body.split(line).slice(1).flatMap((p) => textParts(p.slice(1), depth + 1));
  }
  if (!/^text\/(plain|html)/i.test(type) || /^attachment/i.test(headers.get('content-disposition')?.[0] ?? '')) return [];
  const charset = type.match(/charset="?([^";\s]+)"?/i)?.[1] ?? 'utf-8';
  const text = decodeBody(body, headers.get('content-transfer-encoding')?.[0] ?? '', charset);
  if (!/^text\/html/i.test(type)) return [{ html: false, text: text.trim() }];
  const stripped = text
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<a\b[^>]*?\bhref\s*=\s*["']?([^"'\s>]+)[^>]*>/gi, ' $1 ') // keep the link target: extract must see it
    .replace(/<[^>]*>/g, ' ')
    // shortcut: only &nbsp; and &amp; are decoded; add the rest if HTML-only mail shows entities in flags.
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
  return [{ html: true, text: stripped.replace(/\s+/g, ' ').trim() }];
}

function decodeBody(body: string, encoding: string, charset: string) {
  if (/base64/i.test(encoding)) return decodeBytes(base64(body), charset);
  if (/quoted-printable/i.test(encoding)) return decodeBytes(qp(body.replace(/=\n/g, '')), charset);
  return body; // 7bit / 8bit: already text
}

// Byte strings: one char per byte (what atob returns).
const qp = (s: string) => s.replace(/=([0-9a-f]{2})/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
function base64(s: string) {
  try {
    return atob(s.replace(/\s/g, ''));
  } catch {
    return '';
  }
}
function decodeBytes(bytes: string, charset: string) {
  const data = Uint8Array.from(bytes, (c) => c.charCodeAt(0));
  try {
    return new TextDecoder(charset).decode(data);
  } catch {
    return new TextDecoder().decode(data); // unknown charset label: read as UTF-8
  }
}

// RFC 2047 "=?utf-8?B?...?=" words; whitespace between two encoded words is dropped.
const decodeWords = (s: string) =>
  s.replace(/=\?([^?]+)\?([bq])\?([^?]*)\?=(?:\s+(?==\?))?/gi, (_, charset: string, enc: string, text: string) =>
    decodeBytes(enc.toLowerCase() === 'b' ? base64(text) : qp(text.replace(/_/g, ' ')), charset),
  );

// "Name" <a@b.com>, Name <a@b.com>, a@b.com, a@b.com (Name)
function address(value = '') {
  const v = decodeWords(value);
  const angle = v.match(/<([^>]*)>/);
  const name = angle ? v.slice(0, angle.index) : (v.match(/\(([^)]*)\)/)?.[1] ?? '');
  const domain = (angle?.[1] ?? v).match(/@([^\s>()<,;]+)/)?.[1];
  return { name: name.trim().replace(/^"(.*)"$/, '$1').trim(), domain: domain ? toHost(domain) : null };
}
