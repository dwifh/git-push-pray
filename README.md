# Powered to Protect — Scam Shield Mauritius

Mobile-first [Expo](https://expo.dev) (SDK 58) PWA that helps everyday Mauritians, especially elderly people, spot scams, phishing and social engineering. Live at https://scamguard.expo.app (EAS Hosting). A sideloaded **ScamGuard Android app** built from the same codebase is planned (PLAN §7.4); it calls the same API.

Rules: [CLAUDE.md](CLAUDE.md). Plan, decisions and current status: [docs/PLAN.md](docs/PLAN.md) (§0). Who owns what and the API contract: [docs/TEAM-PLAN.md](docs/TEAM-PLAN.md).

## The problem

Mauritians get the same scams over and over, for months at a time: "your bank account is blocked, confirm the OTP", "pay a small fee to release your parcel", "your CEB electricity will be cut today", fake police or relatives calling for urgent money. The messages look official, use local brand names and lookalike domains, and push the reader to act *now*. Spam filters miss them, and the people least able to tell a real CEB notice from a fake one are the ones scammers target most. CERT-MU's [MAUCORS](https://maucors.govmu.org/) documents these campaigns, but someone holding a suspicious SMS has no quick way to check it.

## Who it's for

- **The elder**: an older Mauritian with a smartphone who gets a suspicious SMS, WhatsApp, email or phone call. They need one clear answer in large text and one obvious next step, not a security report.
- **The helper**: a son, daughter, grandchild or neighbour who sets up the elder's phone, gets a WhatsApp alert when something looks wrong, and can check a message for the elder from their own phone.
- **Everyone else**: the same scan works for anyone, and the community Feed shows which campaigns are active this week.

## Features

| Feature | What it does | Status |
| --- | --- | --- |
| **Scam Shield** | Paste a message (+ optional sender) → `SAFE` / `SUSPICIOUS` / `HIGH_RISK`, plain-English red flags, one-tap actions | API live (`/api/scan`), screen to do |
| **Elder Call Coach** | Big yes/no questions scored on-device → "HANG UP NOW" screen → alert the helper on WhatsApp | API live (`/api/coach`, `/api/alert`), screen to do |
| **Helping Hands** | The elder taps "Ask my helper"; the helper enters the WhatsApp'd 6-digit code, sees the redacted message + verdict and answers | API live (`/api/help`), screens to do |
| **Scam Feed** | Active campaigns by institution and district; anonymous, rate-limited reports | API live (`/api/reports`), screen to do |
| **Email Guard** | Paste headers / `.eml` → importance (`URGENT` / `ROUTINE` / `PROMOTIONAL`) + phishing verdict | API live (`/api/email`), screen to do |

`SAFE` is always worded "No known scam signs found". WhatsApp is outbound only (no webhook); every send has a `wa.me` fallback link.

## Surprise card: Helping Hands

The twist: *"adapt your app for a situation where one person helps another person use it; show how both people use it."* We made the trusted contact a **Helper**: one app, two roles, two phones ([PLAN §7.3](docs/PLAN.md), D16).

1. **Setup**: on the elder's phone, the helper picks "I'm setting this up for someone", enters their own name and WhatsApp number, and turns on **Elder mode** (extra-large text, only Scan and Coach).
2. **Elder asks**: on any scan result, the elder taps **Ask <helper> to check**. The helper gets a WhatsApp message with a 6-digit code.
3. **Helper checks**: on their own phone, the helper enters the code, sees the redacted message, the verdict and the red flags, and taps one answer: *Don't reply, I'll call you* / *Block it and delete it* / *It's genuine*.
4. **Elder sees the answer** in large text under the verdict.

Safety: the server re-scans the message and keeps the higher verdict, so a tampered `SAFE` never reaches the helper. The helper's answer never changes the verdict, and "It's genuine" is refused on `HIGH_RISK`. Requests hold only redacted text, take one reply and expire after 30 minutes. The helper's number is never stored on the server.

## Stack

- **App**: Expo SDK 58, React Native 0.88, React 19, Expo Router (file-based routes, `web.output: "server"`), TypeScript.
- **Clients**: web PWA (the demo target) plus an Android APK built from the same codebase on EAS (planned).
- **Backend**: Expo Router API routes on **EAS Hosting** (Cloudflare Workers runtime: `fetch` + Web Crypto, no filesystem).
- **Storage**: [Turso](https://turso.tech) (libSQL over HTTP) for community reports and help requests, with an in-memory fallback.
- **Messaging**: Meta WhatsApp Cloud API (outbound only, signed with `appsecret_proof`).
- **Threat intel**: VirusTotal (domain lookup), URLhaus (host lookup), isMalicious (phone reputation).
- **Tests**: plain `node:assert` self-checks run directly by Node 22 (no test framework); GitHub Actions CI runs lint, typecheck, tests and a web export.

## AI tools

**In the product** (all through [OpenRouter](https://openrouter.ai)):

| Model | Used for |
| --- | --- |
| `typesafe/jev-1.13` (Decisions API) | Tier 1: probability for each scam signal (urgency, impersonation, credential request…) → a noisy-OR score; asks a clarifying question when a message is only a fragment; scores the Coach's free text; email importance |
| `~anthropic/claude-sonnet-latest` | Tier 3: one strict-JSON call per scan for the verdict, red flags in plain English, advice and scam type. No tools; the message is passed as untrusted data |
| `openai/text-embedding-3-small` | Embeds the knowledge base of Mauritian scam patterns (`npm run seed`) and each query, for RAG matches |

The models never get the final word. Their cutoffs are calibrated on a labelled set (Jev ROC-AUC 0.96 on 147 dev messages, from [src/lib/calibration.json](src/lib/calibration.json)). Model output is cleaned before it is shown (digit runs and links are stripped from model text), and every model sees redacted text only.

**To build it**: Claude Code agents, steered by [CLAUDE.md](CLAUDE.md) and [AGENTS.md](AGENTS.md), with test-first work on every pure module.

## How a scan works

`runScanPipeline()` in [src/lib/scan-pipeline.ts](src/lib/scan-pipeline.ts), shared by `/api/scan` and `/api/email`:

1. **Redact** PII (phones, cards, NIC, OTP…); everything downstream sees redacted text only.
2. **Rules**: domains, red-flag rules, lookalike check against the official allowlist → the rule floor.
3. **Evidence** in parallel, 3 s timeout each: VirusTotal + URLhaus (by domain only, never the URL), isMalicious (phone numbers), community reports, RAG over [data/knowledge-base.json](data/knowledge-base.json).
4. **Jev** (`typesafe/jev-1.13` via OpenRouter): scam-signal probabilities → score, plus a clarifying question when needed.
5. **Claude** (Sonnet via OpenRouter): one strict-JSON call, no tools, message passed as data.
6. **Verdict = max(rule floor, Jev, Claude)**. Inputs can only raise risk. Model cutoffs come from measured precision on a labelled set ([src/lib/calibration.json](src/lib/calibration.json)), not from the model's word. If a model is down, the verdict comes from what still answered.

## Data sources

Nothing is trained. The data checks the rules and calibrates how much each model is trusted ([TEAM-PLAN §5](docs/TEAM-PLAN.md)).

| Data | Source | Used for |
| --- | --- | --- |
| **Mauritius test set** (80 messages, `mu-001`…`mu-080`: 50 scams, 30 genuine; SMS, email, WhatsApp) | Hand-written by the team from patterns on [MAUCORS](https://maucors.govmu.org/), Police and bank fraud warnings and local news. All names, numbers and domains are fictitious | Rules, redaction, lookalikes, the demo script |
| **DIFrauD** (360 messages: SMS, phishing email, job scams) | [huggingface.co/datasets/difraud/difraud](https://huggingface.co/datasets/difraud/difraud) (MIT, LREC-COLING 2024) | Model calibration (`dev` split) and the held-out report (`test` split) |
| **Domain list** (`data/eval/domains.jsonl`, 299 domains) | [Tranco](https://tranco-list.eu/) top sites (good) + [URLhaus](https://urlhaus.abuse.ch/) online hosts (bad, defanged) | Lookalike false positives, the threat-intel check, the `SHARED_HOSTS` list |
| **Knowledge base** (13 scam patterns, `data/knowledge-base.json`) | Written by the team from MAUCORS and other public warnings, **not yet verified against official sources** | RAG matches during a scan |
| **Live threat intel** | VirusTotal, URLhaus, isMalicious APIs | Per-scan evidence (domains and phone numbers only, never full URLs) |
| **Community reports** | Anonymous user reports in Turso (reporters stored as salted hashes) | Feed trends; a domain with 3 or more distinct reporters → `HIGH_RISK` |

Raw downloads stay in `data/raw/` (gitignored); only small derived files are committed.

Latest held-out result (rules + models, [PLAN §0](docs/PLAN.md), 2026-11-14): 2 of 77 scams rated `SAFE`, and 15 of 70 genuine messages (21%) rated above `SAFE`. Our pass bar is 0 missed scams and under 10% false alarms, so it is **not met yet**.

## API

All routes are Expo Router API routes in [src/app/api/](src/app/api/). Full request/response shapes: [TEAM-PLAN §3](docs/TEAM-PLAN.md). Errors are `{ error }` with 400 / 429 / 502 (`/api/help` adds 404 / 409).

| Route | Purpose |
| --- | --- |
| `POST /api/scan` | Scan a message |
| `POST /api/email` | Scan raw email headers / `.eml` |
| `POST /api/coach` | Score the Coach's free-text "What did they say?" |
| `GET` / `POST /api/reports` | Feed trends / file a report |
| `POST /api/alert` | Send `call_alert` or `scam_warning` on WhatsApp |
| `POST` / `GET` / `PUT /api/help` | Helping Hands: ask, helper view or elder poll, reply |
| `GET /api/health` | Liveness |

Screens should call WhatsApp through `sendAlert()` / `askHelper()` in [src/shared/alert.ts](src/shared/alert.ts) and store the device profile with [src/shared/profile.ts](src/shared/profile.ts).

## Quick start

Requires Node ≥ 22.15.

```bash
npm install
npm run salt           # creates .env if needed and fills HASH_SALT (never prints it)
npm start              # press w for web, or scan the QR code with Expo Go
```

Add the other keys to `.env` from [docs/PLAN.md §9](docs/PLAN.md) (ask a teammate for the values). Missing keys degrade, they don't crash: with no `OPENROUTER_API_KEY` a scan returns the rule verdict, with no `TURSO_*` storage falls back to memory (demo reports pre-filled), and a failed WhatsApp send returns the `wa.me` link. Filing a report needs `HASH_SALT`.

| Command | What it does |
| --- | --- |
| `npm start` / `npm run web` | Dev server (web, or Android via Expo Go) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm test` | Node-assert self-checks for `src/lib/` and `src/shared/` plus the route tests |
| `npm run salt` | Generate `HASH_SALT` in `.env` |
| `npm run seed` | Re-embed `data/knowledge-base.json` → `data/knowledge-vectors.json` (needs `OPENROUTER_API_KEY`) |
| `npm run check-intel -- [n]` | Live VirusTotal/URLhaus check on `n` good + `n` bad domains (free tier: 4/min) |
| `npm run fetch-data` | Rebuild `data/eval/messages.jsonl` from DIFrauD (keeps the `mu-` rows) |
| `npm run build-url-data` | Rebuild `data/eval/domains.jsonl` from the raw lists in `data/raw/` (gitignored) |
| `npm run eval -- record [limit]` | Run the pipeline (live Jev + Claude) on the eval set (paid) |
| `npm run eval -- calibrate` | Refit `src/lib/calibration.json` offline and print the test report |
| `npm run eval -- rules` | Offline rule-floor report + lookalike false positives (no keys) |

Re-run `record` then `calibrate` whenever the Jev questions, the Claude prompt or model, or the dataset changes.

## Deploy

```bash
npx expo export -p web
npx eas-cli@latest deploy --prod --environment production     # → https://scamguard.expo.app
npx eas-cli@latest build -p android --profile preview          # Android APK (cloud build); deploy the web/API first
```

Server env comes from EAS (`production`, visibility `sensitive`), not from `.env`. Change a key with `npx eas-cli@latest env:set --name K --value V --environment production --visibility sensitive --non-interactive`, then redeploy.

## Project layout

```
src/app/          screens (Scan, Coach, Feed, Email tabs) + API routes in src/app/api/
src/lib/          server-only logic (may read secrets): pipeline, rules, models, intel, storage, WhatsApp
src/shared/       client-safe logic and types (screens import only from here)
data/             knowledge base + vectors; data/eval/ labelled sets and recorded model runs
scripts/          data, eval, seeding and setup scripts
docs/             plan, team plan, ported code, WhatsApp templates
public/           static web files (PWA manifest, icon)
```

## Security in one paragraph

PII is redacted before anything reaches an LLM, a log or the Feed; senders and reporters are stored as salted hashes. The server never fetches a URL from a message. Verdicts are monotonic: untrusted content can raise risk, never lower it. Official domains, URL shorteners and shared hosts can't be flagged by community reports. WhatsApp sends use a server-side template allowlist with `appsecret_proof`, and variables never contain a link or a phone number. The helper's number stays on the device. Details: [CLAUDE.md](CLAUDE.md) § Security rules.

## Team

Ayush (backend: pipeline), Rushil (backend: data + integrations), Jasveer (frontend: Scan + Email), Anjali (frontend: Coach + Feed). Branch / PR workflow: [CONTRIBUTING.md](CONTRIBUTING.md). License: [LICENSE](LICENSE).
