// Client-safe. The fixed WhatsApp alert wording (docs/WHATSAPP-TEMPLATES.md), rendered for
// plain-text sends and the wa.me fallback. Keep it identical to what Meta approved.

const FOOTER = 'Scam Shield Mauritius safety alert';
const TRUSTED = 'You are receiving this because they chose you as their trusted contact in Scam Shield.';

export const TEMPLATES = {
  call_alert: {
    header: 'Scam call alert',
    body: `Safety alert: {{1}} may be on a scam phone call right now. The warning sign we found: {{2}}.

Please call them now and tell them to hang up. Remind them never to share an OTP, PIN or password with a caller and never to send money because a caller asks.

${TRUSTED}`,
    maxLengths: [30, 80],
  },
  scam_warning: {
    header: 'Scam warning',
    body: `Hello, this is a scam warning for the family of {{1}}. They received a message pretending to be from {{2}}, and Scam Shield rated it {{3}}.

If you get a similar message, do not click its links and never share OTP codes, PINs or passwords. If in doubt, call the organisation on the number printed on your card or bill.

${TRUSTED}`,
    maxLengths: [30, 40, 20],
  },
} as const;

export type TemplateName = keyof typeof TEMPLATES;

// PLAN D15: we never spread a link. Any word.word counts as a domain, so "my.t" is refused too.
const LINKY = /h[tx]{2}ps?:|www\.|\w\.\w|\[\.\]|\(\.\)/i; // defanged links too: we never spread a scam link

/** Throws if a variable could carry a link, a second line or too much text. */
export function validateVars(name: TemplateName, vars: string[]): void {
  const max = TEMPLATES[name].maxLengths;
  if (vars.length !== max.length) throw new Error(`${name} needs ${max.length} variables`);
  vars.forEach((v, i) => {
    if (typeof v !== 'string' || !v.trim() || v.length > max[i] || /[\r\n\t]/.test(v) || LINKY.test(v)) {
      throw new Error(`Variable ${i + 1} is not allowed`);
    }
  });
}

export function renderMessage(name: TemplateName, vars: string[]): string {
  validateVars(name, vars);
  const t = TEMPLATES[name];
  const body = t.body.replace(/\{\{(\d)\}\}/g, (_, n: string) => vars[Number(n) - 1]);
  return `${t.header}\n\n${body}\n\n${FOOTER}`;
}
