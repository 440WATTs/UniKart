# UniKart production-readiness audit

_Audit date: 2026-10-22. Scope: the whole repository (Next.js 15 app, Supabase migration, scripts, docs)._
_Remediation completed 2026-10-23; status per finding in the "Status" column, details in §5–§10._

## 1. Method

- Read every route, server action, SQL function, policy and config file.
- `npm audit`, secret scan (`grep` for keys/JWTs/passwords), scan for `dangerouslySetInnerHTML`/`eval`/`innerHTML`.
- Probe scripts that apply the real migration in an embedded Postgres (PGlite) on a Supabase stub and act as
  anonymous visitors, users, verified members and admins. "Confirmed" below means the probe reproduced it.
- No production systems exist; nothing was deployed or modified outside the repository.

## 2. Inventory

**Stack.** Next.js 15 (App Router, server components + server actions), Supabase (Postgres + RLS, Auth, Storage,
Realtime). Static landing page served at `/`. No hosting, CI or monitoring configured.

**Roles.** anonymous · signed in (unverified) · verified member · suspended · moderator · admin. Roles live in
`user_roles`; verification in `institute_memberships`.

**Pages (36).**

| Access | Routes |
| --- | --- |
| Public | `/` (landing), `/marketplace`, `/search`, `/categories`, `/product/[id]`, `/wanted`, `/help`, `/contact`, `/terms`, `/privacy`, `/login`, `/signup`, `/forgot-password`, `/reset-password` |
| Signed in (middleware + server check) | `/sell`, `/sell/[id]/edit`, `/messages`, `/messages/[id]`, `/saved`, `/account`, `/account/{profile,institute,listings,orders,notifications,settings}` |
| Staff (server check on `user_roles`, 404 otherwise) | `/admin`, `/admin/{memberships,reports,listings,users,categories,institutes,inbox,audit}` |

**HTTP endpoints.** `GET /api/session`, `GET /api/suggest`, `GET /auth/callback`, `GET /auth/confirm`, `POST /auth/signout`.

**Server actions.** auth (login, signup, Google, reset request, password update), listings (save, status, delete draft),
save/unsave, start conversation, make offer, report, profile/avatar, institute code request/confirm, manual review,
notifications read, delete account, contact, 8 admin actions.

**Direct database API (anon key).** Everything granted to `anon`/`authenticated` is callable directly from a browser,
so every rule must hold at the database. 20 tables, 21 callable functions.

**Placeholders / mock data.** None presented as real. "Other campuses — coming soon" is labelled non-functional;
demo seed data is flagged `is_demo` and labelled.

## 3. Findings

| ID | Sev. | Finding | Evidence | Affected | Root cause | Fix | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| C1 | Critical | `next@15.5.4` advisories: RCE in React flight protocol; server-action source exposure; bundled `postcss` XSS/file read | `npm audit` | `package.json` | outdated pin | upgrade to patched Next/React | **Fixed** |
| H1 | High | Photos ≤1600px/1.5 MB uploaded unmodified with EXIF GPS; avatars never re-encoded | code | `ListingForm.tsx`, `AccountForms.tsx` | re-encode only when resizing | always re-encode (strips metadata); reject undecodable files | **Fixed** |
| H2 | High | Code requests limited per account, not per target email: N accounts → N×25 guesses/hour on a victim's address + email flooding | Confirmed (10/10 accounts got codes) | `membership_request_email_code` | missing per-email limit | per-email and per-IP limits | **Fixed** |
| H3 | High | No rate limits: anon wrote 200 contact rows directly; messages/reports/listings unlimited; login runs server-side so Supabase per-IP limits see one IP | Confirmed (200/200) | DB grants, auth actions | no limiter | DB-backed limiter for users and IPs; contact via server only | **Fixed** (app limits; enable Supabase CAPTCHA at deploy) |
| H4 | High | Expired pending offer blocks the buyer from ever offering again | Confirmed (`offer_already_pending`) | `make_offer` | expiry never materialised | expire stale offers before inserting | **Fixed** |
| H5 | High | Relisting a sold item leaves an `accepted` offer; no new offer can ever be accepted | Confirmed (`offers_one_accepted`) | `listings_after_status` | accepted offer never closed on sale | `completed` status on sale | **Fixed** |
| H6 | High | Deleting a reported account deletes all reports about it | Confirmed (1 → 0) | `reports` FK | `on delete cascade` | `set null` + snapshot of reported user | **Fixed** |
| M1 | Medium | `safeNext` accepts `/\t/evil.com` (browser resolves to evil.com) | Confirmed (validator) | `lib/format.ts` | prefix checks only | reject control chars/backslashes, resolve with URL | **Fixed** |
| M2 | Medium | Email/OAuth redirect URLs built from `x-forwarded-host` (reset-link poisoning if Supabase allowlist is broad) | code | `(auth)/actions.ts` | trusting request headers | use `NEXT_PUBLIC_SITE_URL` | **Fixed** |
| M3 | Medium | Anon can list every profile; any user can read everyone's name, department, year, `suspended_at` | Confirmed | `profiles` policy/grants | `using (true)` | visible only when relevant (listing, chat, block, self, staff); hide suspension | **Fixed** |
| M4 | Medium | Anon can call `is_blocked_between()` / `is_staff()` for any user | Confirmed | helper functions | arbitrary-uid helpers granted to anon | restrict to the caller | **Fixed** |
| M5 | Medium | Revoked members' listings stay public; revoked/suspended sellers can't close their own listings | Confirmed | membership trigger, `listings_update` | missing side effect; over-strict check | remove on revoke; allow closing statuses | **Fixed** |
| M6 | Medium | No CSP or HSTS | config | `next.config.ts` | not configured | nonce CSP for app, hash CSP for landing, HSTS | **Fixed** |
| M7 | Medium | Conversation RLS = seq scan + per-row function; per-row `auth.uid()`/`is_staff()` in listing policies | Confirmed (plan) | policies | policy shape | index-friendly policies, `(select …)` init-plans | **Fixed** |
| M8 | Medium | Listing save not atomic (live before photos); duplicate-key retry treated as success without owner check | code | `sell/actions.ts` | multiple client round-trips | single `save_listing` DB function | **Fixed** |
| M9 | Medium | `?error=` text reflected on `/login`, `/product` (phishing text) | code | pages | free text in URL | error codes only | **Fixed** |
| M10 | Medium | Confirmation/reset links fail on a different device (PKCE) | Supabase behaviour | auth emails | default templates | `token_hash` templates → `/auth/confirm` | **Code ready; needs Supabase template change** (SETUP §4) |
| M11 | Medium | No startup env validation, health check, error tracking, request IDs, CI | code | — | not built | instrumentation check, `/api/health`, request IDs, CI workflow | **Mostly fixed** (no error-tracking service yet) |
| M12 | Medium | Page past end of results likely shows "Search unavailable" (PostgREST 416) | likely | `lib/listings.ts` | range error treated as failure | handle `PGRST103` | **Fixed** |
| M13 | Medium | Each page: 2 auth calls + ~5 queries | code | `lib/session.ts` | separate queries | `my_context()` / `my_unread_counts()` RPCs, local JWT verification | **Fixed** |
| L1 | Low | Chat previews/unread from only 400 newest messages overall | code | `lib/messaging.ts` | global limit | per-conversation lateral query | **Fixed** |
| L2 | Low | Draft "Publish" bypasses photo requirement | code | `OwnerActions` | app-only rule | DB rule on draft→active | **Fixed** |
| L3 | Low | Moderators can suspend other moderators | code | `set_user_suspension` | only admins protected | staff targets need admin | **Fixed** |
| L4 | Low | Logout has no CSRF check and signs out every device | code | `auth/signout` | — | Origin check, local scope | **Fixed** |
| L5 | Low | No root error page, broken-image fallback, offline state | code | — | — | `global-error.tsx`, image fallback | **Partly fixed** (no offline state) |
| L6 | Low | `avatar_url` accepts any string via API | code | `profiles` | no validation | DB validation | **Fixed** |
| L7 | Low | Photos of removed listings remain fetchable by (unguessable) URL | design | storage | public bucket | documented | accepted |
| L8 | Low | Missing FK indexes (offers, messages.sender, reports, blocks) | schema | migration | — | add indexes | **Fixed** |
| L9 | Low | Dev-only advisories in the ESLint dependency chain | `npm audit` | dev deps | upstream | documented | accepted |
| L10 | Low | Supabase default privileges re-grant new tables to anon/authenticated | platform | future migrations | — | documented rule | **Fixed** (documented + enforced in migration) |

## 4. Remediation plan (order)

1. C1 dependency upgrades. 2. Database migration for H2, H4, H5, H6, M3, M4, M5, M7, L2, L3, L6, L8 + regression tests.
3. H1 photo re-encoding. 4. H3 rate limiting. 5. M1, M2, M9 redirects and errors. 6. M6 headers.
7. M8 atomic save. 8. M11–M13 operations and performance. 9. E2E, Web Vitals and restore tests (need a staging Supabase).

## 5. Implemented fixes

Root causes are in the findings table. Changed files (the project has no commits yet, so this list replaces a diff):

| Area | Change | Files |
| --- | --- | --- |
| C1 | `next` 15.5.4 → 15.5.28, `react`/`react-dom` 19.1.0 → 19.1.10, `eslint-config-next` → 15.5.28, `sharp` → 0.35.5 (dev), `overrides.next.postcss` → 8.5.31 | `package.json`, `package-lock.json` |
| DB (H2, H4, H5, H6, M3, M4, M5, M7, M8, L2, L3, L6, L8, L10, H3 per-user limits) | Two new migrations; the original is unchanged | `supabase/migrations/20261023000001_offer_completed_status.sql`, `20261023000002_audit_hardening.sql` |
| H1 | Every listing photo and avatar re-encoded through a canvas (no EXIF/GPS); undecodable files rejected | `src/lib/image.ts`, `src/components/sell/ListingForm.tsx`, `src/components/account/AccountForms.tsx` |
| H3 | DB-backed limiter; per-IP/per-email limits on login, signup, reset, verification codes, contact; contact form server-only | `src/lib/rate-limit.ts`, `src/app/(site)/(auth)/actions.ts`, `src/app/(site)/account/actions.ts`, `src/app/(site)/contact/actions.ts` |
| M1 | `safeNext` rejects control chars/backslashes and verifies origin | `src/lib/format.ts` |
| M2 | Email/OAuth links built from `NEXT_PUBLIC_SITE_URL` only | `(auth)/actions.ts`, `auth/callback`, `auth/confirm`, `auth/signout` |
| M9 | URLs carry error codes only; text from fixed tables; prototype-safe lookup | `src/lib/errors.ts`, login and product pages, `src/app/(site)/actions.ts` |
| M6 | Nonce CSP for app pages, hash CSP for landing, HSTS, COOP, no `X-Powered-By` | `src/middleware.ts`, `src/lib/csp.ts`, `next.config.ts`, `scripts/build-landing.py`, `landing/csp.json` |
| M8 | Listing save = one `save_listing()` call | `src/app/(site)/sell/actions.ts` |
| M11 | Production env validation at startup, `/api/health`, request IDs, JSON logs, CI workflow | `src/instrumentation.ts`, `src/lib/server-env.ts`, `src/app/api/health/route.ts`, `src/lib/log.ts`, `.github/workflows/ci.yml` |
| M12 | Out-of-range page shows "No more results" | `src/lib/listings.ts`, `src/app/(site)/search/page.tsx` |
| M13 | `my_context()` + `my_unread_counts()`; `getClaims()` instead of a second `getUser()` | `src/lib/session.ts`, `src/middleware.ts` |
| L1 | `conversation_previews()` | `src/lib/messaging.ts` |
| L4 | Origin check, local-scope sign-out | `src/app/auth/signout/route.ts` |
| L5 | `global-error.tsx`, image fallback component | `src/app/global-error.tsx`, `src/components/product/ListingImage.tsx` |
| Admin | Users list via staff-only `admin_list_users()` | `src/app/(site)/admin/users/page.tsx` |

**Found and fixed during verification:**

| ID | Sev. | Finding | Fix |
| --- | --- | --- | --- |
| N1 | Medium | During a database outage a valid product URL returned 404 "not found" (query errors were swallowed) | Listing/institute loaders throw on error → error boundary, HTTP 500 with reference |
| N2 | Medium | `notFound()` returned HTTP 200 because a group-wide `loading.tsx` started streaming first | Loading skeletons moved to grid pages only; detail pages return real 404s |
| N3 | Medium | During an outage the marketplace said "not configured", and a failing header took down every page | Header degrades (logs, keeps Help/Login reachable); pages show the error boundary |
| N4 | Low | `upgrade-insecure-requests` broke same-origin fetches on plain-http deployments | Emitted only when the site URL is https |

## 6. Automated tests (actually executed, 2026-10-23)

| Command | Exit | Result |
| --- | --- | --- |
| `npm run lint` | 0 | 0 errors, 0 warnings |
| `npm run typecheck` | 0 | clean |
| `npm run test:unit` | 0 | 30/30 pass |
| `npm run test:db` | 0 | 51/51 pass (37 original + 14 audit regressions) |
| `npm audit --omit=dev` | 0 | 0 vulnerabilities |
| `npm audit` (incl. dev) | 1 | 5 high in the ESLint plugin chain (dev-only, L9) |
| `npm run build` | 0 | 40+ routes; one earlier run failed on a transient Google Fonts fetch and passed on retry |

Changes to existing tests (behaviour changed on purpose, not weakened):
- "hide private columns from anonymous visitors": a member with no public listing is now invisible to visitors (M3).
- "verifies with the right code only": reads `home_institute_id` via `my_context()` because the column is no longer selectable (M3).
- "contact form": visitors' direct inserts are now rejected (H3); the server path is tested instead.

Each regression test was written against a probe that reproduced the bug on the pre-fix schema (§3). The unit tests
for `safeNext` and photo re-encoding fail against the previous implementations.

**Production smoke test** (local `next start`, placeholder Supabase URL that can't be reached):
- `/` serves the landing CSP with 3 script hashes; no console errors; all hero links work.
- `/help`: nonce CSP, all 24 scripts carry the nonce, dropdowns work; HSTS, `x-request-id` present.
- `/api/health` → 503 `{"status":"degraded","db":"error"}`; signout: cross-site 403, no Origin 403, same-site 303.
- 404 for unknown routes and bad product IDs; 500 + error page with reference when the database is down.
- `/sell` while signed out → 307 to `/login?next=%2Fsell%3Fkind%3Dwanted`; crafted `next` in callbacks stays on-site.
- `/login?error=<arbitrary text>` shows only the generic message; `?error=constructor` renders normally.
- Mobile 375 px: no horizontal overflow; bottom navigation present.

**Not executed (no Supabase project available):** browser end-to-end journeys with real data, two truly
concurrent sessions (PGlite has one connection; row locks are in place but not load-tested), load tests, backup
restore, Google OAuth round-trip, email delivery.

## 7. Performance

| Measure | Before | After |
| --- | --- | --- |
| Shared first-load JS | 102 kB | 103 kB (Next 15.5.28) |
| Middleware bundle | 71.3 kB | 72.3 kB |
| Auth round-trips per page | middleware `getUser` + page `getUser` (2 network calls) | `getClaims` ×2 (local JWT check with asymmetric keys; otherwise 2 network calls) |
| DB queries for viewer + header counts | 3 + 2 | 1 + 1 (`my_context`, `my_unread_counts`) |
| Conversation list | 2 queries, ≤400 messages scanned | 1 query + `conversation_previews` (1 row per conversation) |
| Conversation RLS plan | seq scan + `is_participant()` per row | index on `initiator_id`/`owner_id` (asserted in tests) |
| `/` landing transfer | — | 567 KB gzip (792 KB raw), CLS 0, load event ≈70–90 ms locally |
| `/help` transfer | — | 14 KB gzip HTML, CLS 0, load event ≈95–100 ms locally |

LCP could not be measured: the browser pane was backgrounded, so Chrome recorded no LCP entries. Local numbers
have no network latency and say nothing about real mobile LCP/INP. **Risk:** the landing page's 567 KB of inline
base64 images is likely to miss LCP ≤ 2.5 s on slow mobile networks. Fix (changes the landing file): move the images
to separate cacheable files. Not done here, to keep the landing page as supplied.

## 8. Deployment and rollback

See [DEPLOYMENT.md](DEPLOYMENT.md): environments, secrets, proxy/IP requirement, pre-deploy checklist, migration
rules, post-deploy smoke test, rollback, monitoring, backups.

## 9. Known limitations and remaining risks

| Risk | Severity | Notes |
| --- | --- | --- |
| No end-to-end test against a real Supabase project | High | Every UI journey is type-checked and its DB rules tested, but none has run against Supabase Auth/Storage/Realtime |
| Concurrency not load-tested | Medium | Offer acceptance uses row locks and unique indexes; needs a two-session test on staging |
| Email confirmation on another device | Medium | Requires the Supabase email-template change (SETUP §4) |
| No CAPTCHA | Medium | Enable Supabase CAPTCHA for signup/reset; app limits per IP/email are in place |
| Rate limits trust `x-forwarded-for` | Medium | Safe on Vercel; other hosts must overwrite the header (DEPLOYMENT.md) |
| No error-tracking service, alerting or backups configured | Medium | Hooks exist (request IDs, JSON logs, health check); services need accounts |
| Landing page weight (567 KB gzip) | Medium | See §7 |
| Uploads can be made directly to Storage with the anon key, bypassing browser re-encoding | Low | Same user's own folder only, size/MIME limited; EXIF stripping is client-side |
| Photos of removed listings stay reachable by unguessable URL (L7) | Low | Accepted |
| No offline state | Low | Pages show error boundaries on failure |
| Build fetches Google Fonts | Low | Self-host fonts to remove |
| Dev-only advisories (L9) | Low | Not shipped |
| Legal: terms/privacy drafts, institute endorsement, DPDP compliance | High (for launch) | Needs counsel; no affiliation is claimed |

## 10. Release recommendation

**Not Ready** for a public launch. All Critical and High code findings are fixed and regression-tested, and the
remaining Medium code findings are fixed except where an external service or configuration is required. The blockers
are verification, not code: no end-to-end run against a real Supabase project, no concurrency/load test, no backup
restore rehearsal, and unreviewed legal documents.

**Next step to reach "Ready with documented limitations":** create a staging Supabase project, apply the migrations,
complete the DEPLOYMENT.md checklist, run the post-deploy smoke test and two-user offer/messaging journeys, and
rehearse a restore. That could be done in a closed beta with NIT Sikkim volunteers.
