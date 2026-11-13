# Powered to Protect — Scam Shield Mauritius

Mobile-first [Expo](https://expo.dev) (SDK 58) PWA that helps everyday Mauritians, especially elderly people, spot scams. The demo target is the web PWA on EAS Hosting (https://scamguard.expo.app). Rules and plan: [CLAUDE.md](CLAUDE.md), [docs/PLAN.md](docs/PLAN.md); who does what: [docs/TEAM-PLAN.md](docs/TEAM-PLAN.md).

## Quick start

```bash
npm install
npm start          # scan the QR code with Expo Go, or press w for web
```

| Command | What it does |
| --- | --- |
| `npm start` | Dev server (Android via Expo Go, web in browser) |
| `npm run web` | Dev server, open in browser |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm test` | Node-assert self-checks for the pure modules in `src/lib/` and `src/shared/` |
| `npm run fetch-data` | Rebuild `data/eval/messages.jsonl` from DIFrauD |
| `npm run build-url-data` | Rebuild `data/eval/domains.jsonl` from the raw lists in `data/raw/` (gitignored) |
| `npm run eval -- record` | Run Jev + Claude on the eval set (paid; needs `.env`) |
| `npm run eval -- calibrate` | Refit `src/lib/calibration.json` offline and print the report |
| `npx expo export -p web` | Build the PWA into `dist/` (deploy as a static site) |
| `npx eas-cli@latest build -p android --profile preview` | Build a shareable APK on EAS |

## Project layout

```
src/app/         screens + API routes (file-based routing; every file is a route)
src/components/  shared UI
src/lib/         server-only logic (may read secrets): pipeline, models, calibration
src/shared/      client-safe logic and types (screens import only from here)
data/eval/       labelled eval sets + recorded model runs
scripts/         data, eval and setup scripts
public/          static web files (PWA manifest, icons)
```

## Team

See [CONTRIBUTING.md](CONTRIBUTING.md) for the branch / PR workflow.
