# UniMart setup

## 1. Requirements

- Node.js 20+ (developed on 22)
- A Supabase project (free tier is fine): <https://supabase.com>
- Optional: Supabase CLI (`npm i -g supabase`) for applying migrations
- Optional: a Resend account for verification emails, a Google Cloud project for Google sign-in

## 2. Database

Apply the migration in `supabase/migrations/` to your project, either:

```bash
supabase link --project-ref YOUR-PROJECT-REF
```

```bash
supabase db push
```

or paste `supabase/migrations/20261022000001_unimart_core.sql` into **SQL Editor → New query** and run it once.

The migration creates every table, row-level-security policy, function, the `listing-images` and `avatars`
storage buckets, adds `messages` and `notifications` to Realtime, and inserts NIT Sikkim plus the categories.

## 3. Environment

```bash
cp .env.example .env.local
```

| Variable | Where it comes from | Exposed to browser |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same page, `anon` key | yes (safe: RLS protects data) |
| `SUPABASE_SERVICE_ROLE_KEY` | same page, `service_role` key | **no, server only** |
| `NEXT_PUBLIC_SITE_URL` | your public URL, e.g. `https://unimart.example` | yes |
| `NEXT_PUBLIC_DEFAULT_INSTITUTE_ID` | `nit-sikkim` | yes |
| `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` | `true` only after step 5 | yes |
| `VERIFICATION_CODE_SECRET` | `openssl rand -hex 32` | no |
| `RESEND_API_KEY`, `EMAIL_FROM` | Resend dashboard; a verified sender domain | no |
| `ALLOW_DEMO_SEED` | `true` in development only | no |

Without `RESEND_API_KEY`, development builds print institute verification codes in the server console;
production refuses to send and tells users to request a manual review.

## 4. Supabase Auth settings

**Authentication → URL Configuration**

- Site URL: your `NEXT_PUBLIC_SITE_URL`
- Redirect URLs: `http://localhost:3000/auth/callback`, `https://YOUR-DOMAIN/auth/callback`

**Authentication → Providers → Email**: keep "Confirm email" on.

**Authentication → Email Templates** (required): the default links only work in the browser that requested
them. Students often sign up on a laptop and open email on a phone, so switch to `token_hash` links, which
`/auth/confirm` verifies on any device:

- Confirm signup: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/account/institute`
- Reset password: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`
- Change email: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change`

**Authentication → Rate Limits / Attack Protection**: keep the defaults and enable CAPTCHA for signup and
password reset in production. The app adds its own per-IP and per-email limits on login, signup, reset,
verification codes and the contact form.

For production, configure custom SMTP in Supabase (the built-in sender is rate-limited).

## 5. Google sign-in

1. Google Cloud Console → **APIs & Services → OAuth consent screen**: set app name "UniMart", support email,
   authorised domain, scopes `email`, `profile`, `openid`.
2. **Credentials → Create credentials → OAuth client ID → Web application**.
   - Authorised JavaScript origins: `http://localhost:3000`, `https://YOUR-DOMAIN`
   - Authorised redirect URI: `https://YOUR-PROJECT.supabase.co/auth/v1/callback`
3. Supabase → **Authentication → Providers → Google**: enable it and paste the client ID and client secret.
   The secret stays in Supabase; it is never in this repository or the browser.
4. Set `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` and restart.

Flow: the button calls `supabase.auth.signInWithOAuth` on the server, the browser goes to Google, Google
returns to Supabase (which validates the credential), and Supabase redirects to `/auth/callback`, where the
code is exchanged for a session cookie. Google sign-in does **not** verify institute membership.

## 6. Institute verification (NIT Sikkim)

The migration lists `nitsikkim.ac.in` (the domain used in the landing-page contact email) but marks it
**unconfirmed**, so email verification is off until an administrator confirms it:

1. Sign up, then make yourself an administrator: `npm run make-admin -- you@example.com`
2. Open `/admin/institutes`, check the domain list with the institute, tick "Email domains confirmed", save.

Until then members can request a manual review, which moderators approve at `/admin/memberships`.

## 7. Run

```bash
npm install
```

```bash
npm run dev
```

Demo data (development only, requires `ALLOW_DEMO_SEED=true`):

```bash
npm run seed
```

```bash
npm run seed:reset
```

Demo users use the `@demo.unimart.invalid` domain, have no institute membership (so they never show a
verified badge), and every demo listing is labelled **Demo** in the UI.

## 8. Deploy (Vercel or any Node host)

See [DEPLOYMENT.md](DEPLOYMENT.md) for environments, the checklist, monitoring, backups and rollback.


1. Push the repository, import it in Vercel, set the environment variables from step 3 (production values,
   `ALLOW_DEMO_SEED` unset).
2. Add the production URL to Supabase redirect URLs and the Google OAuth client.
3. `npm run build && npm start` works on any Node 20+ host as well.

## 9. Updating the landing page

`landing/original-index.html` is the untouched landing page from the UniKart repository.
`public/landing.html` is generated from it:

```bash
npm run landing
```

Edit the original, then re-run the script. It removes the demo login dialog and wires the buttons to real routes.
