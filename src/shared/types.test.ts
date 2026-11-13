// Run: node src/shared/types.test.ts
import assert from 'node:assert/strict';
import { INSTITUTIONS, INSTITUTION_LABEL, VERDICTS, isOneOf } from './types.ts';

assert.equal(isOneOf(VERDICTS, 'HIGH_RISK'), true);
for (const bad of ['high_risk', '', null, undefined, 2, {}]) assert.equal(isOneOf(VERDICTS, bad), false);

// INSTITUTION_LABEL fills WhatsApp template {{2}}: no dot (domain-like), single line, ≤ 40 chars.
for (const i of INSTITUTIONS) {
  const label = INSTITUTION_LABEL[i];
  assert.ok(!/[.\n\r\t]/.test(label) && label.length <= 40, `${i}: ${label}`);
}

console.log('types ok');
