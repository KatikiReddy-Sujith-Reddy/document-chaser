# Document Chaser

A local prototype for reviewing synthetic onboarding document gaps, preparing a consolidated request, and tracking RM follow-up tasks. The app binds to `127.0.0.1`; it does not send email or make onboarding decisions.

## Requirements

- Node.js 22.12 or later
- npm
- Windows PowerShell

The backend uses Express 5, Drizzle ORM, SQLite, Zod, and the Google GenAI SDK. The frontend uses React, TypeScript, Vite, and locally bundled Geist fonts. Vitest, Supertest, and Testing Library are used for tests.

## Setup

Run these commands from the project root in PowerShell:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }

Push-Location .\backend
npm install
Pop-Location

Push-Location .\frontend
npm install
Pop-Location

Push-Location .\backend
npm run seed
Pop-Location
```

`.env` is ignored by Git. Keep credentials there; do not copy them into frontend files. The backend reads `GEMINI_API_KEY` first and accepts `GOOGLE_API_KEY` as a fallback. If both are empty, drafting uses the deterministic template. `GEMINI_MODEL` is respected when set and otherwise defaults to `gemini-2.5-flash`. The SQLite database is created at `data\chaser.db`; the seed loader restores the three seed cases and clears their prior demo-only drafts, tasks, and events so the walkthrough is repeatable.

Configuration defaults are:

| Variable | Default |
|---|---|
| `DATABASE_URL` | `file:./data/chaser.db` |
| `AS_OF_DATE` | `2026-11-12` |
| `BASELINE_MEDIAN_DAYS` | `17` |
| `BASELINE_ROUNDS` | `3` |
| `PORT` | `8787` |

## Run

Open two PowerShell windows at the project root.

Backend:

```powershell
Set-Location .\backend
npm run dev
```

Frontend:

```powershell
Set-Location .\frontend
npm run dev
```

Open `http://127.0.0.1:5173`. Vite proxies `/api` requests to the backend at `http://127.0.0.1:8787`.

## Demo walkthrough

1. In Case queue, open CS-1041 and choose **Review request**.
2. Generate a draft, choose **Edit**, make a change, and choose **Save edits**.
3. Choose **Approve and send**. The app records approval and the day-0 request handoff, then opens a `mailto:` draft addressed to a synthetic `.test` address. Sending remains a manual action in the user's email client; the app makes no outbound send and cannot verify delivery.
4. Open Follow-up and set the as-of date to `2026-11-13`. CS-1052 was approved on `2026-11-10`, so its day-3 reminder task appears. Re-reading tasks does not create duplicates.
5. Open Metrics to see the 17-day / 3-round baseline and pilot metrics computed from seeded requirements and events.

The **Record a document received** control on Case detail is a synthetic demo control. Follow-up tasks are created when the task list is read. A synthetic client reply can be recorded through `POST /api/demo/cases/:id/reply`; it cancels open tasks and stops subsequent follow-up rules.

The as-of date set through the demo control lives in memory for the current server session and resets on restart.

## Tests and build

```powershell
Push-Location .\backend
npm test
npm run build
Pop-Location

Push-Location .\frontend
npm test
npm run build
npm run check:bundle-secret
Pop-Location
```

The backend tests cover deterministic gap rules, follow-up boundaries and cancellation, median metrics, template/Gemini draft paths with mocked generation, API workflows, task idempotency, and the no-outbound-fetch approval guarantee. The frontend has a smoke test for each screen. The bundle check verifies that the configured Gemini key is absent from `frontend\dist`.

## Scope and design

All case records and document events are synthetic. The UI follows the Stitch obsidian palette, red accents, Geist typography, and responsive spacing. Mockup claims about automatic chasing, automatic sending, document authenticity/fraud decisions, and real-looking branding are intentionally omitted.
