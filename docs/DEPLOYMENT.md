# Deployment, operations and rollback

## Environments

Use three separate Supabase projects and three sets of variables. Never point staging or development at the
production database, and never copy production data into them.

| | Development | Staging | Production |
| --- | --- | --- | --- |
| Supabase project | `unikart-dev` | `unikart-staging` | `unikart-prod` |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | `https://staging.<domain>` | `https://<domain>` |
| `ALLOW_DEMO_SEED` | `true` | `true` (demo data only) | unset |
| Email provider | console log | Resend test domain | Resend verified domain |
| Google OAuth client | dev client | staging client | production client |

Production refuses to start serving if required variables are missing or unsafe (`src/lib/server-env.ts`):
every request returns 500 and the log says which variable is wrong.

## Secrets

- Store `SUPABASE_SERVICE_ROLE_KEY`, `VERIFICATION_CODE_SECRET` and `RESEND_API_KEY` only in the host's secret store
  (e.g. Vercel → Project → Settings → Environment Variables, "Sensitive"). Never in the repo, CI logs or the browser.
- `NEXT_PUBLIC_*` values are public by design. The anon key is safe only because every table has RLS.
- Rotate the service-role key and `VERIFICATION_CODE_SECRET` if they are ever exposed. Rotating the secret
  invalidates outstanding verification codes only.

## Proxy / client IP

Rate limits key on the client IP from `x-forwarded-for`. On Vercel the platform sets it. On any other host, the
reverse proxy **must overwrite** that header with the real client address (nginx:
`proxy_set_header X-Forwarded-For $remote_addr;`), otherwise clients can spoof it and bypass per-IP limits.

## Pre-deployment checklist

- [ ] CI green: `npm ci`, `npm audit --omit=dev --audit-level=high`, `lint`, `typecheck`, `npm test`, `build`.
- [ ] Migrations reviewed; applied to **staging** first (`supabase db push --linked` against staging).
- [ ] Supabase Auth: Site URL and redirect URLs set; email templates use `token_hash` links (docs/SETUP.md §4).
- [ ] Supabase Auth rate limits and CAPTCHA (hCaptcha/Turnstile) enabled for signup and password reset.
- [ ] Custom SMTP configured in Supabase; Resend sender domain verified (SPF/DKIM).
- [ ] Storage buckets exist with size/MIME limits (created by the first migration).
- [ ] NIT Sikkim email domain confirmed by an admin before ticking "confirmed".
- [ ] DNS points to the host; HTTPS certificate valid; `http://` redirects to `https://`.
- [ ] Security headers present: `curl -sI https://<domain>/help` shows `content-security-policy` with a nonce,
      `strict-transport-security`, `x-frame-options: DENY`; `/` shows the landing CSP with `sha256-` hashes.
- [ ] Uptime monitor on `GET /api/health` (expects 200 and `"db":"ok"`).
- [ ] Error tracking / log drain configured (see Monitoring).
- [ ] Backups enabled (see Backups) and a restore rehearsed on staging this release cycle.
- [ ] Terms and privacy notice reviewed by counsel (currently drafts).

## Database migrations

- Migrations are forward-only SQL files in `supabase/migrations/`, applied in filename order.
- They must stay backward compatible with the currently deployed app for one release: add columns/functions
  first, deploy the app, remove old things in a later migration.
- Enum values are added in their own migration file (Postgres can't use a new value in the same transaction).
- Every migration that creates tables or functions must end with explicit `revoke`/`grant` statements, because
  Supabase's default privileges grant new objects to `anon` and `authenticated` (see the end of
  `20261023000002_audit_hardening.sql`). Add a test in `tests/db/schema.test.ts` for each new rule.
- Never run destructive SQL against production by hand. Write a migration, review it, apply to staging, then production.

## Deploy

1. Merge to the release branch after CI passes.
2. Apply migrations to production (`supabase db push`) **before** the app deploy when they are additive.
3. Deploy the app (Vercel promotes the build; other hosts: `npm ci && npm run build && npm start` behind HTTPS).

## Post-deployment smoke test (5 minutes)

```bash
curl -s https://<domain>/api/health
```

Then in a browser:

1. `/` landing loads with no console errors; Shop and Login go to `/marketplace` and `/login`.
2. Sign up a staging test account, confirm via email, log in, log out.
3. `/marketplace`, `/search?q=calc`, a product page, `/search?page=999` (shows "No more results").
4. Verified test account: create a listing with a photo; check the photo has no EXIF (`exiftool` on the downloaded file).
5. Second test account: message the seller, make an offer, accept it, mark sold.
6. `/admin` as a non-admin returns 404.

## Rollback

- **App:** redeploy the previous build (Vercel → Deployments → previous → Promote; other hosts: redeploy the
  previous tag). The current migrations are backward compatible with the previous app version, so the database can stay.
- **Database:** don't "down-migrate" production. Fix forward with a new migration. If data was damaged, restore to a
  point in time into a **new** project, verify it, then switch the app's env vars to it.
- After rollback, rerun the smoke test and note the incident in the audit log / changelog.

## Monitoring and logs

- Server logs are JSON lines with `scope`, `message` and `requestId` (`src/lib/log.ts`). Every response has an
  `x-request-id` header; error pages show a reference digest. Ask users for either when they report problems.
- Recommended: a log drain or error tracker (e.g. Sentry via `@sentry/nextjs`) — **not installed yet**.
- Alert on: `/api/health` failures, 5xx rate, p95 latency, Supabase CPU/connections (Supabase dashboard → Reports),
  auth error spikes, email bounce rate, and growth of `rate_limit_events`.
- Don't log message bodies, passwords, tokens, codes or email contents.

## Backups

- Supabase Pro includes daily backups; enable Point-in-Time Recovery for production.
- Storage (photos) is not covered by database backups; schedule a copy of the `listing-images` and `avatars`
  buckets if photos must be recoverable.
- Rehearse a restore on staging each release cycle and record the date and duration here.

## Dependencies

- `npm audit --omit=dev --audit-level=high` runs in CI. Review Next.js/React security releases weekly.
- `next`'s bundled `postcss` is overridden to a patched version in `package.json` (`overrides`). Remove the
  override when Next ships a patched postcss.
- Remaining dev-only advisories (ESLint plugin chain) don't ship to users; re-check on each Next upgrade.
- The build downloads Google Fonts through `next/font`; a transient fetch failure fails the build (seen once).
  Retry, or self-host the fonts with `next/font/local` to remove the dependency.
