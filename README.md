# ReelSwarm

ReelSwarm turns a business website into short-form marketing videos. This repository is configured for a local private beta: React, the Express API, and the BullMQ worker run as npm processes; PostgreSQL and Redis run in Docker Compose.

## Requirements

- Node.js 22 or newer (required by the current Firecrawl SDK)
- npm 10+
- Docker with Compose v2

## Fresh local setup

```bash
npm run setup
npm run dev
```

Open `http://localhost:5173`. The seeded local account defaults to:

- Email: `admin@reelswarm.local`
- Password: `local-admin-password`

Change both values in `backend/.env` before seeding if the machine is shared.

`npm run setup` creates missing environment files (including a random local JWT secret), installs workspace dependencies, starts PostgreSQL and Redis, applies migrations, and seeds the administrator, allowlist, and local creators. Existing environment files are preserved. PostgreSQL and Redis use named volumes, so data survives `infra:down` and subsequent restarts.

If setup reports missing prerequisites, install Node.js 22.13+ and Docker Engine with the Compose plugin first. On Ubuntu, verify them with `node --version` and `docker compose version`.

## Common commands

```bash
npm run infra:up
npm run infra:down
npm run dev
npm run check
npm run db:reset
npm run db:seed
npm run allow-email -- tester@example.com
npm run disallow-email -- tester@example.com
npm run jobs:failed
npm run jobs:retry -- <job-id>
```

`db:reset` deletes local database data, reapplies migrations, and runs the seed. It does not delete Redis; use `docker compose down -v` only when a complete local infrastructure reset is intended.

## Provider modes

`AI_PROVIDER_MODE=mock` is the default. It produces deterministic brand, hook, script, image, and video fixtures and does not call Firecrawl, Hugging Face, RunPod, or Cloudinary. Use this mode for routine development and automated tests.

For live generation, set `AI_PROVIDER_MODE=live` and provide every credential documented in [backend/.env.example](backend/.env.example). Startup fails when a required live credential or the JWT secret is missing.

## Local ports

- Frontend: `5173`
- API: `3000`
- PostgreSQL: `5432`
- Redis: `6379`

Readiness endpoints are `GET /health/live` and `GET /health/ready`.
In development, an admin-only BullMQ dashboard is available at `http://localhost:3000/admin/queues`.

## Security model

- Authentication uses an `HttpOnly`, `SameSite=Lax` cookie.
- Registration is limited to normalized emails in `AllowedEmail`.
- Every campaign, product, script, media job, and usage query is authorized through the owning user.
- Paid generation runs only in the BullMQ worker and is protected by monthly quota reservations.
- The old unrestricted remote-image proxy and synchronous generation routes are removed.
- JSON requests are capped at 1 MB; the API and login routes are rate limited; Helmet and explicit credentialed local CORS are enabled.
- API errors use `{ error: { code, message, requestId } }`.

## Workflow

```text
Website → Brand Profile → Hooks → Scripts → AI Images/Videos → Browser Editor → WebM
```

Generation endpoints return `202 Accepted` with a persisted job. The frontend polls real progress with backoff, and queued work survives API restarts. Worker retries use bounded exponential backoff. Cancellation and terminal failure release reserved quota.

The browser editor intentionally exports WebM. Current desktop Chrome, Edge, or Firefox is recommended; small screens receive a constrained editor layout and are not the primary export target.

## Troubleshooting

- `Invalid environment configuration`: compare `backend/.env` with `backend/.env.example`; JWT secrets must be at least 32 characters.
- API ready check fails: run `docker compose ps`, then verify PostgreSQL and Redis health.
- Jobs remain queued: ensure `npm run dev` is running the `worker` process and Redis is healthy.
- Live provider job fails: inspect the worker log using the job/request/campaign IDs, then run `npm run jobs:failed`.
- Firecrawl engine warning: upgrade to Node.js 22+; live mode is not supported on older Node versions.
