# UniKart

**Your Campus. Your Marketplace.** A marketplace where verified members of an institute buy, sell and exchange
items, starting with NIT Sikkim.

- `/` is the original UniKart landing page (from the UniKart repo), now linked to the app.
- `/marketplace`, `/search`, `/categories`, `/product/:id`, `/sell`, `/wanted`, `/messages`, `/saved`,
  `/account/*`, `/admin/*`, `/login`, `/signup`, `/help`, `/contact`.

Next.js 15 + Supabase (Postgres with row-level security, Auth with Google, Storage, Realtime).

## Quick start

1. Create a Supabase project and apply `supabase/migrations/` (see [docs/SETUP.md](docs/SETUP.md)).
2. `cp .env.example .env.local` and fill it in.
3. `npm install && npm run dev`, then sign up and run `npm run make-admin -- you@example.com`.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Unit tests + database authorization tests (embedded Postgres, no Docker needed) |
| `npm run typecheck`, `npm run lint` | Static checks |
| `npm run seed`, `npm run seed:reset` | Development demo data (needs `ALLOW_DEMO_SEED=true`) |
| `npm run make-admin -- <email>` | Grant the first admin role |
| `npm run landing` | Rebuild `public/landing.html` from `landing/source-index.html` |

## Docs

- [Setup, Google OAuth, deployment](docs/SETUP.md)
- [Architecture and security model](docs/ARCHITECTURE.md)
- [Status, test results, known limitations, external requirements](docs/STATUS.md)
- [Production-readiness audit](docs/AUDIT.md) · [Deployment, operations, rollback](docs/DEPLOYMENT.md)
- [Onboarding institutes](docs/INSTITUTES.md) · [Auctions (disabled)](docs/AUCTIONS.md)

UniKart is an independent student project and is not affiliated with or endorsed by NIT Sikkim.
