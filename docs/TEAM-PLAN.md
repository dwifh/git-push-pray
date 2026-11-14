# Team Plan — 4 people

Updated 2026-11-13 (evening). Step 0 is live, and calibrated model routing (PLAN §3.6) has landed on `main`. Two backend and two frontend owners work in parallel. Frontend builds against mock data until each API is live. Nothing here reopens a locked decision in `PLAN.md`; the two items in §2 were approved by the team on 2026-11-13.

## 1. Who does what, and what is next

| Owner | Role | Done so far | Next, in order | Done when |
|---|---|---|---|---|
| **Ayush** | **Backend 1** — pipeline | `types.ts` contract, step 1 modules, `npm run eval` (`rules`/`record`/`calibrate`), `scan-pipeline` + `/api/scan`, `/api/email` (all tested; PLAN §0). **Helping Hands backend (2026-11-14, with Rushil's part):** `help.ts`, `/api/help`, `help_request` wording, `askHelper()` (PLAN §7.3) | 1. Deploy and check Helping Hands on the live URL with two phones (PLAN §10 step 8b). 2. §5 pass bar: still FAIL (2/77 scams `SAFE`, 21.4% genuine above `SAFE`); team to decide whether to keep pushing or accept it for the demo. 3. Step 9 rehearsal | Demo messages 1–3 get the expected verdicts; the §5 pass bar holds on the test split with rules on |
| **Rushil** | **Backend 2** — data + integrations | Mauritius test set (80), `rate-limit`, `whatsapp`, `messages`, `threat-intel`, KB + `rag`, `reports` + `/api/reports`, `/api/coach`, `/api/alert`, `sendAlert()`, live WhatsApp in `text` mode. `help_request` template + `askHelper()` done by Ayush on 2026-11-14 | Submit `help_request` to Meta (`docs/WHATSAPP-TEMPLATES.md` §3); make sure the helper phone messages the business number within 24 h of the demo. | Step 2 criterion met; a third distinct reporter lifts a domain to `HIGH_RISK`; `hello_world` arrives in test mode |
| **Jasveer** | **Frontend 1** — Scan + Email | Pulled Tranco top-1M + URLhaus lists (`feature-jasveer`) | 1. **Do not merge `feature-jasveer` into `main`** (see below); reset it to `main`. 2. Scan screen against mocks, every state: loading, `SAFE` ("No known scam signs found"), `SUSPICIOUS`, `HIGH_RISK`, clarify question, 400 / 429 / 502. 3. Verdict card, flags, advice, action links, **Warn family**. 4. Email Guard screen + quarantine card. 5. **Helping Hands** (PLAN §7.3): **Ask <helper> to check** on the scan result via `askHelper()`, waiting state + polling + "<helper> says: …"; the **Helper** tab (enter code → verdict card → three answers) | A phone-width browser shows every verdict, the clarify question and errors; links open; a code typed on a second phone shows that message and the answer comes back |
| **Anjali** | **Frontend 2** — Coach + Feed | — | 1. `src/shared/coach.ts` + `coach.test.ts` (test-first: the five PLAN §4 cutoff cases + 12 call scenarios). 2. Coach flow, HANG UP screen, trusted-contact settings. 3. Shared `sendAlert()` with the `wa.me` fallback. 4. Feed screen + report form against mocks. 5. **Helping Hands** (PLAN §7.3): first-launch role choice ("I need help" / "I'm helping someone"), helper setup on the elder's phone (helper's name + number, elder's name) and **Elder mode** (huge text, Scan + Coach only); Coach button reads **Alert <helper>** | The fake-police scenario reaches HANG UP with the network off; a helper can set up Elder mode in under a minute |

**About Jasveer's URL lists (checked 2026-11-13).** Useful, but not as raw files in git:
- Together they are about 60 MB (Tranco 21 MB, URLhaus 38 MB). Windows Defender quarantines files that list live malware hosts, so they would break teammates' checkouts.
- **URLhaus dump** (169k URLs): 99.99% `malware_download`, 16,343 of 18,530 hosts are raw IPs, and there are no `.mu` hosts. It is not a scam/phishing feed, so it is **not a verdict input**; the live URLhaus host lookup (D6) stays. It did expose a real bug: github.com, gitlab.com, discord.com, pastebin.com and similar platforms appear in it, so a host-level hit would rate every GitHub link `HIGH_RISK`. Fix: the `SHARED_HOSTS` rule in PLAN §3.2.
- **Tranco top-1M**: not a signal, because `ceb.mu` is not in it, so "unranked" would flag the genuine CEB demo message, and popularity can never lower risk. It is good **evaluation** data: popular domains that merely contain a brand token are the false-positive traps for the lookalike rule.
- **What landed instead** (on `features-Ayush`): `npm run build-url-data` reads the raw files from `data/raw/` (gitignored) and writes `data/eval/domains.jsonl` (199 good, 100 bad and defanged, about 20 KB). It also prints the shared-platform candidates that seeded `SHARED_HOSTS`. To rebuild: `git show origin/feature-jasveer:docs/good_url.csv > data/raw/tranco.csv` and the same for `urlhaus.csv`.

## 2. Team sign-off (approved 2026-11-13)

1. **Calibrated Jev cutoffs** replace the fixed 0.6 / 0.85: they are now 0.30 / 0.72 (PLAN §3.6, `src/lib/calibration.json`). Claude `HIGH_RISK` stays fully trusted (96% precise). Re-check after the pipeline lands.
2. **`SHARED_HOSTS`** (PLAN §3.2): a URLhaus or VirusTotal hit on a shared platform counts as `SUSPICIOUS`, never `HIGH_RISK`, and community reports never count there.

Work on one branch per step, open a PR to `main` and let CI (lint + typecheck + `npm test`) pass before merging. Run `npm test` before every PR.

## 3. API contract (frontend ↔ backend)

Backend 1 makes these the real types in `src/shared/types.ts`. Any change is announced in the team chat before it merges. Every error is `{ error: string }` with status 400 (bad input), 429 (rate limit) or 502 (upstream down); `/api/help` adds 404 (code expired or unknown) and 409 (already answered).

| Route | Request | Response |
|---|---|---|
| `POST /api/scan` | `{ text, sender? }` | `ScanResult` (PLAN §3.5): `{ verdict, flags[], advice, scamType, clarify?, evidence, metadata }` |
| `POST /api/email` | `{ raw }` (headers or `.eml`, ≤ 100 KB) | `ScanResult & { importance: "URGENT" \| "ROUTINE" \| "PROMOTIONAL" }` |
| `POST /api/coach` | `{ text }` | `{ score }` (0–1; the screen takes the max with its own score) |
| `GET /api/reports` | — | trending: counts by institution and district, top domains, last 7 days |
| `POST /api/reports` | `{ institution, vector, district, domain?, snippet? }` | `{ ok: true }` |
| `POST /api/alert` | `{ template, to, vars }` (`call_alert` or `scam_warning` only) | `{ sent: true }` or `{ sent: false, fallback: "wa.me" }` |
| `POST /api/help` | `{ elderName, to, text, sender?, verdict }` (verdict = what the elder saw) | `{ code, token, sent }`; call it through `askHelper()` in `src/shared/alert.ts` |
| `GET /api/help?code=` | — (helper; 6 digits) | `{ elderName, text, verdict, flags[], advice, reply }` (text redacted; verdict from the server's re-scan, never lower than the elder's) |
| `GET /api/help?token=` | — (elder; poll every 3 s) | `{ reply: null \| "CALL_YOU" \| "DELETE_IT" \| "GENUINE" }` |
| `PUT /api/help` | `{ code, reply }` | `{ ok: true }`; 400 for `GENUINE` on `HIGH_RISK`, 409 if already answered |
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
- Storage: the profile (`role`, `firstName`, `helperName`, `trustedContact`) goes through `src/shared/profile.ts` only (§4.1), never raw `localStorage`. Keep an open help `token` in `localStorage` yourself (in `try/catch`) so a reload keeps polling.
- Helping Hands screens: PLAN §7.3 step by step. Reply labels come from `HELP_REPLY_LABEL` in `src/shared/types.ts`; hide "It's genuine" on `HIGH_RISK`. Poll `GET /api/help?token=` every 3 s and stop on a reply, a 404 or after 30 min.
- Links: `Linking.openURL` from `react-native` for `tel:999`, `https://wa.me/<number>?text=<encoded>` and MAUCORS. A `wa.me` text never contains the scam link.
- The demo is the web PWA. Test in Chrome device mode at 360 × 800. Check that any icon library you use renders on web.

### 4.1 Device profile: `src/shared/profile.ts` (Anjali: setup; Jasveer + Anjali: Scan and Coach read it)

There are no user accounts. Who uses the phone and who their helper is lives in this browser's `localStorage` only. The server receives the helper's number with each send and never stores it (CLAUDE.md). All three functions **never throw**.

```ts
import { loadProfile, saveProfile, clearProfile, type Profile } from '@/shared/profile';

type Profile =
  | { role: 'helper' }                                    // the helper's own phone: nothing else is needed
  | { role: 'elder'; firstName: string; helperName: string; trustedContact: string }; // trustedContact = E.164 digits

loadProfile(): Profile | null           // null → show the first-launch role choice
saveProfile(form): { ok: true; profile } | { ok: false; field?: 'role' | 'firstName' | 'helperName' | 'trustedContact'; error: string }
clearProfile(): void                    // "Change setup" in a settings corner
```

**First launch (no profile)**: two huge buttons, one decision.
- **"I'm helping someone"** → `saveProfile({ role: 'helper' })` → normal app plus the Helper tab (enter a 6-digit code).
- **"I'm setting this up for someone"** (the helper, holding the elder's phone) → one field per screen: *Your name* (`helperName`), *Your WhatsApp number* (`trustedContact`), *Their first name* (`firstName`). Then `saveProfile({ role: 'elder', firstName, helperName, trustedContact })` → Elder mode (PLAN §7.3 step 1).

**Saving the form**
- Pass the raw text the person typed. `saveProfile` trims names and turns the number into digits: `5712 3456`, `+230 5712 3456` and `00230 5712 3456` all become `23057123456`; `+44 (0)7700 900123` becomes `447700900123`.
- On `ok: false`, show `error` under the input named by `field` and keep what they typed. No `field` means the phone refused to save (private browsing): show `error` at the top.
- Names: 1–30 characters; no digits, links or line breaks. Hyphens, apostrophes, accents and spaces are fine (`Marie-Claire`, `D'Souza`, `Zoë`). These rules match what WhatsApp sends accept, so a name that saves is a name that sends.
- After saving, show the number back in a readable form (`+230 5712 3456`) and ask "Is this right?", with **Yes** / **Change**. A wrong digit means the elder's alerts go to a stranger.

**Using it**
- Read it with `loadProfile()` when the screen opens; don't copy it into global state that can go stale after "Change setup".
- Scan "Ask my helper": `askHelper({ elderName: p.firstName, to: p.trustedContact, text, sender, verdict })`. The button label is `Ask ${p.helperName} to check`.
- Coach HANG UP "Alert helper": `sendAlert({ template: 'call_alert', to: p.trustedContact, vars: [p.firstName, flag] })`.
- `tel:` button: `tel:+${p.trustedContact}`.
- If `loadProfile()` returns `null` or `{ role: 'helper' }`, hide every "Ask / Alert / Call helper" button. Never show a button that cannot work.

**Don'ts**
- Never send the profile anywhere except as `to` / `elderName` in those two calls. Never log it or put it in a URL other than `wa.me` / `tel:`.
- Never read or write the `scamshield.profile` key directly. A hand-edited or corrupt value comes back as `null` from `loadProfile`, which is what you want.

**Limits to say out loud in the demo**: clearing browser data, or a new phone, means setting up again; "Add to Home Screen" keeps iOS from clearing it. Syncing across phones is what accounts would add (next).

Mocks: `saveProfile` takes an optional second argument, a storage object `{ getItem, setItem, removeItem }`, so a screen test or Storybook can pass an in-memory one. See `src/shared/profile.test.ts`.

## 5. Backend datasets, by priority

Nothing here trains a model. The data is an **evaluation set**: it checks the regexes and rules, calibrates `RAG_MATCH_THRESHOLD` (starts at 0.55) and **calibrates model routing** (PLAN §3.6): Jev cutoffs and signal weights, and how far a Claude verdict may raise the level, come from measured AUC and precision. Coach cutoffs stay fixed.

| Priority | Dataset | What it tests | Size to use | How to get it |
|---|---|---|---|---|
| **1 — must have** | **Mauritius test set, hand-built** | Every rule, redaction, lookalikes, the demo script, the KB | 80 messages: 50 scams covering the 10 patterns in PLAN §8, 30 genuine (CEB outage notice, bank transaction SMS, Mauritius Post delivery, MRA reminder, family chat) | Collect from MAUCORS phishing/scam pages, Police and bank fraud warnings, local news. Replace every real phone number, name and account number with fake ones of the **same format**, so redaction is still tested |
| **done** | **DIFrauD** (MIT, LREC-COLING 2024; Cleanlab-cleaned, hand-curated labels): SMS (UCI spam + Mishra & Soni smishing), email phishing, job scams | Model calibration (PLAN §3.6) | 360 messages: 30 scam + 30 genuine per domain, their validation split → our `dev`, their test split → our `test` | `npm run fetch-data` → `data/eval/messages.jsonl` (binary `label`: `scam` / `genuine`). Note: its SMS "deceptive" class includes marketing spam |
| covered | Mishra & Soni SMS phishing set (ham / spam / smishing) | — | — | Already inside DIFrauD's SMS domain (cleaned). Fetch the original only if the rules need more smishing than DIFrauD's 60 SMS scams |
| **done** | Domain lists: Tranco top sites (good) + URLhaus online hosts (bad), from Jasveer's dumps | Lookalike rule false positives; step 2 intel criterion; seeded `SHARED_HOSTS` | `data/eval/domains.jsonl`: top-100 + 99 brand-token traps (good), 100 named online hosts (bad, defanged `[.]`) | `npm run build-url-data` from `data/raw/` (gitignored); see §1 |
| **4** | Email headers, hand-made | D14 rules: `dmarc=fail`, Reply-To mismatch, display-name spoofing | 5 spoofed + 5 real newsletters | Team inboxes ("Show original", headers only, addresses redacted). The SpamAssassin corpus is from 2002–2005, before DMARC existed, so it can only test parsing |
| **5** | Coach call scenarios, hand-written | Coach scoring + short-circuit | 12 answer lists | Write from Police scam-call warnings; they live in `coach.test.ts` |
| skip | UCI SMS Spam Collection | — | — | 2011 UK/Singapore marketing spam, not scams. The Mishra & Soni set already covers ordinary SMS |

**Test set format:** `data/eval/messages.jsonl`, one line per message:
`{ "id", "text", "sender"?, "channel": "SMS|WHATSAPP|EMAIL|WEB", "label": "scam|genuine", "split": "dev|test", "institution"?, "expected"?: "SAFE|SUSPICIOUS|HIGH_RISK", "mustFlag"?: [...], "source": "<url>" }`.
`label` and `split` are required (calibration is binary). Hand-built Mauritius messages also carry `institution` and `expected`; alternate them between `dev` and `test`. Use `id` prefix `mu-`.

**Eval runner** (`npm run eval`, Backend 1). Built: `record` (live Jev + Claude, redacted, resumable) and `calibrate` (offline: fits `src/lib/calibration.json` on `dev` SMS + email, reports on `test`). Also built: `rules` (offline, no keys, CI-safe): the rule-floor table (3 × 3 once rows carry `expected`), the misses, the genuine messages the rules alone lift above `SAFE`, and the lookalike false positives on `domains.jsonl` (exit code 1 if any).

**Proposed pass bar:** no scam rated `SAFE` (the miss that hurts an elder), and fewer than 10% of genuine messages above `SAFE`.
**Where we are (2026-11-13, models only, no rules yet, test split SMS + email):** 2/60 scams `SAFE` (both email phishing), 18% of genuine messages above `SAFE`. The rules must close the recall gap; the false alarms come mostly from Claude `SUSPICIOUS` calls (81% precise), so watch them when the real evidence goes into the prompt.

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
