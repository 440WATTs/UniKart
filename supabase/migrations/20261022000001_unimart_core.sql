-- UniMart core schema
-- Institutes, memberships, listings, messaging, offers, notifications,
-- reports, moderation and audit. Authorization is enforced here with
-- row-level security, column grants and SECURITY DEFINER functions;
-- hiding a button in the UI is never the security control.

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.account_type as enum ('student', 'faculty', 'staff', 'other');
create type public.membership_status as enum ('pending', 'verified', 'rejected', 'revoked');
create type public.verification_method as enum ('institute_email', 'manual_review');
create type public.listing_kind as enum ('sale', 'wanted');
-- 'auction' is intentionally absent; see docs/AUCTIONS.md.
create type public.listing_type as enum ('fixed', 'fixed_offers');
create type public.item_condition as enum ('new', 'like_new', 'good', 'fair', 'for_parts');
create type public.listing_status as enum ('draft', 'active', 'reserved', 'sold', 'removed', 'expired');
create type public.offer_status as enum ('pending', 'accepted', 'declined', 'countered', 'withdrawn', 'expired', 'cancelled');
create type public.report_reason as enum ('scam', 'misleading', 'prohibited', 'stolen_counterfeit', 'harassment', 'other');
create type public.report_status as enum ('open', 'actioned', 'dismissed');
create type public.app_role as enum ('admin', 'moderator');

-- ---------------------------------------------------------------------------
-- Institutes and global settings
-- ---------------------------------------------------------------------------
create table public.institutes (
  id text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  official_name text not null,
  display_name text not null,
  short_name text not null,
  logo_url text,
  -- Email domains accepted as proof of membership. Must be confirmed by an
  -- administrator; an empty array disables email verification.
  email_domains text[] not null default '{}',
  email_domains_confirmed boolean not null default false,
  allow_manual_review boolean not null default true,
  city text,
  state text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  is_active boolean not null default false,
  -- public_browse: logged-out visitors may browse; offers_enabled; max_images;
  -- offer_expiry_hours
  settings jsonb not null default '{"public_browse": true, "offers_enabled": true, "max_images": 8, "offer_expiry_hours": 48}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Profiles and roles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  display_name text not null default '' check (char_length(display_name) <= 60),
  avatar_url text,
  account_type public.account_type,
  department text check (char_length(department) <= 120),
  academic_year text check (char_length(academic_year) <= 40),
  designation text check (char_length(designation) <= 120),
  bio text check (char_length(bio) <= 500),
  home_institute_id text references public.institutes (id),
  -- Maintained by membership triggers; never user-editable.
  verified_institute_id text references public.institutes (id),
  is_demo boolean not null default false,
  suspended_at timestamptz,
  suspension_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null,
  granted_by uuid,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- ---------------------------------------------------------------------------
-- Institute memberships
-- ---------------------------------------------------------------------------
create table public.institute_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  institute_id text not null references public.institutes (id),
  status public.membership_status not null default 'pending',
  method public.verification_method not null,
  institute_email text check (institute_email is null or institute_email = lower(institute_email)),
  applicant_note text check (char_length(applicant_note) <= 1000),
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, institute_id)
);
-- One institute email address can verify only one account.
create unique index institute_memberships_email_once
  on public.institute_memberships (institute_id, institute_email)
  where status = 'verified' and institute_email is not null;

create table public.membership_email_codes (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.institute_memberships (id) on delete cascade,
  email text not null,
  code_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index membership_email_codes_membership on public.membership_email_codes (membership_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------
create table public.categories (
  id text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  name text not null,
  description text,
  icon text,
  sort_order int not null default 100,
  is_active boolean not null default true
);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references public.profiles (id) on delete set null,
  institute_id text not null references public.institutes (id),
  kind public.listing_kind not null default 'sale',
  title text not null check (char_length(title) between 3 and 120),
  description text not null check (char_length(description) between 10 and 4000),
  category_id text not null references public.categories (id),
  -- Money is stored in integer paise. For a wanted listing this is the budget.
  price_paise bigint check (price_paise is null or price_paise between 0 and 100000000),
  currency char(3) not null default 'INR',
  condition public.item_condition,
  listing_type public.listing_type not null default 'fixed',
  negotiable boolean not null default false,
  brand text check (char_length(brand) <= 80),
  model text check (char_length(model) <= 80),
  purchase_date date,
  original_price_paise bigint check (original_price_paise is null or original_price_paise between 0 and 100000000),
  status public.listing_status not null default 'draft',
  removed_by_moderator boolean not null default false,
  is_demo boolean not null default false,
  published_at timestamptz,
  sold_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(brand, '') || ' ' || coalesce(model, '') || ' ' || category_id), 'B') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C')
  ) stored,
  constraint sale_needs_price check (kind <> 'sale' or (price_paise is not null and condition is not null)),
  constraint wanted_is_fixed check (kind <> 'wanted' or listing_type = 'fixed'),
  constraint free_is_fixed check (price_paise is distinct from 0 or listing_type = 'fixed')
);
create index listings_browse on public.listings (institute_id, status, kind, created_at desc);
create index listings_category on public.listings (category_id, created_at desc);
create index listings_price on public.listings (institute_id, price_paise);
create index listings_seller on public.listings (seller_id, status);
create index listings_search on public.listings using gin (search);
create index listings_title_trgm on public.listings using gin (title extensions.gin_trgm_ops);

create table public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  storage_path text not null unique,
  position int not null default 0,
  width int,
  height int,
  created_at timestamptz not null default now()
);
create index listing_images_listing on public.listing_images (listing_id, position);

create table public.saved_listings (
  user_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
create index saved_listings_listing on public.saved_listings (listing_id);

-- ---------------------------------------------------------------------------
-- Messaging
-- ---------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  institute_id text not null references public.institutes (id),
  -- initiator: the person who contacted the listing owner (buyer for a sale,
  -- seller for a wanted listing). owner: the listing owner.
  initiator_id uuid references public.profiles (id) on delete set null,
  owner_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  unique (listing_id, initiator_id)
);
create index conversations_initiator on public.conversations (initiator_id, last_message_at desc);
create index conversations_owner on public.conversations (owner_id, last_message_at desc);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default 'epoch',
  primary key (conversation_id, user_id)
);
create index conversation_participants_user on public.conversation_participants (user_id);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  buyer_id uuid references public.profiles (id) on delete set null,
  seller_id uuid references public.profiles (id) on delete set null,
  made_by uuid references public.profiles (id) on delete set null,
  parent_offer_id uuid references public.offers (id),
  amount_paise bigint not null check (amount_paise > 0 and amount_paise <= 100000000),
  currency char(3) not null default 'INR',
  status public.offer_status not null default 'pending',
  expires_at timestamptz not null,
  responded_at timestamptz,
  created_at timestamptz not null default now()
);
-- At most one live offer per buyer per listing, and one accepted offer per listing.
create unique index offers_one_pending on public.offers (listing_id, buyer_id) where status = 'pending';
create unique index offers_one_accepted on public.offers (listing_id) where status = 'accepted';
create index offers_conversation on public.offers (conversation_id, created_at);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  kind text not null default 'text' check (kind in ('text', 'offer', 'system')),
  body text not null check (char_length(body) between 1 and 2000),
  offer_id uuid references public.offers (id) on delete set null,
  created_at timestamptz not null default now()
);
create index messages_conversation on public.messages (conversation_id, created_at);

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- ---------------------------------------------------------------------------
-- Notifications, reports, moderation, audit, contact
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  -- Used to collapse repeated notifications (e.g. many messages in one chat).
  group_key text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user on public.notifications (user_id, created_at desc);
create index notifications_unread on public.notifications (user_id) where read_at is null;

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  listing_id uuid references public.listings (id) on delete cascade,
  reported_user_id uuid references public.profiles (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  reason public.report_reason not null,
  details text check (char_length(details) <= 2000),
  status public.report_status not null default 'open',
  resolution_note text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check (listing_id is not null or reported_user_id is not null)
);
create index reports_status on public.reports (status, created_at desc);

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  moderator_id uuid,
  action text not null,
  target_type text not null,
  target_id text not null,
  reason text,
  report_id uuid references public.reports (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid,
  event text not null,
  entity_type text not null,
  entity_id text,
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_events_created on public.audit_events (created_at desc);

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 200),
  subject text not null check (char_length(subject) between 1 and 160),
  body text not null check (char_length(body) between 10 and 4000),
  handled boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------
create or replace function public.is_staff(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = uid);
$$;

create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = uid and role = 'admin');
$$;

-- True for the table owner / service role (server-side code, migrations,
-- SECURITY DEFINER functions) but not for end-user requests.
create or replace function public.is_privileged()
returns boolean language sql stable as $$
  select current_user not in ('anon', 'authenticated');
$$;

create or replace function public.is_verified_member(uid uuid, inst text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from institute_memberships m
    join institutes i on i.id = m.institute_id
    join profiles p on p.id = m.user_id
    where m.user_id = uid and m.institute_id = inst and m.status = 'verified'
      and i.is_active and p.suspended_at is null
  );
$$;

create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

create or replace function public.push_notification(
  p_user uuid, p_type text, p_title text, p_body text, p_link text, p_group text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is null then
    return;
  end if;
  if p_group is not null then
    -- Collapse into an existing unread notification of the same group.
    update notifications
       set title = p_title, body = p_body, link = p_link, created_at = now()
     where user_id = p_user and group_key = p_group and read_at is null;
    if found then
      return;
    end if;
  end if;
  insert into notifications (user_id, type, title, body, link, group_key)
  values (p_user, p_type, p_title, p_body, p_link, p_group);
end;
$$;

create or replace function public.audit(
  p_event text, p_entity_type text, p_entity_id text, p_data jsonb default '{}'
) returns void language sql security definer set search_path = public as $$
  insert into audit_events (actor_id, event, entity_type, entity_id, data)
  values (auth.uid(), p_event, p_entity_type, p_entity_id, coalesce(p_data, '{}'));
$$;

create or replace function public.format_inr(paise bigint)
returns text language sql immutable as $$
  select '₹' || case when paise % 100 = 0 then to_char(paise / 100, 'FM999,999,990')
                     else to_char(paise / 100.0, 'FM999,999,990.00') end;
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger institutes_touch before update on public.institutes for each row execute function public.touch_updated_at();
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger memberships_touch before update on public.institute_memberships for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Profiles: created automatically for every auth user
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  n text := coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'name', ''), '');
begin
  insert into profiles (id, full_name, display_name, avatar_url)
  values (
    new.id,
    left(n, 120),
    left(coalesce(nullif(split_part(n, ' ', 1), ''), 'Member'), 60),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Membership side effects
-- ---------------------------------------------------------------------------
create or replace function public.membership_changed()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  inst_name text;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;
  select display_name into inst_name from institutes where id = new.institute_id;

  if new.status = 'verified' then
    update profiles
       set verified_institute_id = new.institute_id,
           home_institute_id = coalesce(home_institute_id, new.institute_id)
     where id = new.user_id;
  elsif tg_op = 'UPDATE' and old.status = 'verified' then
    update profiles set verified_institute_id = null
     where id = new.user_id and verified_institute_id = new.institute_id;
  end if;

  if tg_op = 'UPDATE' and new.status in ('verified', 'rejected', 'revoked') then
    perform push_notification(
      new.user_id, 'verification',
      case new.status
        when 'verified' then 'You are now a verified ' || inst_name || ' member'
        when 'rejected' then 'Your ' || inst_name || ' verification was not approved'
        else 'Your ' || inst_name || ' membership was revoked'
      end,
      new.review_note, '/account/institute'
    );
  end if;
  perform audit('membership.' || new.status, 'institute_membership', new.id::text,
    jsonb_build_object('user_id', new.user_id, 'institute_id', new.institute_id, 'method', new.method));
  return new;
end;
$$;

create trigger membership_status_changed
  after insert or update on public.institute_memberships
  for each row execute function public.membership_changed();

-- Called by the server (service role) after it has generated and hashed a
-- code. The plain code is never stored.
create or replace function public.membership_request_email_code(
  p_user uuid, p_institute text, p_email text, p_code_hash text, p_ttl_minutes int default 15
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  inst institutes;
  email text := lower(trim(p_email));
  domain text := split_part(lower(trim(p_email)), '@', 2);
  mem institute_memberships;
  recent int;
begin
  select * into inst from institutes where id = p_institute;
  if inst.id is null or not inst.is_active then
    raise exception 'institute_not_available';
  end if;
  if not inst.email_domains_confirmed or not (domain = any (inst.email_domains)) then
    raise exception 'email_domain_not_accepted';
  end if;
  if exists (
    select 1 from institute_memberships
    where institute_id = p_institute and institute_email = email and status = 'verified' and user_id <> p_user
  ) then
    raise exception 'email_already_used';
  end if;

  select * into mem from institute_memberships where user_id = p_user and institute_id = p_institute;
  if mem.status = 'verified' then
    raise exception 'already_verified';
  end if;
  if mem.status = 'revoked' then
    raise exception 'membership_revoked';
  end if;

  select count(*) into recent
    from membership_email_codes c
    join institute_memberships m on m.id = c.membership_id
   where m.user_id = p_user and c.created_at > now() - interval '1 hour';
  if recent >= 5 then
    raise exception 'too_many_codes';
  end if;

  insert into institute_memberships (user_id, institute_id, status, method, institute_email)
  values (p_user, p_institute, 'pending', 'institute_email', email)
  on conflict (user_id, institute_id) do update
    set status = 'pending', method = 'institute_email', institute_email = excluded.institute_email
  returning * into mem;

  update membership_email_codes set consumed_at = now()
   where membership_id = mem.id and consumed_at is null;
  insert into membership_email_codes (membership_id, email, code_hash, expires_at)
  values (mem.id, email, p_code_hash, now() + make_interval(mins => p_ttl_minutes));
  return mem.id;
end;
$$;

create or replace function public.membership_confirm_email_code(
  p_user uuid, p_institute text, p_code_hash text
) returns text language plpgsql security definer set search_path = public as $$
declare
  mem institute_memberships;
  code membership_email_codes;
begin
  select * into mem from institute_memberships
   where user_id = p_user and institute_id = p_institute for update;
  if mem.id is null then
    return 'no_request';
  end if;
  if mem.status = 'verified' then
    return 'already_verified';
  end if;
  select * into code from membership_email_codes
   where membership_id = mem.id and consumed_at is null
   order by created_at desc limit 1 for update;
  if code.id is null then
    return 'no_request';
  end if;
  if code.expires_at < now() then
    return 'expired';
  end if;
  if code.attempts >= 5 then
    return 'too_many_attempts';
  end if;
  if code.code_hash <> p_code_hash then
    update membership_email_codes set attempts = attempts + 1 where id = code.id;
    return 'invalid';
  end if;
  update membership_email_codes set consumed_at = now() where id = code.id;
  update institute_memberships
     set status = 'verified', verified_at = now(), method = 'institute_email', institute_email = code.email
   where id = mem.id;
  return 'verified';
end;
$$;

-- Users without an institute email can ask a moderator to review them.
create or replace function public.request_manual_review(p_institute text, p_note text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  inst institutes;
  mem institute_memberships;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  select * into inst from institutes where id = p_institute;
  if inst.id is null or not inst.is_active or not inst.allow_manual_review then
    raise exception 'institute_not_available';
  end if;
  if char_length(coalesce(trim(p_note), '')) < 10 then
    raise exception 'note_too_short';
  end if;
  select * into mem from institute_memberships where user_id = auth.uid() and institute_id = p_institute;
  if mem.status in ('verified', 'revoked') then
    raise exception 'cannot_request';
  end if;
  insert into institute_memberships (user_id, institute_id, status, method, applicant_note)
  values (auth.uid(), p_institute, 'pending', 'manual_review', left(p_note, 1000))
  on conflict (user_id, institute_id) do update
    set status = 'pending', method = 'manual_review', applicant_note = excluded.applicant_note,
        review_note = null, reviewed_at = null, reviewed_by = null
  returning * into mem;
  return mem.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Listings: integrity rules that RLS alone cannot express
-- ---------------------------------------------------------------------------
create or replace function public.listings_guard()
returns trigger language plpgsql set search_path = public as $$
declare
  inst institutes;
begin
  if tg_op = 'INSERT' then
    if not is_privileged() then
      new.seller_id := auth.uid();
      new.is_demo := false;
      new.removed_by_moderator := false;
      new.created_at := now();
      if new.status not in ('draft', 'active') then
        raise exception 'invalid_status';
      end if;
    end if;
  else
    if not is_privileged() then
      if new.seller_id is distinct from old.seller_id or new.institute_id <> old.institute_id
         or new.is_demo <> old.is_demo or new.created_at <> old.created_at
         or new.removed_by_moderator <> old.removed_by_moderator or new.kind <> old.kind then
        raise exception 'immutable_field';
      end if;
      if old.removed_by_moderator then
        raise exception 'listing_removed_by_moderator';
      end if;
      if new.status = 'expired' and old.status <> 'expired' then
        raise exception 'invalid_status';
      end if;
    end if;
  end if;

  select * into inst from institutes where id = new.institute_id;
  if new.listing_type = 'fixed_offers' and not coalesce((inst.settings ->> 'offers_enabled')::boolean, false) then
    raise exception 'offers_disabled';
  end if;
  if new.kind = 'wanted' then
    new.condition := null;
  end if;

  if new.status = 'active' and new.published_at is null then
    new.published_at := now();
  end if;
  if new.status = 'sold' and (tg_op = 'INSERT' or old.status <> 'sold') then
    new.sold_at := now();
  elsif new.status <> 'sold' then
    new.sold_at := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger listings_guard before insert or update on public.listings
  for each row execute function public.listings_guard();

create or replace function public.listings_after_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- Leaving 'active': pending offers can no longer be accepted.
  if new.status in ('sold', 'removed', 'draft', 'expired') then
    for r in
      update offers set status = 'cancelled', responded_at = now()
       where listing_id = new.id and status = 'pending'
      returning id, buyer_id, made_by, seller_id
    loop
      perform push_notification(r.buyer_id, 'offer_cancelled', 'An offer on "' || new.title || '" was closed',
        'The listing is no longer available for offers.', '/product/' || new.id);
    end loop;
  end if;

  -- Reservation released: the accepted offer no longer holds.
  if old.status = 'reserved' and new.status in ('active', 'draft', 'removed') then
    update offers set status = 'cancelled', responded_at = now()
     where listing_id = new.id and status = 'accepted';
  end if;

  if new.status = 'sold' then
    for r in
      select distinct user_id from (
        select user_id from saved_listings where listing_id = new.id
        union
        select initiator_id from conversations where listing_id = new.id
      ) u where user_id is not null and user_id is distinct from new.seller_id
    loop
      perform push_notification(r.user_id, 'listing_sold', '"' || new.title || '" has been marked sold',
        null, '/product/' || new.id);
    end loop;
  end if;
  return new;
end;
$$;

create trigger listings_after_status after update of status on public.listings
  for each row execute function public.listings_after_status();

create or replace function public.listing_images_guard()
returns trigger language plpgsql set search_path = public as $$
declare
  owner uuid;
  max_images int;
  n int;
begin
  select l.seller_id, coalesce((i.settings ->> 'max_images')::int, 8)
    into owner, max_images
    from listings l join institutes i on i.id = l.institute_id
   where l.id = new.listing_id;
  if not is_privileged() then
    if owner is distinct from auth.uid() then
      raise exception 'not_owner';
    end if;
    -- Images must live in the uploader's own storage folder.
    if split_part(new.storage_path, '/', 1) <> auth.uid()::text then
      raise exception 'invalid_image_path';
    end if;
  end if;
  select count(*) into n from listing_images where listing_id = new.listing_id;
  if n >= max_images then
    raise exception 'too_many_images';
  end if;
  return new;
end;
$$;

create trigger listing_images_guard before insert on public.listing_images
  for each row execute function public.listing_images_guard();

-- Counts for the seller dashboard; only returns rows the caller owns.
create or replace function public.my_listing_stats(p_ids uuid[])
returns table (listing_id uuid, saves bigint, conversations bigint)
language sql stable security definer set search_path = public as $$
  select l.id,
         (select count(*) from saved_listings s where s.listing_id = l.id),
         (select count(*) from conversations c where c.listing_id = l.id)
    from listings l
   where l.id = any (p_ids) and l.seller_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Conversations and messages
-- ---------------------------------------------------------------------------
create or replace function public.start_conversation(p_listing uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  l listings;
  conv uuid;
begin
  if me is null then
    raise exception 'not_authenticated';
  end if;
  select * into l from listings where id = p_listing;
  if l.id is null or l.status not in ('active', 'reserved') then
    raise exception 'listing_unavailable';
  end if;
  if l.seller_id = me then
    raise exception 'own_listing';
  end if;
  if l.seller_id is null then
    raise exception 'listing_unavailable';
  end if;
  if not is_verified_member(me, l.institute_id) then
    raise exception 'not_verified';
  end if;
  if is_blocked_between(me, l.seller_id) then
    raise exception 'blocked';
  end if;

  select id into conv from conversations where listing_id = p_listing and initiator_id = me;
  if conv is null then
    insert into conversations (listing_id, institute_id, initiator_id, owner_id)
    values (p_listing, l.institute_id, me, l.seller_id)
    returning id into conv;
    insert into conversation_participants (conversation_id, user_id, last_read_at)
    values (conv, me, now()), (conv, l.seller_id, 'epoch');
  end if;
  return conv;
end;
$$;

create or replace function public.is_participant(p_conv uuid, uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from conversation_participants where conversation_id = p_conv and user_id = uid);
$$;

create or replace function public.messages_guard()
returns trigger language plpgsql set search_path = public as $$
declare
  c conversations;
  other uuid;
begin
  if not is_privileged() then
    new.sender_id := auth.uid();
    new.kind := 'text';
    new.offer_id := null;
    new.created_at := now();
  end if;
  select * into c from conversations where id = new.conversation_id;
  other := case when new.sender_id = c.initiator_id then c.owner_id else c.initiator_id end;
  if not is_privileged() then
    if c.id is null or not is_participant(c.id, new.sender_id) then
      raise exception 'not_participant';
    end if;
    if exists (select 1 from profiles where id = auth.uid() and suspended_at is not null) then
      raise exception 'account_suspended';
    end if;
    if other is null then
      raise exception 'participant_left';
    end if;
    if is_blocked_between(auth.uid(), other) then
      raise exception 'blocked';
    end if;
  end if;
  return new;
end;
$$;

create trigger messages_guard before insert on public.messages
  for each row execute function public.messages_guard();

create or replace function public.messages_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c conversations;
  l listings;
  other uuid;
  sender_name text;
  first_msg boolean;
begin
  select * into c from conversations where id = new.conversation_id;
  select * into l from listings where id = c.listing_id;
  update conversations set last_message_at = new.created_at where id = c.id;
  update conversation_participants set last_read_at = new.created_at
   where conversation_id = c.id and user_id = new.sender_id;
  if new.kind = 'offer' then
    return new; -- offer functions send their own notifications
  end if;
  other := case when new.sender_id = c.initiator_id then c.owner_id else c.initiator_id end;
  select coalesce(nullif(display_name, ''), 'A member') into sender_name from profiles where id = new.sender_id;
  select count(*) = 1 into first_msg from messages where conversation_id = c.id;
  if first_msg and l.kind = 'wanted' and other = l.seller_id then
    perform push_notification(other, 'wanted_response', sender_name || ' responded to your wanted item',
      left(new.body, 140), '/messages/' || c.id);
  else
    perform push_notification(other, 'message', 'New message from ' || coalesce(sender_name, 'a member'),
      left(new.body, 140), '/messages/' || c.id, 'conv:' || c.id);
  end if;
  return new;
end;
$$;

create trigger messages_after_insert after insert on public.messages
  for each row execute function public.messages_after_insert();

create or replace function public.mark_conversation_read(p_conv uuid)
returns void language sql security definer set search_path = public as $$
  update conversation_participants set last_read_at = now()
   where conversation_id = p_conv and user_id = auth.uid();
  update notifications set read_at = now()
   where user_id = auth.uid() and group_key = 'conv:' || p_conv and read_at is null;
$$;

create or replace function public.unread_conversation_count()
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int
    from conversation_participants p
    join conversations c on c.id = p.conversation_id
   where p.user_id = auth.uid()
     and exists (
       select 1 from messages m
        where m.conversation_id = c.id and m.created_at > p.last_read_at
          and m.sender_id is distinct from auth.uid()
     );
$$;

-- ---------------------------------------------------------------------------
-- Offers (negotiation only: no payment, no obligation, no auction)
-- ---------------------------------------------------------------------------
create or replace function public.make_offer(p_listing uuid, p_amount_paise bigint)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  l listings;
  inst institutes;
  conv uuid;
  oid uuid;
begin
  if me is null then
    raise exception 'not_authenticated';
  end if;
  select * into l from listings where id = p_listing for update;
  if l.id is null or l.status <> 'active' or l.kind <> 'sale' then
    raise exception 'listing_unavailable';
  end if;
  if l.listing_type <> 'fixed_offers' then
    raise exception 'offers_not_enabled';
  end if;
  select * into inst from institutes where id = l.institute_id;
  if not coalesce((inst.settings ->> 'offers_enabled')::boolean, false) then
    raise exception 'offers_disabled';
  end if;
  if p_amount_paise is null or p_amount_paise <= 0 or p_amount_paise > l.price_paise then
    raise exception 'invalid_amount';
  end if;
  conv := start_conversation(p_listing); -- checks verification, blocks, ownership
  insert into offers (listing_id, conversation_id, buyer_id, seller_id, made_by, amount_paise, expires_at)
  values (p_listing, conv, me, l.seller_id, me, p_amount_paise,
          now() + make_interval(hours => coalesce((inst.settings ->> 'offer_expiry_hours')::int, 48)))
  returning id into oid;
  insert into messages (conversation_id, sender_id, kind, body, offer_id)
  values (conv, me, 'offer', 'Offered ' || format_inr(p_amount_paise), oid);
  perform push_notification(l.seller_id, 'offer_received', 'New offer: ' || format_inr(p_amount_paise),
    'For "' || l.title || '" (listed at ' || format_inr(l.price_paise) || ')', '/messages/' || conv);
  return oid;
exception
  when unique_violation then
    raise exception 'offer_already_pending';
end;
$$;

create or replace function public.respond_offer(p_offer uuid, p_action text, p_counter_paise bigint default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  o offers;
  l listings;
  inst institutes;
  recipient uuid;
  new_id uuid;
begin
  if me is null then
    raise exception 'not_authenticated';
  end if;
  select * into o from offers where id = p_offer for update;
  if o.id is null or me not in (o.buyer_id, o.seller_id) then
    raise exception 'offer_not_found';
  end if;
  -- Lock the listing so two acceptances cannot interleave.
  select * into l from listings where id = o.listing_id for update;
  recipient := case when o.made_by = o.buyer_id then o.seller_id else o.buyer_id end;
  if me <> recipient then
    raise exception 'not_your_turn';
  end if;
  if o.status <> 'pending' then
    raise exception 'offer_not_pending';
  end if;
  if o.expires_at < now() then
    raise exception 'offer_expired';
  end if;
  if l.status <> 'active' then
    raise exception 'listing_unavailable';
  end if;

  if p_action = 'accept' then
    update offers set status = 'accepted', responded_at = now() where id = o.id;
    update listings set status = 'reserved' where id = l.id; -- cancels other pending offers
    update offers set status = 'cancelled', responded_at = now()
     where listing_id = l.id and status = 'pending' and id <> o.id;
    insert into messages (conversation_id, sender_id, kind, body, offer_id)
    values (o.conversation_id, me, 'offer', 'Accepted the offer of ' || format_inr(o.amount_paise), o.id);
    perform push_notification(o.made_by, 'offer_accepted', 'Offer accepted: ' || format_inr(o.amount_paise),
      '"' || l.title || '" is now reserved. Agree on where to meet in Messages.', '/messages/' || o.conversation_id);
    perform audit('offer.accepted', 'offer', o.id::text, jsonb_build_object('listing_id', l.id, 'amount_paise', o.amount_paise));
    return o.id;
  elsif p_action = 'decline' then
    update offers set status = 'declined', responded_at = now() where id = o.id;
    insert into messages (conversation_id, sender_id, kind, body, offer_id)
    values (o.conversation_id, me, 'offer', 'Declined the offer of ' || format_inr(o.amount_paise), o.id);
    perform push_notification(o.made_by, 'offer_declined', 'Offer declined',
      'Your offer of ' || format_inr(o.amount_paise) || ' for "' || l.title || '" was declined.', '/messages/' || o.conversation_id);
    return o.id;
  elsif p_action = 'counter' then
    if p_counter_paise is null or p_counter_paise <= 0 or p_counter_paise > l.price_paise
       or p_counter_paise = o.amount_paise then
      raise exception 'invalid_amount';
    end if;
    select * into inst from institutes where id = l.institute_id;
    update offers set status = 'countered', responded_at = now() where id = o.id;
    insert into offers (listing_id, conversation_id, buyer_id, seller_id, made_by, parent_offer_id, amount_paise, expires_at)
    values (o.listing_id, o.conversation_id, o.buyer_id, o.seller_id, me, o.id, p_counter_paise,
            now() + make_interval(hours => coalesce((inst.settings ->> 'offer_expiry_hours')::int, 48)))
    returning id into new_id;
    insert into messages (conversation_id, sender_id, kind, body, offer_id)
    values (o.conversation_id, me, 'offer', 'Countered with ' || format_inr(p_counter_paise), new_id);
    perform push_notification(o.made_by, 'offer_countered', 'Counteroffer: ' || format_inr(p_counter_paise),
      'For "' || l.title || '"', '/messages/' || o.conversation_id);
    return new_id;
  else
    raise exception 'invalid_action';
  end if;
end;
$$;

create or replace function public.withdraw_offer(p_offer uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  o offers;
begin
  select * into o from offers where id = p_offer for update;
  if o.id is null or o.made_by is distinct from auth.uid() then
    raise exception 'offer_not_found';
  end if;
  if o.status <> 'pending' then
    raise exception 'offer_not_pending';
  end if;
  update offers set status = 'withdrawn', responded_at = now() where id = o.id;
  insert into messages (conversation_id, sender_id, kind, body, offer_id)
  values (o.conversation_id, auth.uid(), 'offer', 'Withdrew the offer of ' || format_inr(o.amount_paise), o.id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Moderation (staff only, always recorded)
-- ---------------------------------------------------------------------------
create or replace function public.require_staff()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not is_staff(auth.uid()) then
    raise exception 'forbidden';
  end if;
end;
$$;

create or replace function public.moderate_listing(p_listing uuid, p_action text, p_reason text, p_report uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  l listings;
begin
  perform require_staff();
  select * into l from listings where id = p_listing for update;
  if l.id is null then
    raise exception 'not_found';
  end if;
  if p_action = 'remove' then
    update listings set status = 'removed', removed_by_moderator = true where id = l.id;
    perform push_notification(l.seller_id, 'moderation', 'Your listing "' || l.title || '" was removed',
      p_reason, '/account/listings?tab=removed');
  elsif p_action = 'restore' then
    update listings set status = 'active', removed_by_moderator = false where id = l.id;
    perform push_notification(l.seller_id, 'moderation', 'Your listing "' || l.title || '" was restored', p_reason, '/product/' || l.id);
  else
    raise exception 'invalid_action';
  end if;
  insert into moderation_actions (moderator_id, action, target_type, target_id, reason, report_id)
  values (auth.uid(), 'listing.' || p_action, 'listing', l.id::text, p_reason, p_report);
  perform audit('listing.' || p_action, 'listing', l.id::text, jsonb_build_object('reason', p_reason));
end;
$$;

create or replace function public.resolve_report(p_report uuid, p_status public.report_status, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform require_staff();
  if p_status = 'open' then
    raise exception 'invalid_status';
  end if;
  update reports set status = p_status, resolution_note = p_note, resolved_by = auth.uid(), resolved_at = now()
   where id = p_report;
  if not found then
    raise exception 'not_found';
  end if;
  insert into moderation_actions (moderator_id, action, target_type, target_id, reason, report_id)
  values (auth.uid(), 'report.' || p_status, 'report', p_report::text, p_note, p_report);
  perform audit('report.' || p_status, 'report', p_report::text, '{}');
end;
$$;

create or replace function public.review_membership(p_membership uuid, p_decision public.membership_status, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform require_staff();
  if p_decision not in ('verified', 'rejected', 'revoked') then
    raise exception 'invalid_status';
  end if;
  update institute_memberships
     set status = p_decision, review_note = p_note, reviewed_by = auth.uid(), reviewed_at = now(),
         verified_at = case when p_decision = 'verified' then now() else verified_at end
   where id = p_membership;
  if not found then
    raise exception 'not_found';
  end if;
  insert into moderation_actions (moderator_id, action, target_type, target_id, reason)
  values (auth.uid(), 'membership.' || p_decision, 'institute_membership', p_membership::text, p_note);
end;
$$;

create or replace function public.set_user_suspension(p_user uuid, p_suspend boolean, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform require_staff();
  if p_user = auth.uid() then
    raise exception 'cannot_suspend_self';
  end if;
  if is_admin(p_user) and not is_admin(auth.uid()) then
    raise exception 'forbidden';
  end if;
  update profiles
     set suspended_at = case when p_suspend then now() else null end,
         suspension_reason = case when p_suspend then p_reason else null end
   where id = p_user;
  if p_suspend then
    update listings set status = 'removed', removed_by_moderator = true
     where seller_id = p_user and status in ('active', 'reserved', 'draft');
  end if;
  insert into moderation_actions (moderator_id, action, target_type, target_id, reason)
  values (auth.uid(), case when p_suspend then 'user.suspend' else 'user.unsuspend' end, 'user', p_user::text, p_reason);
  perform audit(case when p_suspend then 'user.suspend' else 'user.unsuspend' end, 'user', p_user::text,
    jsonb_build_object('reason', p_reason));
end;
$$;

create or replace function public.set_user_role(p_user uuid, p_role public.app_role, p_grant boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin(auth.uid()) then
    raise exception 'forbidden';
  end if;
  if p_grant then
    insert into user_roles (user_id, role, granted_by) values (p_user, p_role, auth.uid()) on conflict do nothing;
  else
    if p_user = auth.uid() and p_role = 'admin' then
      raise exception 'cannot_remove_own_admin';
    end if;
    delete from user_roles where user_id = p_user and role = p_role;
  end if;
  perform audit(case when p_grant then 'role.grant' else 'role.revoke' end, 'user', p_user::text,
    jsonb_build_object('role', p_role));
end;
$$;

-- Marketplace metrics computed from real rows only.
create or replace function public.admin_metrics()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform require_staff();
  return jsonb_build_object(
    'users', (select count(*) from profiles where not is_demo),
    'verified_members', (select count(*) from institute_memberships where status = 'verified'),
    'pending_memberships', (select count(*) from institute_memberships where status = 'pending'),
    'active_listings', (select count(*) from listings where status = 'active' and not is_demo),
    'demo_listings', (select count(*) from listings where is_demo),
    'sold_listings', (select count(*) from listings where status = 'sold' and not is_demo),
    'open_reports', (select count(*) from reports where status = 'open'),
    'conversations', (select count(*) from conversations),
    'messages_7d', (select count(*) from messages where created_at > now() - interval '7 days')
  );
end;
$$;

-- Audit changes to institute configuration and categories.
create or replace function public.audit_config_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform audit(tg_table_name || '.' || lower(tg_op), tg_table_name,
    coalesce(new.id, old.id)::text, jsonb_build_object('new', to_jsonb(new), 'old', to_jsonb(old)));
  return coalesce(new, old);
end;
$$;
create trigger institutes_audit after insert or update or delete on public.institutes
  for each row execute function public.audit_config_change();
create trigger categories_audit after insert or update or delete on public.categories
  for each row execute function public.audit_config_change();

-- Removes the user's footprint before the auth user is deleted. Messages and
-- offers stay for the other party (sender becomes NULL via FK).
create or replace function public.prepare_account_deletion(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update listings set status = 'removed' where seller_id = p_user and status in ('draft', 'active', 'reserved');
  update offers set status = 'cancelled', responded_at = now()
   where status = 'pending' and (buyer_id = p_user or seller_id = p_user);
  perform audit('account.deleted', 'user', p_user::text, '{}');
end;
$$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.institutes enable row level security;
alter table public.app_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.institute_memberships enable row level security;
alter table public.membership_email_codes enable row level security;
alter table public.categories enable row level security;
alter table public.listings enable row level security;
alter table public.listing_images enable row level security;
alter table public.saved_listings enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.offers enable row level security;
alter table public.messages enable row level security;
alter table public.blocks enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.audit_events enable row level security;
alter table public.contact_messages enable row level security;

-- Start from nothing and grant precisely.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

-- institutes / categories / settings: public read, admin write
grant select on public.institutes, public.categories, public.app_settings to anon, authenticated;
grant insert, update on public.institutes, public.categories, public.app_settings to authenticated;
create policy institutes_read on public.institutes for select using (true);
create policy institutes_admin_insert on public.institutes for insert to authenticated with check (is_admin());
create policy institutes_admin_update on public.institutes for update to authenticated using (is_admin()) with check (is_admin());
create policy categories_read on public.categories for select using (is_active or is_staff());
create policy categories_admin_insert on public.categories for insert to authenticated with check (is_admin());
create policy categories_admin_update on public.categories for update to authenticated using (is_admin()) with check (is_admin());
create policy app_settings_read on public.app_settings for select using (true);
create policy app_settings_admin_insert on public.app_settings for insert to authenticated with check (is_admin());
create policy app_settings_admin_update on public.app_settings for update to authenticated using (is_admin()) with check (is_admin());

-- profiles: public card fields for everyone, more for members, own edits only
grant select (id, display_name, avatar_url, account_type, verified_institute_id, is_demo, created_at) on public.profiles to anon;
grant select (id, full_name, display_name, avatar_url, account_type, department, academic_year, designation, bio,
              home_institute_id, verified_institute_id, is_demo, suspended_at, created_at) on public.profiles to authenticated;
grant update (full_name, display_name, avatar_url, account_type, department, academic_year, designation, bio)
  on public.profiles to authenticated;
create policy profiles_read on public.profiles for select using (true);
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- user_roles: users may see their own roles; staff see all; changes via set_user_role()
grant select on public.user_roles to authenticated;
create policy user_roles_read on public.user_roles for select to authenticated using (user_id = auth.uid() or is_staff());

-- memberships: own or staff; changes only through functions
grant select on public.institute_memberships to authenticated;
create policy memberships_read on public.institute_memberships for select to authenticated
  using (user_id = auth.uid() or is_staff());
-- membership_email_codes: no client access at all

-- listings
grant select on public.listings to anon, authenticated;
grant insert (id, institute_id, kind, title, description, category_id, price_paise, condition, listing_type,
              negotiable, brand, model, purchase_date, original_price_paise, status) on public.listings to authenticated;
grant update (title, description, category_id, price_paise, condition, listing_type, negotiable, brand, model,
              purchase_date, original_price_paise, status) on public.listings to authenticated;
grant delete on public.listings to authenticated;
create policy listings_read on public.listings for select using (
  (status in ('active', 'reserved', 'sold') and exists (
     select 1 from institutes i where i.id = institute_id and i.is_active
       and (coalesce((i.settings ->> 'public_browse')::boolean, false) or is_verified_member(auth.uid(), i.id))))
  or seller_id = auth.uid()
  or is_staff()
);
create policy listings_insert on public.listings for insert to authenticated with check (
  seller_id = auth.uid() and is_verified_member(auth.uid(), institute_id)
);
create policy listings_update on public.listings for update to authenticated
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid() and is_verified_member(auth.uid(), institute_id));
create policy listings_delete_draft on public.listings for delete to authenticated
  using (seller_id = auth.uid() and status = 'draft');

grant select on public.listing_images to anon, authenticated;
grant insert (listing_id, storage_path, position, width, height), delete on public.listing_images to authenticated;
grant update (position) on public.listing_images to authenticated;
create policy listing_images_read on public.listing_images for select using (
  exists (select 1 from listings l where l.id = listing_id)
);
create policy listing_images_insert on public.listing_images for insert to authenticated with check (
  exists (select 1 from listings l where l.id = listing_id and l.seller_id = auth.uid())
);
create policy listing_images_update on public.listing_images for update to authenticated using (
  exists (select 1 from listings l where l.id = listing_id and l.seller_id = auth.uid())
);
create policy listing_images_delete on public.listing_images for delete to authenticated using (
  exists (select 1 from listings l where l.id = listing_id and l.seller_id = auth.uid() and not l.removed_by_moderator)
);

-- saved listings
grant select, insert, delete on public.saved_listings to authenticated;
create policy saved_read on public.saved_listings for select to authenticated using (user_id = auth.uid());
create policy saved_insert on public.saved_listings for insert to authenticated with check (
  user_id = auth.uid() and exists (select 1 from listings l where l.id = listing_id)
);
create policy saved_delete on public.saved_listings for delete to authenticated using (user_id = auth.uid());

-- conversations / participants / messages
grant select on public.conversations to authenticated;
create policy conversations_read on public.conversations for select to authenticated
  using (auth.uid() in (initiator_id, owner_id) or is_participant(id));
grant select on public.conversation_participants to authenticated;
create policy participants_read on public.conversation_participants for select to authenticated
  using (is_participant(conversation_id));
grant select on public.messages to authenticated;
grant insert (conversation_id, body) on public.messages to authenticated;
create policy messages_read on public.messages for select to authenticated using (is_participant(conversation_id));
create policy messages_insert on public.messages for insert to authenticated with check (
  is_participant(conversation_id) and sender_id = auth.uid()
);

-- offers: visible to the two parties; changes only via functions
grant select on public.offers to authenticated;
create policy offers_read on public.offers for select to authenticated using (auth.uid() in (buyer_id, seller_id));

-- blocks
grant select, insert, delete on public.blocks to authenticated;
create policy blocks_own_read on public.blocks for select to authenticated using (blocker_id = auth.uid());
create policy blocks_own_insert on public.blocks for insert to authenticated with check (blocker_id = auth.uid());
create policy blocks_own_delete on public.blocks for delete to authenticated using (blocker_id = auth.uid());

-- notifications: own; only read_at is writable
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy notifications_read on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- reports
grant select on public.reports to authenticated;
grant insert (listing_id, reported_user_id, conversation_id, reason, details) on public.reports to authenticated;
create policy reports_insert on public.reports for insert to authenticated with check (
  reporter_id = auth.uid()
  and (listing_id is null or exists (select 1 from listings l where l.id = listing_id))
  and (conversation_id is null or is_participant(conversation_id))
);
create policy reports_read on public.reports for select to authenticated using (reporter_id = auth.uid() or is_staff());
create or replace function public.reports_set_reporter()
returns trigger language plpgsql as $$
begin
  if not is_privileged() then
    new.reporter_id := auth.uid();
    new.status := 'open';
  end if;
  return new;
end;
$$;
create trigger reports_set_reporter before insert on public.reports
  for each row execute function public.reports_set_reporter();

-- moderation log / audit: staff read only
grant select on public.moderation_actions, public.audit_events to authenticated;
create policy moderation_read on public.moderation_actions for select to authenticated using (is_staff());
create policy audit_read on public.audit_events for select to authenticated using (is_staff());

-- contact form
grant insert (name, email, subject, body) on public.contact_messages to anon, authenticated;
grant select on public.contact_messages to authenticated;
grant update (handled) on public.contact_messages to authenticated;
create policy contact_insert on public.contact_messages for insert with check (true);
create policy contact_read on public.contact_messages for select to authenticated using (is_staff());
create policy contact_update on public.contact_messages for update to authenticated using (is_staff());
create or replace function public.contact_set_user()
returns trigger language plpgsql as $$
begin
  if not is_privileged() then
    new.user_id := auth.uid();
    new.handled := false;
    new.created_at := now();
  end if;
  return new;
end;
$$;
create trigger contact_set_user before insert on public.contact_messages
  for each row execute function public.contact_set_user();

-- Callable functions
grant execute on function public.is_staff(uuid), public.is_admin(uuid), public.is_verified_member(uuid, text),
  public.is_privileged(), public.is_participant(uuid, uuid), public.is_blocked_between(uuid, uuid),
  public.format_inr(bigint)
  to anon, authenticated;
grant execute on function
  public.request_manual_review(text, text),
  public.start_conversation(uuid),
  public.mark_conversation_read(uuid),
  public.unread_conversation_count(),
  public.make_offer(uuid, bigint),
  public.respond_offer(uuid, text, bigint),
  public.withdraw_offer(uuid),
  public.my_listing_stats(uuid[]),
  public.moderate_listing(uuid, text, text, uuid),
  public.resolve_report(uuid, public.report_status, text),
  public.review_membership(uuid, public.membership_status, text),
  public.set_user_suspension(uuid, boolean, text),
  public.set_user_role(uuid, public.app_role, boolean),
  public.admin_metrics()
  to authenticated;
-- Server-only (service role)
grant execute on function
  public.membership_request_email_code(uuid, text, text, text, int),
  public.membership_confirm_email_code(uuid, text, text),
  public.prepare_account_deletion(uuid)
  to service_role;
-- Trigger functions run as their owner; they must not be callable directly.
-- (Already revoked above via "revoke all on all functions".)

-- ---------------------------------------------------------------------------
-- Storage: listing photos and avatars
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('listing-images', 'listing-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "upload own listing images" on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own listing images" on storage.objects for delete to authenticated
  using (bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "upload own avatar" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "replace own avatar" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own avatar" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Realtime for chat and the notification bell (RLS still applies)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages, public.notifications;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------
insert into public.institutes (id, official_name, display_name, short_name, email_domains, email_domains_confirmed,
                               city, state, latitude, longitude, is_active)
values ('nit-sikkim', 'National Institute of Technology Sikkim', 'NIT Sikkim', 'NITS',
        -- Unconfirmed until an administrator confirms the official domain(s).
        array['nitsikkim.ac.in'], false,
        'Ravangla', 'Sikkim', null, null, true);

insert into public.categories (id, name, icon, sort_order) values
  ('books', 'Books & Academics', 'book', 10),
  ('electronics', 'Electronics', 'laptop', 20),
  ('hostel', 'Hostel Essentials', 'bed', 30),
  ('cycles', 'Cycles', 'bike', 40),
  ('fashion', 'Fashion', 'shirt', 50),
  ('gaming', 'Gaming', 'gamepad', 60),
  ('study', 'Study Essentials', 'calculator', 70),
  ('other', 'Other', 'box', 90);

insert into public.app_settings (key, value, description) values
  ('cross_campus_enabled', 'false', 'Cross-campus discovery. Keep off until more institutes are onboarded.'),
  ('auctions_enabled', 'false', 'Auction-style listings. Not implemented; requires legal review (docs/AUCTIONS.md).'),
  ('online_payments_enabled', 'false', 'Online payments. Not implemented; requires a payment gateway and compliance review.');
