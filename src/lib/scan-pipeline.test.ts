// Run: node src/lib/scan-pipeline.test.ts
// Fakes stand in for Jev, Claude and the evidence lookups, so this runs offline with no keys.
import assert from 'node:assert/strict';
import type { ClaudeResult } from './claude.ts';
import { runScanPipeline, type Deps, type JevResult } from './scan-pipeline.ts';

const DEMO_1 = 'MCB: your account is blocked. Confirm your OTP 482913 at https://mcb-secure-login.com/verify within 24 hours.';
const DEMO_3 = 'CEB: scheduled maintenance. Power supply will be interrupted in Moka on Sunday from 08:00 to 12:00.';

const quietJev: JevResult = { signals: {}, isFragment: 0, missingField: 'none' };
const claudeSays = (verdict: ClaudeResult['verdict']): ClaudeResult => ({ verdict, redFlags: verdict === 'SAFE' ? [] : [`claude: ${verdict}`], scamType: 'test', advice: `advice for ${verdict}` });
const fakes = (over: Partial<Deps> = {}): Deps => ({
  jev: async () => quietJev,
  claude: async () => claudeSays('SAFE'),
  intel: async () => [],
  reports: async () => [],
  rag: async () => [],
  ...over,
});
const down = async () => {
  throw new Error('down');
};

// Every model down: the rule floor still answers, and says the check was incomplete.
{
  const r = await runScanPipeline({ text: DEMO_1 }, fakes({ jev: down, claude: async () => null }));
  assert.equal(r.verdict, 'HIGH_RISK', 'lookalike + credential + link');
  assert.ok(r.flags.some((f) => f.startsWith('Automatic check incomplete')));
  assert.deepEqual(r.metadata.modelsUsed, []);
  assert.ok(r.advice.length > 0, 'fallback advice when Claude is down');
  assert.deepEqual(r.evidence.domains, ['mcb-secure-login.com']);
}

// Monotonic: a model saying SAFE never lowers the floor, and its SAFE advice is not shown on a HIGH_RISK card.
{
  const r = await runScanPipeline({ text: DEMO_1 }, fakes());
  assert.equal(r.verdict, 'HIGH_RISK');
  assert.notEqual(r.advice, 'advice for SAFE');
  assert.ok(!r.flags.some((f) => f.startsWith('Automatic check incomplete')));
}

// Models only add: Claude SUSPICIOUS lifts a clean message, Jev's calibrated score can reach HIGH_RISK.
{
  const r = await runScanPipeline({ text: DEMO_3 }, fakes({ claude: async () => claudeSays('SUSPICIOUS') }));
  assert.equal(r.verdict, 'SUSPICIOUS');
  assert.equal(r.advice, 'advice for SUSPICIOUS');
  assert.ok(r.flags.includes('claude: SUSPICIOUS'));
  const j = await runScanPipeline({ text: DEMO_3 }, fakes({ jev: async () => ({ ...quietJev, signals: { asksForSecret: 1 } }) }));
  assert.equal(j.verdict, 'HIGH_RISK');
  assert.deepEqual(j.flags, ['It seems to ask for a secret code, PIN, password or card details.'], 'a Jev-raised verdict names its reason');
  const clean = await runScanPipeline({ text: DEMO_3 }, fakes());
  assert.equal(clean.verdict, 'SAFE');
  assert.equal(clean.flags.length, 0);
  assert.match(clean.advice, /^No known scam signs found/, "a model's SAFE advice never replaces our wording");
}

// Redact before egress: no model or lookup sees the OTP or the phone number.
{
  const seen: string[] = [];
  const spy = (s: string) => (seen.push(s), Promise.resolve([]));
  await runScanPipeline(
    { text: 'Call 5712 3456 and give OTP 482913', sender: '+230 5798 1234' },
    fakes({
      jev: async (t) => (seen.push(t), quietJev),
      claude: async (t, e) => (seen.push(t, e), claudeSays('SAFE')),
      rag: spy,
    }),
  );
  for (const s of seen) for (const secret of ['482913', '5712', '5798']) assert.ok(!s.includes(secret), `leaked ${secret}`);
  assert.ok(seen[0].includes('[PHONE +230]'), 'the sender reaches the models, redacted');
}

// Clarify: a fragment with a missing field asks a question and skips Claude, but never stalls a clear scam.
{
  let claudeCalls = 0;
  const fragment = fakes({
    jev: async () => ({ signals: {}, isFragment: 0.9, missingField: 'link' }),
    claude: async () => (claudeCalls++, claudeSays('SAFE')),
  });
  const r = await runScanPipeline({ text: 'Your parcel is waiting' }, fragment);
  assert.equal(r.clarify, 'Please paste the whole message, including any link.');
  assert.equal(r.verdict, 'SAFE');
  assert.equal(claudeCalls, 0);
  assert.ok(!r.flags.some((f) => f.startsWith('Automatic check incomplete')), 'skipping Claude on purpose is not a failure');
  const scam = await runScanPipeline({ text: DEMO_1 }, fragment);
  assert.equal(scam.clarify, undefined);
  assert.equal(claudeCalls, 1);
}

// Evidence: reports are looked up by registrable domain, and 3 reporters lift the verdict.
{
  let asked: string[] = [];
  const r = await runScanPipeline(
    { text: 'Pay at https://www.parcel-track-mu.com/pay' },
    fakes({ reports: async (d) => ((asked = d), d.map((domain) => ({ domain, reporters: 3 }))) }),
  );
  assert.deepEqual(asked, ['parcel-track-mu.com']);
  assert.equal(r.verdict, 'HIGH_RISK');
}

// A failed or hung lookup becomes `unknown` within 3 s; it never throws and never counts as clean.
{
  const t0 = Date.now();
  const r = await runScanPipeline(
    { text: 'See https://example.org' },
    fakes({ intel: () => new Promise(() => {}), reports: down, rag: down }),
  );
  assert.ok(Date.now() - t0 < 3500);
  assert.deepEqual(r.evidence.intel, [{ domain: 'example.org', vt: 'unknown', urlhaus: 'unknown' }]);
  assert.deepEqual(r.evidence.communityReports, []);
}

console.log('scan-pipeline ok');
