# AGENTS.md

## Cursor Cloud specific instructions

### Services & how to run them
This repo is one product (the **Errayhany Store** storefront) shipped across web/mobile/desktop, plus an independent **Telegram bot** microservice. For dev in the cloud VM, two services matter:

| Service | Command | Port | Notes |
|---------|---------|------|-------|
| Storefront (React + Vite PWA) | `npm run dev` | 5173 | Add `-- --host 0.0.0.0` to expose. Core product. |
| Telegram bot (Express) | `npm run bot` | 3000 | Optional. `GET /health` and `GET /` respond even without credentials. |

Other scripts are in `package.json` (`build`, `lint`, `preview`, mobile `android:*`/`ios:*`, `desktop`). There is **no `test` script and no automated test framework** — the root `test-*.cjs`/`test-render.js` files are ad-hoc manual scripts, not a suite.

### Lint
`npm run lint` runs ESLint (flat config in `eslint.config.js`). Note: it currently reports pre-existing errors in the repo (unused vars, empty blocks, a react-hooks rule). These are not caused by environment setup.

### Data / secrets (important, non-obvious)
- The storefront has **no backend of its own**: it reads its catalog directly from **NocoDB** and uses **Firebase** (auth/Firestore, config hardcoded in `src/services/firebase.js`) from the browser. Live catalog and order submission require `VITE_NOCODB_*` secrets (see `.env.example`); copy it to `.env` and fill in values.
- Without NocoDB secrets the live catalog is empty. `src/services/api.js` falls back to a **git-ignored `public/catalog-cache.json`** snapshot if present. For offline/dev demos you can generate this fixture from the shipped `public/products-jsonld.json`. With the fixture in place, browse → add-to-cart → cart totals → checkout form all work.
- **Checkout order submission** POSTs to the NocoDB Orders table and will 404/fail without `VITE_NOCODB_URL` / `VITE_NOCODB_ORDERS_TOKEN` / `VITE_NOCODB_TABLE_ORDERS`. This is expected when those secrets are absent, not a code bug.
- The bot needs `TELEGRAM_BOT_TOKEN` + `VITE_NOCODB_*` to actually ingest products; `/health` returns `ok:false` until they are set but the Express server still starts.
