# Baris.Flow Repository Rules

- The primary brand is Baris.Flow; the current fleet product name is Baris.Flow Drive.
- This repository contains a working production application. Preserve existing behavior.
- `main` is the only active branch. Local development and testing happen directly on `main`.
- Push ready commits to `origin/main`; each push triggers the Vercel production deployment.
- Do not create `develop`, `feature/*`, or other branches unless the user explicitly changes this workflow.
- Make only the minimum change required; avoid large refactors.
- Do not change the Supabase schema without explicit authorization.
- Do not create migrations that delete data.
- Do not change authentication or API behavior without explicit authorization.
- `www/` is generated output. Edit root source files and regenerate it with `scripts/prepare-ios.mjs` when needed.
- The root project is the single source of truth; do not add nested project copies.
- Do not use old duplicate folders as active source code.
- Keep design-only changes separate from business-logic changes.
- Run the relevant checks after every change.
- Do not rewrite large files merely to make them look cleaner.
- Do not attempt to remove all `window.*` bridges in one broad refactor.
- Preserve working technical identifiers (database names, API names, storage keys, Capacitor app ID, iOS bundle ID, Electron app ID, and migration names) unless a dedicated migration is authorized.
