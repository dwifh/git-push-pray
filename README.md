# Hackathon App

Mobile-first app built with [Expo](https://expo.dev) (SDK 58). It ships as an **Android APK** and an installable **PWA** from one codebase.

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
| `npx expo export -p web` | Build the PWA into `dist/` (deploy as a static site) |
| `npx eas-cli@latest build -p android --profile preview` | Build a shareable APK on EAS |

## Project layout

```
src/app/         screens (file-based routing; every file is a route)
src/components/  shared UI
src/hooks/       shared hooks
src/constants/   theme & constants
public/          static web files (PWA manifest, icons)
```

## Team

See [CONTRIBUTING.md](CONTRIBUTING.md) for the branch / PR workflow.
