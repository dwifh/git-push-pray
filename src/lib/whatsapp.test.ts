// Run: node src/lib/whatsapp.test.ts
import assert from 'node:assert/strict';
import { appsecretProof, buildTemplatePayload } from './whatsapp.ts';

const vars = ['Asha', 'MCB', 'high risk'];

// live: our approved template, positional body parameters (PLAN §7).
assert.deepEqual(buildTemplatePayload('scam_warning', '23057123456', vars, 'live'), {
  messaging_product: 'whatsapp',
  to: '23057123456',
  type: 'template',
  template: {
    name: 'scam_warning',
    language: { code: 'en' },
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: 'Asha' },
          { type: 'text', text: 'MCB' },
          { type: 'text', text: 'high risk' },
        ],
      },
    ],
  },
});

// test: Meta's pre-approved hello_world, en_US only, no components (PLAN §7).
assert.deepEqual(buildTemplatePayload('scam_warning', '23057123456', vars, 'test'), {
  messaging_product: 'whatsapp',
  to: '23057123456',
  type: 'template',
  template: { name: 'hello_world', language: { code: 'en_US' } },
});

// text: our fixed wording as a plain message, link previews off. Only delivers inside Meta's 24 h window.
const text = buildTemplatePayload('call_alert', '23057123456', ['Asha', 'the caller asked for an OTP code'], 'text');
assert.ok(text.type === 'text');
assert.equal(text.text.preview_url, false);
assert.match(text.text.body, /^Scam call alert\n\nSafety alert: Asha may be on a scam phone call right now\./);

// Rejections (PLAN §10 step 1), in every mode, so test mode checks input exactly like live.
for (const mode of ['test', 'text', 'live'] as const) {
  const bad = (name: string, to: string, v: string[], why: string) =>
    assert.throws(() => buildTemplatePayload(name, to, v, mode), Error, `${mode}: ${why}`);
  bad('promo_blast', '23057123456', vars, 'unknown template');
  bad('toString', '23057123456', vars, 'inherited key is not a template');
  bad('hello_world', '23057123456', [], 'hello_world is picked by mode, not by the caller');
  bad('scam_warning', '23057123456', ['Asha', 'mcb-secure.com', 'high risk'], 'domain in a variable');
  bad('scam_warning', '23057123456', ['Asha\nhi', 'MCB', 'high risk'], 'newline');
  bad('scam_warning', '23057123456', ['Asha', 'MCB', 'x'.repeat(21)], 'over-length');
  bad('scam_warning', '+23057123456', vars, 'plus sign: digits only');
  bad('scam_warning', '5712345', vars, 'too short');
  bad('scam_warning', '1234567890123456', vars, 'too long');
  bad('scam_warning', '2305712 3456', vars, 'space');
}

// appsecret_proof = HMAC-SHA256(message = token, key = app secret). Published vector (Wikipedia, HMAC):
assert.equal(
  await appsecretProof('The quick brown fox jumps over the lazy dog', 'key'),
  'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8',
);

console.log('whatsapp ok');
