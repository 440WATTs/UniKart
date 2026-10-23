# Status, test results and known limitations

_Last updated 2026-10-23. The production-readiness audit and its results are in [AUDIT.md](AUDIT.md)._

## What was tested

| Check | Result |
| --- | --- |
| `npm run test:db`: migrations + RLS + functions in PGlite, as anon / users / moderator / admin | **51/51 pass** |
| `npm run test:unit`: redirects, money, search, errors, CSP, env validation, photo re-encoding | **30/30 pass** |
| `npm audit --omit=dev` | 0 vulnerabilities |
| `npm run typecheck` | pass |
| `npm run lint` | pass |
| `npm run build` (production) | pass |
| Production smoke test (headers, CSP, health, 404/500, redirects, mobile width) | see AUDIT.md §6 |
| Landing page at `/`: renders unchanged; Shop, Sell, Categories, Login, hero icons and category tiles link to real routes; fake localStorage login removed | checked in a browser |
| Marketplace routes without Supabase configured show "Setup required" instead of fake content | checked in a browser |

The database tests caught and fixed one real bug during development (block checks used the wrong recipient).

## Not yet tested (needs a Supabase project)

The UI flows have **not been exercised end to end against a live Supabase project**, because none was available
while building: signup/login/Google callback, photo upload, listing creation, search results, chat realtime,
offers in the UI, admin pages, and responsive layouts with real data. The database rules those flows depend on are
tested; the React/server-action glue is type-checked but not run. Do this pass first after connecting Supabase.

## Known limitations

- Listings never expire automatically (`expired` status exists but no scheduled job sets it).
- Lifting a suspension does not restore the listings it removed (moderators can restore them individually).
- View counts, "Popular on campus" and "Recommended for you" are not implemented, so nothing is invented;
  the homepage shows Recently listed, Free and Wanted.
- Email notifications are not sent (in-app notifications only).
- Search uses Postgres full-text search with prefix matching; no typo tolerance.
- Image optimization uses `next/image`; Supabase image transformations are not used.

## Requires external credentials, approval or review

- Supabase project and keys (everything).
- Google OAuth client (Google sign-in) — see `docs/SETUP.md` §5.
- Resend (or other) email provider and a verified sender domain (institute email codes in production).
- **Confirmation of NIT Sikkim's official email domain(s)** before enabling email verification.
- Any statement of affiliation with NIT Sikkim: none is made; the footer says UniKart is independent.
- **Legal review** of the draft Terms and Privacy notice (DPDP Act 2023), prohibited-items policy, dispute process,
  and of any future payments or auction feature.
