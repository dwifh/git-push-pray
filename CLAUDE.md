# Powered to Protect — Scam Shield Mauritius (Hackathon Prototype)

Mobile-first Expo PWA that protects everyday Mauritians, especially elderly people, from scams, phishing and social engineering. Theme: "Powered to Protect". Hackathon is time-boxed: lean, YAGNI, demo-ready, zero crashes, every external call degrades gracefully.

**Read `docs/PLAN.md` before writing any feature code.** It holds the locked decisions, the module map, the verdict rules and the ordered build steps. Port reusable code from `docs/PORTED-CODE.md` rather than rewriting it.

## Stack
- Expo + React Native + Expo Router, `web.output: "server"`. **Demo target is the web PWA only**, deployed on EAS Hosting (Cloudflare Workers runtime: no filesystem writes, no native Node modules, use `fetch` + Web Crypto).
- Backend: Expo Router API routes `src/app/api/*+api.ts`.
- LLMs and embeddings via OpenRouter (`openai` SDK + raw `fetch`). Persistence: Turso (`@libsql/client/web`) with in-memory fallback.

## Features (depth is deliberate)
1. **Scam Shield** (deep): paste a message (+ optional sender) in the PWA → verdict `SAFE | SUSPICIOUS | HIGH_RISK` + plain-English red flags + one-tap actions.
2. **Elder Call Coach** (deep): big-button yes/no questions scored on-device; "HANG UP NOW — THIS IS A SCAM" screen; alert the trusted contact on WhatsApp.

**Helping Hands** (hackathon twist, PLAN §7.3, D16): the trusted contact is the **Helper**. One app, two roles: the helper sets up the elder's phone (Elder mode), the elder taps "Ask my helper" on a scan result, the helper enters the WhatsApp'd 6-digit code on their own phone, sees the redacted message + verdict and answers; the answer shows on the elder's screen (`/api/help`). The server re-scans and keeps the higher verdict; the helper's answer never changes the verdict.

**WhatsApp is outbound only**: the server sends approved message templates through the Meta Graph API (`/api/alert`, and `/api/help` for `help_request`) to the user's trusted contact. There is no webhook and no inbound WhatsApp scanning.
3. **Scam Feed** (shallow): ranked list/bars of active campaigns by institution and district; rate-limited anonymous reports.
4. **Email Guard** (shallow): paste raw headers/`.eml` → importance (`URGENT | ROUTINE | PROMOTIONAL`) + phishing verdict + human-in-the-loop review card.

Out of scope, mention only as "next": inbound WhatsApp (webhook) scanning, SMS interception, native share-sheet, native builds, IMAP/Gmail OAuth, live call audio, user accounts.

## Pipeline — `runScanPipeline()` in `src/lib/scan-pipeline.ts`
Shared by `/api/scan` and `/api/email`. Order is fixed:
1. **Redact** PII (`src/lib/redact.ts`) — everything downstream sees redacted text only.
2. **Extract + rules**: URLs → registrable domains; deterministic red-flag rules; lookalike-domain check against the official allowlist.
3. **Evidence** in parallel, each with a 3s timeout and an `unknown` result on failure: VirusTotal domain lookup, URLhaus host lookup, community reports for the domain, RAG top matches.
4. **Tier 1 — Jev** (`typesafe/jev-1.13`, OpenRouter Decisions API): scam-signal probabilities → noisy-OR score; clarifier (`isFragment`, `missingField: sender | link | full_text | none`). Clarify only when the rule floor is below `HIGH_RISK`; a clear scam is never stalled by a question.
5. **Tier 3 — Claude** (`~anthropic/claude-sonnet-latest`): one call, strict JSON schema, **no tools**, untrusted text passed as data.
6. **Verdict = max(rule floor, `jevLevel`, `claudeLevel`)** (`src/lib/verdict.ts`). Every input can only raise risk. Claude/Jev failure → verdict from what succeeded.

**Calibrated routing (PLAN §3.6).** Jev cutoffs and signal weights, and whether a Claude `HIGH_RISK` counts as `HIGH_RISK` or only `SUSPICIOUS`, come from measured ROC-AUC and precision on a labelled dataset (`src/lib/calibration.json`, loaded through `loadCalibration`), never from the model's own word. A model can be demoted, never silenced: calibration must never let a model's `SUSPICIOUS` or `HIGH_RISK` end up `SAFE`. Re-run `npm run eval -- record` and `-- calibrate` whenever the Jev questions, the Claude prompt or model, or the dataset changes.

There is no Tier 2 and no tool loop. Nemotron/flint and the old emergency-safety agent are removed.

## Security rules (non-negotiable)
- **Monotonic verdict**: untrusted content can raise risk, never lower it. Code owns the floor; models only add.
- **Redact before egress**: no raw message, email body, phone number, card/account number, NIC or OTP reaches an LLM, a log, or the Feed. Raw text is never logged.
- **Never fetch untrusted URLs** (no previews, no redirect expansion, no HEAD). Threat intel is looked up by domain only; full URLs are never submitted to VirusTotal.
- **Allowlisted official domains**, known URL shorteners and `SHARED_HOSTS` (github.com, drive.google.com, …; PLAN §3.2) can never be flagged by community reports. A threat-intel hit on a `SHARED_HOSTS` host caps at `SUSPICIOUS`; per-tenant subdomains (`x.workers.dev`, `x.pages.dev`) are not shared.
- **No raw datasets or malware lists in git.** Raw downloads live in `data/raw/` (gitignored); commit only small derived files. Malicious domains in committed files are defanged (`evil[.]com`), because Windows Defender quarantines plain malware host lists.
- Secrets (`OPENROUTER_API_KEY`, `VIRUSTOTAL_API_KEY`, `URLHAUS_AUTH_KEY`, `WHATSAPP_TOKEN`, `WHATSAPP_APP_SECRET`, `TURSO_*`, `HASH_SALT`) live only in `src/lib/` (server-only) and EAS env; nothing secret in `EXPO_PUBLIC_*`. Client-safe shared logic lives in `src/shared/`.
- Every API route (except the static `/api/health` liveness probe, which has no input): rate limit (`ALERTS_RATE_LIMIT_PER_USER_PER_MINUTE`, `ALERTS_RATE_LIMIT_GLOBAL_PER_MINUTE`) → validate input (type, length) → try/catch with a friendly error.
- WhatsApp sends: only approved templates by name from a server-side allowlist; every Graph API call carries `appsecret_proof` (HMAC-SHA256 of `WHATSAPP_TOKEN` keyed with `WHATSAPP_APP_SECRET`); template variables are redacted, single-line, length-capped and **never contain a URL** (we never spread a scam link). Strict per-IP rate limit on `/api/alert`.
- The trusted contact number lives in device `localStorage`; the server receives it per request to send, and never stores or logs it.
- Help requests (`help_requests` table) hold only redacted text, expire after 30 minutes and take one reply; a helper can never mark a `HIGH_RISK` message "genuine". `help_request` is sent only by `/api/help` with a server-made code (`/api/alert` refuses it).
- Every WhatsApp send has a device-side fallback (`wa.me` pre-filled link). Other actions are links too (`tel:`, MAUCORS URL).

## UX rules
- `SAFE` is worded "No known scam signs found", never "This is safe".
- Elder-first: large text, high contrast, one decision per screen, big tap targets.
- English only.

## Deploy (EAS Hosting)
- `npx expo export -p web` then `npx eas-cli@latest deploy --prod --environment production` → https://scamguard.expo.app.
- Server env comes from EAS at deploy time, not from `.env`. After changing a key: `npx eas-cli@latest env:set --name K --value V --environment production --visibility sensitive --non-interactive` (no `--force` flag), then redeploy. Hosting cannot read `secret` visibility; use `sensitive`. Never print env values.
- EAS login from this terminal: `eas login --device --non-interactive` (interactive prompts fail here).
- Tabs come from `expo-router/js-tabs`; importing `Tabs` from `expo-router` is deprecated.

## Workflow
- Docs: `docs/PLAN.md` (§0 status, decisions, build order), `docs/PORTED-CODE.md`, `docs/TEAM-PLAN.md` (who owns what, API contract, datasets), `docs/WHATSAPP-TEMPLATES.md`.
- Owners (TEAM-PLAN §1): Ayush = Backend 1 (pipeline), Rushil = Backend 2 (data + integrations), Jasveer = Frontend 1 (Scan + Email), Anjali = Frontend 2 (Coach + Feed).
- Data: `npm run fetch-data` (DIFrauD → `data/eval/messages.jsonl`), `npm run build-url-data` (`data/raw/` → `data/eval/domains.jsonl`), `npm run eval -- record [limit]` (paid: Jev + Claude) and `-- calibrate` (offline). Eval messages need `label` (`scam` / `genuine`) and `split` (`dev` / `test`).
- Work one PLAN §10 step at a time. At the end of each step, show that its *Done when* criterion is met, update PLAN §0, and wait for the go-ahead.
- Ponytail (minimal diffs). `/tdd` for every pure module in `src/lib/` and `src/shared/`. `npm test` runs the node-assert self-checks (append each new `*.test.ts` to the `test` script). `/ponytail-review` before the demo.
- Edit `data/knowledge-base.json`, then `npm run seed` to regenerate `data/knowledge-vectors.json`.
- Knowledge-base content and allowlisted domains are unverified until a teammate checks them against official sources; never present them as official.
