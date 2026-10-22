# Onboarding another institute

1. Add a migration inserting the institute **inactive**:

   ```sql
   insert into public.institutes (id, official_name, display_name, short_name, email_domains, city, state, is_active)
   values ('nit-xyz', 'National Institute of Technology XYZ', 'NIT XYZ', 'NITX', array['nitxyz.ac.in'], 'City', 'State', false);
   ```

2. Confirm the official email domain(s) with the institute. Some institutes use separate domains for students and
   staff, and some students have no institute email; keep manual review on for them.
3. In `/admin/institutes`, tick "Email domains confirmed" and "Marketplace active".
4. Before more than one institute is active, implement and review cross-campus browsing (currently the app shows
   only the default institute's marketplace). Keep `app_settings.cross_campus_enabled` false until then.

Location-based ordering ("nearby campuses") must use institute coordinates only, never a user's precise location,
and must ask for consent before using any device location.
