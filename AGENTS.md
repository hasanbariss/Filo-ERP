# Baris.Flow Drive Repository Rules

- This repository contains a working production application. Preserve existing behavior.
- Make only the minimum change required; avoid large refactors.
- Do not change the Supabase schema without explicit authorization.
- Do not create migrations that delete data.
- Do not change authentication or API behavior without explicit authorization.
- `www/` is generated output. Edit root source files and regenerate it with `scripts/prepare-ios.mjs` when needed.
- The root project is the single source of truth; do not add nested project copies.
- `main` is the production branch. Active development happens on `develop`.
- Use `feature/*` for features and `fix/*` for fixes.
- Keep design-only changes separate from business-logic changes.
- Run the relevant checks after every change.
- Do not rewrite large files merely to make them look cleaner.
- Do not attempt to remove all `window.*` bridges in one broad refactor.
- Preserve working technical identifiers (database names, API names, storage keys, Capacitor app ID, iOS bundle ID, Electron app ID, and migration names) unless a dedicated migration is authorized.
