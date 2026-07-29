# StockBTP — Construction Inventory Management PWA

## Project overview

pnpm monorepo with two apps:

- **`artifacts/stock-pwa`** — React + Vite PWA (frontend)
- **`artifacts/api-server`** — Express + Node.js API (backend)

Database: Supabase (Drizzle ORM). Auth: session-based (SESSION_SECRET).

## Deployment stack (do not modify)

- API → **Render** (was Railway, user may have switched)
- Frontend → **Vercel**
- Config files: `vercel.json`, `railway.toml` / `render.yaml`

**Do not migrate to Replit hosting. Do not alter deployment config.**

## Environment variables

- `SUPABASE_DATABASE_URL` — Supabase connection pooler URL (port 6543)
- `SESSION_SECRET` — already set as a Replit secret
- `CORS_ORIGIN` — production frontend URL
- `PORT` — defaults to 8080 for API, 5173 for frontend

## Running locally (dev only)

```bash
bash start.sh
# API on :8080, frontend on :5000
```

Requires `SUPABASE_DATABASE_URL` to be set for the API to function.

## Useful commands

```bash
pnpm db:push      # apply Drizzle schema to Supabase
pnpm db:migrate   # apply production SQL migration
pnpm db:seed      # seed test accounts and demo data
pnpm test         # run all tests
```

## User preferences

- Keep Vercel + Render deployment stack intact — no Replit migration, no changes that break the current stack.
- Changes are code-only; deployment config files are off-limits.
