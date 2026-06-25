# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

CampaignSync — a full-stack MVP for tracking mock international media (out-of-home / OOH) campaigns. There is no real external data: a behavior-based simulation engine generates all clients, campaigns, lifecycle events and daily metrics locally.

## Commands

```bash
npm install            # install deps
npm run dev            # Vite frontend on 127.0.0.1:5173
npm run api            # Express API on 127.0.0.1:4000 (separate terminal)
npm run build          # tsc -b && vite build (also the only typecheck step)
npm run db:migrate     # apply server/schema.sql (idempotent, CREATE IF NOT EXISTS)
npm run db:seed        # migrate + TRUNCATE + reseed; optional count arg: npm run db:seed -- 40
```

There is no test runner and no linter configured. `npm run build` is the only verification gate — run it to typecheck. The frontend and API are independent processes; both must run for the connected experience.

## Database setup

Requires a local PostgreSQL DB named `campaign_tracker`. Copy `.env.example` to `.env` and set `DATABASE_URL` (note: `.env.example` ships a non-default user `idil@localhost` — `server/db.js` falls back to `postgres://postgres:postgres@localhost:5432/campaign_tracker` if unset). Run `db:migrate` then `db:seed`.

## Architecture

Three layers, with a deliberate **offline-degradation design**: the frontend works fully without the API.

- **Frontend** ([src/App.tsx](src/App.tsx)) — a single ~1000-line React 19 component. No router, no component library, no state management lib. On mount it probes `GET /api/campaigns`; success → `apiStatus="connected"`, failure → `"offline"`. Every mutation (create/edit/complete/delete/regenerate) branches on `apiStatus`: connected calls the API then refetches via `loadFromApi()`; offline mutates local React state. Campaigns are mirrored to `localStorage` (key `internationalCampaignTrackerTsx`) on every change, and seeded from `sampleCampaigns` when no API and no saved state.

- **API** ([server/index.js](server/index.js)) — Express 5, plain JS ESM (the `server/` tree is JS, not TS, and excluded from tsconfig). All campaign reads go through `campaignListSql()`, a CTE that aggregates `daily_metrics` and `simulation_events` per campaign. `mapCampaignRow()` is the boundary translator: it converts snake_case DB rows to the camelCase shape the frontend `Campaign` type expects, derives `status` via `calculateLifecycleStatus`, and computes `roas`. Multi-table writes use `withTransaction` from [server/db.js](server/db.js).

- **Simulation engine** ([server/simulation.js](server/simulation.js)) — pure, no DB. `generateDummyData()` builds clients/campaigns/metrics/events from behavior profiles (Steady/Seasonal/Volatile/Premium) that drive volume, CTR, conversion, volatility and approval risk. Shared by both `db:seed` and the `POST /api/simulation/regenerate` endpoint.

## Critical invariants

- **Status logic is duplicated** and must stay in sync: `calculateLifecycleStatus` in [server/simulation.js](server/simulation.js) and `getCampaignStatus` in [src/App.tsx](src/App.tsx) implement the same rules (Complete / Overdue / At Risk / On Track based on the three workflow statuses + days-to-artwork-deadline). Change both together.

- **Workflow → status coupling:** a campaign is `Complete` only when `copyStatus="Approved"` AND `productionStatus="Complete"` AND `reportStatus="Complete"`. "Mark complete" sets all three. Overdue/At Risk only trigger while copy is unapproved.

- **camelCase ↔ snake_case:** the DB and SQL use snake_case; the frontend and simulation objects use camelCase. `mapCampaignRow()` is the single conversion point on read — preserve it when adding fields. `findOrCreateClient()` resolves a client by name on every create/update.

- The regenerate endpoint and seed both `TRUNCATE simulation_events, daily_metrics, campaigns, clients RESTART IDENTITY` — they are destructive full resets, not incremental.
