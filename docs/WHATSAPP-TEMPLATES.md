# WhatsApp Templates — submission spec

Outbound only (D3). Three templates: `call_alert`, `scam_warning` and `help_request` (§3, Helping Hands). Submit the first two now in Meta Business Manager → WhatsApp Manager → Message templates → Create. **Submit `call_alert` first**: it drives the Coach "HANG UP" demo moment and is the clearest safety use case. Submit `scam_warning` straight after; approval runs in parallel with the build.

Until both are approved, `WHATSAPP_TEMPLATE_MODE=test` routes every alert to Meta's `hello_world`, and `WHATSAPP_TEMPLATE_MODE=text` sends our exact wording as a plain message (it only arrives if the recipient messaged the number in the last 24 h). The wording lives in `src/shared/messages.ts`; change it there and here together.

## Rules both templates follow
- **Category `UTILITY`.** Meta's categorization page allows utility when a template is non-promotional and either "specific to or requested by the user" or "essential or critical to the user (for example, to ensure user safety)". Both templates are safety alerts that the user set up by naming a trusted contact. Nothing in them sells, invites or persuades. Since 9 April 2025 Meta approves a misjudged utility template as `MARKETING` instead of rejecting it, and it can recategorise later with 1 day's notice. If that happens, the template still sends, at marketing price. Do not reword it towards promotion to "fix" that.
- **Language: English, code `en`.** Pick "English", not "English (US)": the send payload uses `language.code = "en"` and must match.
- **Positional variables** (`{{1}}`, `{{2}}`, …), each used **once**. A body never starts or ends with a variable, and no two variables sit next to each other.
- **No URLs, no buttons, no emojis.** A plain-text header and footer with no variables.
- **Limits:** header ≤ 60 chars, body ≤ 1024 chars, footer ≤ 60 chars, name lowercase + underscores.
- **Variable values at send time** must be single-line, contain no URL or domain-like token, and stay within the max length below. `whatsapp.ts` enforces this (D15).

---

## 1. `call_alert` (sent by the Coach HANG UP screen)

| Field | Value |
|---|---|
| Name | `call_alert` |
| Category | `UTILITY` |
| Language | English (`en`) |
| Header | Text: `Scam call alert` |
| Footer | `Scam Shield Mauritius safety alert` |
| Buttons | None |

**Body** (paste exactly):
```
Safety alert: {{1}} may be on a scam phone call right now. The warning sign we found: {{2}}.

Please call them now and tell them to hang up. Remind them never to share an OTP, PIN or password with a caller and never to send money because a caller asks.

You are receiving this because they chose you as their trusted contact in Scam Shield.
```

| Variable | Meaning | Sample value for Meta | Max length |
|---|---|---|---|
| `{{1}}` | User's first name | `Asha` | 30 |
| `{{2}}` | Top red flag, plain words | `the caller asked for an OTP code` | 80 |

`{{2}}` always comes from this fixed list, keyed by the Coach question with the highest weighted answer. It never contains user text:

| Coach question | `{{2}}` |
|---|---|
| 1 OTP / PIN / password | `the caller asked for an OTP, PIN or password` |
| 2 pay / move money | `the caller asked for money to be paid or moved now` |
| 3 Police / bank / government | `the caller claimed to be Police, a bank or a government office` |
| 4 rushing / secrecy | `the caller was rushing them and asking for secrecy` |
| 5 family in trouble | `the caller said a family member is in trouble` |
| 6 install app / open link | `the caller asked them to install an app or open a link` |

Why the plan's wording changed: the plan says "asks them to call `{{1}}`". The body says "call them" so that `{{1}}` appears only once. A repeated positional variable is a common rejection cause.

---

## 2. `scam_warning` (sent by "Warn family" on a scan result)

| Field | Value |
|---|---|
| Name | `scam_warning` |
| Category | `UTILITY` |
| Language | English (`en`) |
| Header | Text: `Scam warning` |
| Footer | `Scam Shield Mauritius safety alert` |
| Buttons | None |

**Body** (paste exactly):
```
Hello, this is a scam warning for the family of {{1}}. They received a message pretending to be from {{2}}, and Scam Shield rated it {{3}}.

If you get a similar message, do not click its links and never share OTP codes, PINs or passwords. If in doubt, call the organisation on the number printed on your card or bill.

You are receiving this because they chose you as their trusted contact in Scam Shield.
```

| Variable | Meaning | Sample value for Meta | Max length |
|---|---|---|---|
| `{{1}}` | User's first name | `Asha` | 30 |
| `{{2}}` | Institution being impersonated | `MCB` | 40 |
| `{{3}}` | Verdict | `high risk` | 20 |

`{{2}}` display names are a fixed map from the `institution` enum. None of them contains a dot, so none looks like a domain:
`MCB` → `MCB`, `SBM` → `SBM Bank`, `MAURITIUS_POST` → `Mauritius Post`, `CEB` → `CEB`, `CWA` → `CWA`, `MRA` → `MRA`, `EMTEL` → `Emtel`, `MYT` → `Mauritius Telecom` (never `my.t`), `POLICE` → `the Police`, `OTHER` → `a well-known organisation`.

`{{3}}` is `high risk` or `suspicious`. The button only appears for verdicts of `SUSPICIOUS` or above, so `SAFE` is never sent.

---

## 3. `help_request` (sent by "Ask my helper" on a scan result, Helping Hands, PLAN §7.3)

Submit third. Production runs `WHATSAPP_TEMPLATE_MODE=text`, so it works before approval inside the 24 h window.

| Field | Value |
|---|---|
| Name | `help_request` |
| Category | `UTILITY` (the user asked for this help; it carries an access code, close to Meta's account-update examples) |
| Language | English (`en`) |
| Header | Text: `Help request` |
| Footer | `Scam Shield Mauritius safety alert` |
| Buttons | None |

**Body** (paste exactly):
```
This is a help request from {{1}}. They would like you to check a message before they reply to it.

Open Scam Shield on your phone, tap Helper and enter this code: {{2}}

The code works for 30 minutes. Never share it with anyone else, and never click links in the message you are checking.

You are receiving this because they chose you as their trusted contact in Scam Shield.
```

| Variable | Meaning | Sample value for Meta | Max length |
|---|---|---|---|
| `{{1}}` | User's first name | `Asha` | 30 |
| `{{2}}` | 6-digit help code, made by the server | `482913` | 6 |

Only `/api/help` sends this template, with a code it made itself; `/api/alert` refuses it (400). No link to the app, on purpose: the message must not teach the helper to tap links in WhatsApp.

---

## Before step 8
- Recipients: test numbers receive messages only if they are on the app's allowed list (max 5). Add the demo phones there.
- Opt-in: Meta's policy expects recipients to agree to receive business messages. For the demo, the trusted contacts are team phones. Treat this as a "next" item for real users (the contact confirms once).
- Graph API version: Meta's current docs show examples up to `v27.0`. Confirm the latest version when you write `whatsapp.ts`.
