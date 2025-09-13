# Obol Vault Economics — Scenario Explorer (Standalone)

A small React app to explore Lido v3 vault economics with Obol DVT. Compare single‑operator and multi‑operator DVT setups, tweak reserve ratio rails, fees and APR assumptions, and visualize outcomes for depositors and operators.

This repo is now a standalone Vite + React + TypeScript app with a GitHub Actions workflow that builds and deploys to GitHub Pages.

## Features

- Compare scenarios side-by-side (1–3 tiles)
- Reserve ratio rails aligned with Lido v3 defaults (editable)
- Fee modeling for infra, reservation, liquidity, and node operator fees
- Obol share carved from NO fees (toggle to waive)
- Reward distribution chart and per-operator revenue
- Deep-link state via `?state=...`
- Export scenarios as CSV/JSON

## Run Locally

- Install: `npm ci` (or `npm install`)
- Dev: `npm run dev`
- Build: `npm run build`
- Preview: `npm run preview`

Open the dev server URL printed by Vite. The app entry is `src/main.tsx` and the main component is `src/VaultEconomicsApp.tsx`.

## Deploy (GitHub Pages)

A workflow is provided at `.github/workflows/deploy.yml`:

- Builds on pushes to `main` (and on manual dispatch)
- Uploads `dist/` as a Pages artifact
- Deploys via `actions/deploy-pages`

One-time repo setup (in GitHub UI):

- Settings → Pages → Build and deployment → Source = “GitHub Actions”

After that, pushing to `main` publishes the site. Vite is configured with `base: './'` for subpath-safe assets.

## Tech

- React + TypeScript + Vite
- Charts: `recharts`
- Icons: `lucide-react`
- Motion: `framer-motion`
- TailwindCSS configured for utility-based styling.

## Source Files

- App component: `src/VaultEconomicsApp.tsx`
- Entry point: `src/main.tsx`
- HTML shell: `index.html`

The app source lives entirely under `src/`.

## Pre-Commit Checklist

- README and workflow present
- `.gitignore` excludes build artifacts and editor files
- No secrets or large assets committed
- `npm run build` succeeds locally

## License

See `LICENSE` for details.
