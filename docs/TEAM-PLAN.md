# Team Plan — 4 people

As of 2026-11-13. Step 0 lands first as the shared base. Then two backend and two frontend owners work in parallel. Frontend builds against mock data until each API is live. Backend logic is tuned on a hand-built Mauritius test set, topped up with public SMS and email data. Nothing here reopens a decision in `PLAN.md`.

## 1. Priority order

1. **Step 0: shell + deploy** (Claude does it, on go-ahead). Tabs, `/api/health`, EAS deploy, env pushed. Everyone pulls `main` before branching.
2. **The shared contract** (Backend 1, first hour). Write `src/shared/types.ts` and the API shapes in §3. Frontend mocks are built from it, so it must land before any screen work.
3. **Mauritius test set, first pass** (Backend 2, in parallel). 30 messages are enough to start. It feeds the rules, the knowledge base (§8 of PLAN) and the demo script.
4. **Pure modules, test-first** (PLAN step 1, both backend owners). Frontend starts Phase 1 at the same time.
5. **Pipeline + intel + RAG** (steps 2–3). Frontend wires Scan to the real `/api/scan` as soon as it answers.
6. **Coach, Feed, Email, WhatsApp** (steps 5–8). Each frontend owner wires their screen when its route lands.
7. **Design pass, then harden + rehearse** (step 9, everyone).

## 2. Who does what

| Owner | Area | PLAN steps | First task | Done when |
|---|---|---|---|---|
| **Backend 1** — pipeline | `types.ts`, `redact`, `extract`, `rules`, `verdict`, `scam-signals`, `email.ts`, `scan-pipeline`, `/api/scan`, `/api/email`, eval runner | 1, 3, 7 (server) | `src/shared/types.ts` + §3 contract | The test set passes the bar in §5; demo messages 1–3 get the expected verdicts |
| **Backend 2** — data + integrations | test set, KB rewrite + seed, `threat-intel`, `rag`, `reports` (Turso), `rate-limit` port, `whatsapp.ts`, `/api/alert`, `/api/coach`, `/api/reports`, Meta template follow-up | 1 (rate-limit, whatsapp payload), 2, 6 (server), 8 (server) | Test set first pass (§5, priority 1) | Step 2 criterion met; a third distinct reporter lifts a domain to `HIGH_RISK`; `hello_world` arrives in test mode |
| **Frontend 1** — Scan + Email | Scan screen, verdict card, flags, advice, action links, Warn family button, Email Guard screen + quarantine card | 4, 7 (screen) | Scan screen against mocks, every state | Phone-width browser shows every verdict, the clarify question and errors; links open |
| **Frontend 2** — Coach + Feed | `src/shared/coach.ts` (test-first), Coach flow, HANG UP screen, trusted-contact settings, Feed screen + report form, shared `sendAlert()` helper with `wa.me` fallback | 1 (`coach.ts`), 5, 6 (screen), 8 (client) | `coach.ts` + its test, then the Coach flow against mocks | Fake-police scenario reaches HANG UP with the network off |

Work on one branch per step, open a PR to `main` and let CI (lint + typecheck) pass before merging. Run `npm test` before every PR once step 1 lands.

## 3. API contract (frontend ↔ backend)

Backend 1 makes these the real types in `src/shared/types.ts`. Any change is announced in the team chat before it merges. Every error is `{ error: string }` with status 400 (bad input), 429 (rate limit) or 502 (upstream down).

| Route | Request | Response |
|---|---|---|
| `POST /api/scan` | `{ text, sender? }` | `ScanResult` (PLAN §3.5): `{ verdict, flags[], advice, scamType, clarify?, evidence, metadata }` |
| `POST /api/email` | `{ raw }` (headers or `.eml`, ≤ 100 KB) | `ScanResult & { importance: "URGENT" \| "ROUTINE" \| "PROMOTIONAL" }` |
| `POST /api/coach` | `{ text }` | `{ score }` (0–1; the screen takes the max with its own score) |
| `GET /api/reports` | — | trending: counts by institution and district, top domains, last 7 days |
| `POST /api/reports` | `{ institution, vector, district, domain?, snippet? }` | `{ ok: true }` |
| `POST /api/alert` | `{ template, to, vars }` | `{ sent: true }` or `{ sent: false, fallback: "wa.me" }` |
| `GET /api/health` | — | 200 |

## 4. Frontend guide

**How the look is decided is up to you.** Colours, type, layout, icons, motion, illustrations and the drama of the HANG UP screen are your call. Build in three phases:

1. **Test frontend (logic first, looks later).** Plain components, just legible. Drive every screen from mock `ScanResult` fixtures in `src/shared/mocks.ts`, switched on with `EXPO_PUBLIC_MOCK_API=1`. Cover every state: loading, `SAFE`, `SUSPICIOUS`, `HIGH_RISK`, clarify question, 400, 429 and 502. Coach scoring, the short-circuit, `localStorage` and the fallback links must really work. *Done when* a teammate can tap through every state at phone width and the logic behaves.
2. **Wire.** As each backend route lands, switch that screen to the real API and fix what the real data breaks. Keep the mocks for offline work.
3. **Design pass.** Make it yours. If you can, run a 5-minute test with someone over 60 and fix whatever they hesitate on.

**Rules that do not bend** (CLAUDE.md):
- `SAFE` is shown as "No known scam signs found", never "This is safe".
- Elder-first: large text, high contrast, one decision per screen, tap targets at least 48 px. Verdict colour always comes with a word and an icon, never colour alone.
- Show model output (flags, advice) as plain `<Text>` only: no markdown, no tappable links built from it.
- The HANG UP screen renders from on-device scoring alone. The WhatsApp alert is a button below it, never a gate in front of it.
- Every send has a `wa.me` fallback; other actions are `tel:` and MAUCORS links.
- Screens import only from `src/shared/`, never from `src/lib/` (server code holds secrets). No secrets in `EXPO_PUBLIC_*`.
- English only.

**Implementation pointers:**
- Routes: tabs in `src/app/_layout.tsx`; screens are `index.tsx` (Scan), `coach.tsx`, `feed.tsx` and `email.tsx`. Components go in `src/components/`, never `src/app/`. Check the SDK 58 Expo Router docs before using a navigator API; the `expo-router` skill helps.
- Calls: `fetch('/api/scan', { method: 'POST', body: JSON.stringify({ text, sender }) })`. Relative URLs work on the web build. On `!res.ok`, show `body.error`.
- Storage: `trustedContact` (E.164 digits) and `firstName` in `globalThis.localStorage`, every read and write wrapped in `try/catch`.
- Links: `Linking.openURL` from `react-native` for `tel:999`, `https://wa.me/<number>?text=<encoded>` and MAUCORS. A `wa.me` text never contains the scam link.
- The demo is the web PWA. Test in Chrome device mode at 360 × 800. Check that any icon library you use renders on web.

## 5. Backend datasets, by priority

Nothing here trains a model. The data is an **evaluation set**: it checks the regexes and rules, calibrates `RAG_MATCH_THRESHOLD` (starts at 0.55) and **calibrates model routing** (PLAN §3.6): Jev cutoffs and signal weights, and how far a Claude verdict may raise the level, come from measured AUC and precision. Coach cutoffs stay fixed.

| Priority | Dataset | What it tests | Size to use | How to get it |
|---|---|---|---|---|
| **1 — must have** | **Mauritius test set, hand-built** | Every rule, redaction, lookalikes, the demo script, the KB | 80 messages: 50 scams covering the 10 patterns in PLAN §8, 30 genuine (CEB outage notice, bank transaction SMS, Mauritius Post delivery, MRA reminder, family chat) | Collect from MAUCORS phishing/scam pages, Police and bank fraud warnings, local news. Replace every real phone number, name and account number with fake ones of the **same format**, so redaction is still tested |
| **done** | **DIFrauD** (MIT, LREC-COLING 2024; Cleanlab-cleaned, hand-curated labels): SMS (UCI spam + Mishra & Soni smishing), email phishing, job scams | Model calibration (PLAN §3.6) | 360 messages: 30 scam + 30 genuine per domain, their validation split → our `dev`, their test split → our `test` | `npm run fetch-data` → `data/eval/messages.jsonl` (binary `label`: `scam` / `genuine`). Note: its SMS "deceptive" class includes marketing spam |
| **2** | Mishra & Soni SMS phishing set (ham / spam / smishing) | False alarms on ordinary SMS; recall on smishing outside Mauritius | Sample 300 (100 per class). Rules-only run on all of it is free; full pipeline on 50 | Mendeley Data (link in §6) |
| **3** | Domain lists: Tranco top sites (good) + URLhaus recent hosts (bad) | Lookalike rule false positives; step 2 intel criterion | 100 each | Tranco CSV download; URLhaus API with our key |
| **4** | Email headers, hand-made | D14 rules: `dmarc=fail`, Reply-To mismatch, display-name spoofing | 5 spoofed + 5 real newsletters | Team inboxes ("Show original", headers only, addresses redacted). The SpamAssassin corpus is from 2002–2005, before DMARC existed, so it can only test parsing |
| **5** | Coach call scenarios, hand-written | Coach scoring + short-circuit | 12 answer lists | Write from Police scam-call warnings; they live in `coach.test.ts` |
| skip | UCI SMS Spam Collection | — | — | 2011 UK/Singapore marketing spam, not scams. The Mishra & Soni set already covers ordinary SMS |

**Test set format:** `data/eval/messages.jsonl`, one line per message:
`{ "id", "text", "sender"?, "channel": "SMS|WHATSAPP|EMAIL", "institution", "expected": "SAFE|SUSPICIOUS|HIGH_RISK", "mustFlag"?: [...], "source": "<url>" }`.

**Eval runner** (Backend 1): `npm run eval`. Rules-only mode needs no keys, is deterministic and can run in CI. Full mode samples through the live pipeline. It prints a 3 × 3 confusion table and the misses.

**Proposed pass bar:** no scam rated `SAFE` (the miss that hurts an elder), and fewer than 10% of genuine messages above `SAFE`.

**About `/last-3-days`:** that skill is not installed in this project, and 3 days is the wrong window. Mauritian campaigns (bank OTP, parcel fee, CEB disconnection) recur for months, so a 3-day sweep would return a handful of items, skewed to whatever made the news that week. Instead:
- Run the installed `research` skill once over the **last 12–18 months** (MAUCORS, Police, bank warnings, local news). It writes a sourced Markdown file that seeds both the test set and the KB.
- Then do a **last-week sweep the day before the demo** to add one or two "seen this week" examples for stage freshness.

## 6. Sources

Some links were checked on 2026-11-13; three could not be fetched automatically. Open the ones marked "unverified" in a browser before relying on them.

- MAUCORS (CERT-MU's reporting system): <https://maucors.govmu.org/> — [Phishing](https://maucors.govmu.org/maucors/?page_id=1290), [Online scams and frauds](https://maucors.govmu.org/maucors/?page_id=1248), [News](https://maucors.govmu.org/maucors/?page_id=1543), [Report](https://maucors.govmu.org/maucors/?page_id=9). `cert.govmu.org` did not resolve on 2026-11-13.
- DIFrauD: <https://huggingface.co/datasets/difraud/difraud> (MIT). Fetched 2026-11-13.
- Mishra & Soni SMS phishing dataset (Mendeley Data): <https://data.mendeley.com/datasets/f45bkkt8pr/1> — unverified.
- UCI SMS Spam Collection: <https://archive.ics.uci.edu/dataset/228/sms+spam+collection> — unverified.
- Tranco list: <https://tranco-list.eu/> — free daily top-1M CSV.
- URLhaus: <https://urlhaus.abuse.ch/> — its downloadable feeds are by ASN, country or TLD only; pull recent hosts through the API (<https://urlhaus.abuse.ch/api/>).
- SpamAssassin public corpus: <https://spamassassin.apache.org/old/publiccorpus/> — 2002–2005.
- Nazario phishing corpus: <https://monkey.org/~jose/phishing/> — unverified; old, use for parsing tests only.
