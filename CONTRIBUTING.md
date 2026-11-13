# Contributing

## Workflow

1. **Pick or open an issue** and assign yourself, so two people don't build the same thing.
2. **Branch off `main`**: `git switch -c feat/<short-name>` (or `fix/`, `chore/`, `docs/`).
3. **Commit small and often** using [Conventional Commits](https://www.conventionalcommits.org):
   `feat: add login screen`, `fix: crash on empty list`.
4. **Keep up to date**: `git pull --rebase origin main` before opening a PR.
5. **Open a PR into `main`**, fill in the template, link the issue (`Closes #12`).
6. **Get one approval** from a teammate and a green CI run, then **squash-merge** and delete the branch.

Never push directly to `main`.

## Before you push

```bash
npm run lint
npm run typecheck
```

## Adding packages

Use `npx expo install <pkg>`, not `npm install <pkg>`, so versions match the Expo SDK.
Commit the updated `package-lock.json`.

## Secrets

Never commit API keys. Put them in `.env.local` (git-ignored) using the `EXPO_PUBLIC_` prefix
only for values that are safe to ship in the app bundle.
