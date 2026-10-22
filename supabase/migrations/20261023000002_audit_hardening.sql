-- Security and data-integrity fixes from docs/AUDIT.md.
-- Additive and backward compatible: no data is deleted; replaced functions keep
-- their signatures; policies are dropped and recreated in the same transaction.

-- ---------------------------------------------------------------------------
-- Rate limiting (H3, H2)
-- ---------------------------------------------------------------------------
create table public.rate_limit_events (
  id bigint generated always as identity primary key,
  key text not null,
  created_at timestamptz not null default now()
);
create index rate_limit_events_key on public.rate_limit_events (key, created_at desc);
alter table public.rate_limit_events enable row level security; -- no policies: no client access

-- Records one hit for p_key and returns false (without recording) when the
-- key already has p_max hits inside p_window. Serialised per key.
create or replace function public.rate_limit_hit(p_key text, p_max int, p_window interval)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_key, 0));
  select count(*) into n from rate_limit_events where key = p_key and created_at > now() - p_window;
  if n >= p_max then
    return false;
  end if;
  insert into rate_limit_events (key) values (p_key);
  if random() < 0.01 then
    delete from rate_limit_events where created_at < now() - interval '2 days';
  end if;
  return true;
end;
$$;

-- Per-user limit for the current caller; raises 'rate_limited'. Keyed on
-- auth.uid() so a caller can only consume their own quota.
create or replace function public.consume_rate(p_action text, p_max int, p_window interval)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return;
  end if;
  if not rate_limit_hit('u:' || auth.uid() || ':' || p_action, p_max, p_window) then
    raise exception 'rate_limited';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Helper functions no longer answer questions about other users (M4)
-- ---------------------------------------------------------------------------
-- True for requests made by end users (PostgREST sets the role GUC). Unlike
-- current_user, this is unchanged inside SECURITY DEFINER functions.
create or replace function public.caller_is_end_user()
returns boolean language sql stable as $$
  select coalesce(nullif(current_setting('role', true), ''), 'none') in ('anon', 'authenticated');
$$;

-- Internal only (not granted to end users).
create or replace function public.has_role(uid uuid, roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = uid and role = any (roles));
$$;

create or replace function public.is_staff(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(uid = auth.uid() or not caller_is_end_user(), false) and has_role(uid, '{admin,moderator}');
$$;

create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(uid = auth.uid() or not caller_is_end_user(), false) and has_role(uid, '{admin}');
$$;

create or replace function public.is_verified_member(uid uuid, inst text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(uid = auth.uid() or not caller_is_end_user(), false) and exists (
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
  select coalesce(auth.uid() in (a, b) or not caller_is_end_user(), false) and exists (
    select 1 from blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

create or replace function public.is_participant(p_conv uuid, uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(uid = auth.uid() or not caller_is_end_user(), false)
     and exists (select 1 from conversation_participants where conversation_id = p_conv and user_id = uid);
$$;

-- L3: only admins may suspend staff.
create or replace function public.set_user_suspension(p_user uuid, p_suspend boolean, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform require_staff();
  if p_user = auth.uid() then
    raise exception 'cannot_suspend_self';
  end if;
  if has_role(p_user, '{admin,moderator}') and not has_role(auth.uid(), '{admin}') then
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

-- ---------------------------------------------------------------------------
-- Institute email codes: per-email limit (H2)
-- ---------------------------------------------------------------------------
create index membership_email_codes_email on public.membership_email_codes (email, created_at desc);

create or replace function public.membership_request_email_code(
  p_user uuid, p_institute text, p_email text, p_code_hash text, p_ttl_minutes int default 15
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  inst institutes;
  v_email text := lower(trim(p_email));
  v_domain text := split_part(lower(trim(p_email)), '@', 2);
  mem institute_memberships;
  recent int;
begin
  select * into inst from institutes where id = p_institute;
  if inst.id is null or not inst.is_active then
    raise exception 'institute_not_available';
  end if;
  if not inst.email_domains_confirmed or not (v_domain = any (inst.email_domains)) then
    raise exception 'email_domain_not_accepted';
  end if;
  if exists (
    select 1 from institute_memberships
    where institute_id = p_institute and institute_email = v_email and status = 'verified' and user_id <> p_user
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

  -- Per account.
  select count(*) into recent
    from membership_email_codes c
    join institute_memberships m on m.id = c.membership_id
   where m.user_id = p_user and c.created_at > now() - interval '1 hour';
  if recent >= 5 then
    raise exception 'too_many_codes';
  end if;
  -- Per target address, across all accounts: caps guesses and inbox flooding.
  select count(*) into recent
    from membership_email_codes
   where email = v_email and created_at > now() - interval '1 hour';
  if recent >= 3 then
    raise exception 'too_many_codes_for_email';
  end if;

  insert into institute_memberships (user_id, institute_id, status, method, institute_email)
  values (p_user, p_institute, 'pending', 'institute_email', v_email)
  on conflict (user_id, institute_id) do update
    set status = 'pending', method = 'institute_email', institute_email = excluded.institute_email
  returning * into mem;

  update membership_email_codes set consumed_at = now()
   where membership_id = mem.id and consumed_at is null;
  insert into membership_email_codes (membership_id, email, code_hash, expires_at)
  values (mem.id, v_email, p_code_hash, now() + make_interval(mins => p_ttl_minutes));
  return mem.id;
end;
$$;

create or replace function public.request_manual_review(p_institute text, p_note text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  inst institutes;
  mem institute_memberships;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  perform consume_rate('manual_review', 5, interval '1 day');
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

-- M5: losing membership takes the member's listings off the marketplace.
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
    update listings set status = 'removed'
     where seller_id = new.user_id and institute_id = new.institute_id and status in ('active', 'reserved');
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

-- ---------------------------------------------------------------------------
-- Listings
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
      perform consume_rate('listing', 30, interval '1 day');
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
      -- L2: an item for sale can't go live without a photo.
      if new.status = 'active' and old.status = 'draft' and new.kind = 'sale'
         and not exists (select 1 from listing_images where listing_id = new.id) then
        raise exception 'photo_required';
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

-- H5: a sale completes the accepted offer instead of leaving it 'accepted'.
create or replace function public.listings_after_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status in ('sold', 'removed', 'draft', 'expired') then
    for r in
      update offers set status = 'cancelled', responded_at = now()
       where listing_id = new.id and status = 'pending'
      returning id, buyer_id
    loop
      perform push_notification(r.buyer_id, 'offer_cancelled', 'An offer on "' || new.title || '" was closed',
        'The listing is no longer available for offers.', '/product/' || new.id);
    end loop;
  end if;

  if new.status = 'sold' then
    update offers set status = 'completed', responded_at = coalesce(responded_at, now())
     where listing_id = new.id and status = 'accepted';
  elsif old.status = 'reserved' and new.status in ('active', 'draft', 'removed') then
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

-- Backfill for any data created before this migration.
update public.offers o set status = 'completed'
  from public.listings l
 where l.id = o.listing_id and l.status = 'sold' and o.status = 'accepted';

-- M8: one transaction for the listing, its photos and publishing. Runs as the
-- caller, so RLS and the guards above all apply.
create or replace function public.save_listing(
  p_id uuid, p_kind public.listing_kind, p_institute text, p_fields jsonb, p_images text[], p_publish boolean
) returns uuid language plpgsql set search_path = public as $$
declare
  me uuid := auth.uid();
  cur listings;
  imgs text[] := coalesce(p_images, '{}');
  n int := coalesce(array_length(coalesce(p_images, '{}'), 1), 0);
begin
  if me is null then
    raise exception 'not_authenticated';
  end if;
  if n > 0 and exists (
    select 1 from unnest(imgs) x
     where x not like me::text || '/' || p_id::text || '/%' or x like '%..%'
  ) then
    raise exception 'invalid_image_path';
  end if;
  if p_publish and p_kind = 'sale' and n = 0 then
    raise exception 'photo_required';
  end if;

  select * into cur from listings where id = p_id;
  if cur.id is not null and cur.seller_id is distinct from me then
    raise exception 'not_owner';
  end if;

  if cur.id is null then
    insert into listings (id, institute_id, kind, status, title, description, category_id, price_paise, condition,
                          listing_type, negotiable, brand, model, purchase_date, original_price_paise)
    values (p_id, p_institute, p_kind, 'draft', p_fields ->> 'title', p_fields ->> 'description', p_fields ->> 'category_id',
            (p_fields ->> 'price_paise')::bigint, (p_fields ->> 'condition')::item_condition,
            coalesce((p_fields ->> 'listing_type')::listing_type, 'fixed'), coalesce((p_fields ->> 'negotiable')::boolean, false),
            p_fields ->> 'brand', p_fields ->> 'model', (p_fields ->> 'purchase_date')::date,
            (p_fields ->> 'original_price_paise')::bigint);
  else
    if cur.kind <> p_kind then
      raise exception 'immutable_field';
    end if;
    update listings set
      title = p_fields ->> 'title',
      description = p_fields ->> 'description',
      category_id = p_fields ->> 'category_id',
      price_paise = (p_fields ->> 'price_paise')::bigint,
      condition = (p_fields ->> 'condition')::item_condition,
      listing_type = coalesce((p_fields ->> 'listing_type')::listing_type, 'fixed'),
      negotiable = coalesce((p_fields ->> 'negotiable')::boolean, false),
      brand = p_fields ->> 'brand',
      model = p_fields ->> 'model',
      purchase_date = (p_fields ->> 'purchase_date')::date,
      original_price_paise = (p_fields ->> 'original_price_paise')::bigint
    where id = p_id;
  end if;

  delete from listing_images where listing_id = p_id and not (storage_path = any (imgs));
  for i in 1..n loop
    update listing_images set position = i - 1 where listing_id = p_id and storage_path = imgs[i];
    if not found then
      insert into listing_images (listing_id, storage_path, position) values (p_id, imgs[i], i - 1);
    end if;
  end loop;

  if p_publish and (cur.id is null or cur.status = 'draft') then
    update listings set status = 'active' where id = p_id;
  end if;
  return p_id;
exception
  when unique_violation then
    -- The id belongs to a listing the caller can't see (someone else's).
    raise exception 'not_owner';
end;
$$;

-- ---------------------------------------------------------------------------
-- Offers (H4) and conversations
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
  perform consume_rate('offer', 40, interval '1 day');
  -- Offers past their expiry no longer block a new one.
  update offers set status = 'expired'
   where listing_id = p_listing and buyer_id = me and status = 'pending' and expires_at < now();
  conv := start_conversation(p_listing);
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
  if l.id is null or l.status not in ('active', 'reserved') or l.seller_id is null then
    raise exception 'listing_unavailable';
  end if;
  if l.seller_id = me then
    raise exception 'own_listing';
  end if;
  if not is_verified_member(me, l.institute_id) then
    raise exception 'not_verified';
  end if;
  if is_blocked_between(me, l.seller_id) then
    raise exception 'blocked';
  end if;

  select id into conv from conversations where listing_id = p_listing and initiator_id = me;
  if conv is null then
    perform consume_rate('conversation', 60, interval '1 day');
    insert into conversations (listing_id, institute_id, initiator_id, owner_id)
    values (p_listing, l.institute_id, me, l.seller_id)
    returning id into conv;
    insert into conversation_participants (conversation_id, user_id, last_read_at)
    values (conv, me, now()), (conv, l.seller_id, 'epoch');
  end if;
  return conv;
end;
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
    if exists (select 1 from my_profile_flags() f where f.suspended) then
      raise exception 'account_suspended';
    end if;
    if other is null then
      raise exception 'participant_left';
    end if;
    if is_blocked_between(auth.uid(), other) then
      raise exception 'blocked';
    end if;
    perform consume_rate('message_min', 20, interval '1 minute');
    perform consume_rate('message_day', 500, interval '1 day');
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles: smaller exposure (M3), validated avatars (L6), own context (M13)
-- ---------------------------------------------------------------------------
create or replace function public.my_profile_flags()
returns table (suspended boolean) language sql stable security definer set search_path = public as $$
  select suspended_at is not null from profiles where id = auth.uid();
$$;

revoke select (suspended_at, home_institute_id) on public.profiles from authenticated;

drop policy profiles_read on public.profiles;
-- Anyone may see the public card of members who have a visible listing.
create policy profiles_read_sellers on public.profiles for select to anon, authenticated
  using (exists (select 1 from listings l where l.seller_id = profiles.id));
-- Signed-in users also see themselves, people they chat with or blocked; staff see all.
create policy profiles_read_related on public.profiles for select to authenticated using (
  id = (select auth.uid())
  or (select is_staff())
  or exists (select 1 from conversations c where profiles.id in (c.initiator_id, c.owner_id))
  or exists (select 1 from blocks b where b.blocker_id = (select auth.uid()) and b.blocked_id = profiles.id)
);

create or replace function public.profiles_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if not is_privileged() and new.avatar_url is distinct from old.avatar_url and new.avatar_url is not null
     and (new.avatar_url not like new.id::text || '/%' or new.avatar_url like '%..%') then
    raise exception 'invalid_avatar';
  end if;
  return new;
end;
$$;
create trigger profiles_guard before update on public.profiles for each row execute function public.profiles_guard();

-- Everything the app needs about the signed-in user, in one round trip.
create or replace function public.my_context()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when auth.uid() is null then null else jsonb_build_object(
    'profile', (select to_jsonb(p) - 'suspension_reason' from profiles p where p.id = auth.uid()),
    'memberships', coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at) from institute_memberships m where m.user_id = auth.uid()), '[]'),
    'roles', coalesce((select jsonb_agg(r.role) from user_roles r where r.user_id = auth.uid()), '[]')
  ) end;
$$;

create or replace function public.my_unread_counts()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'messages', unread_conversation_count(),
    'notifications', (select count(*) from notifications where user_id = auth.uid() and read_at is null)
  );
$$;

-- L1: latest message and unread state per conversation (caller's RLS applies).
create or replace function public.conversation_previews(p_ids uuid[])
returns table (conversation_id uuid, body text, sender_id uuid, created_at timestamptz, unread boolean)
language sql stable set search_path = public as $$
  select c.id, m.body, m.sender_id, m.created_at,
         coalesce(m.sender_id is distinct from auth.uid() and m.created_at > p.last_read_at, false)
    from conversations c
    left join conversation_participants p on p.conversation_id = c.id and p.user_id = auth.uid()
    left join lateral (
      select body, sender_id, created_at from messages
       where messages.conversation_id = c.id order by created_at desc limit 1
    ) m on true
   where c.id = any (p_ids);
$$;

-- Staff view of users, including suspension state that members can't read.
create or replace function public.admin_list_users(p_query text default null, p_limit int default 100)
returns table (id uuid, full_name text, display_name text, account_type public.account_type, verified_institute_id text,
               is_demo boolean, suspended_at timestamptz, suspension_reason text, created_at timestamptz, roles public.app_role[])
language plpgsql stable security definer set search_path = public as $$
begin
  perform require_staff();
  return query
    select p.id, p.full_name, p.display_name, p.account_type, p.verified_institute_id, p.is_demo, p.suspended_at,
           p.suspension_reason, p.created_at,
           coalesce((select array_agg(r.role) from user_roles r where r.user_id = p.id), '{}')
      from profiles p
     where p_query is null or p.full_name ilike '%' || p_query || '%' or p.display_name ilike '%' || p_query || '%'
     order by p.created_at desc
     limit least(greatest(p_limit, 1), 200);
end;
$$;

-- ---------------------------------------------------------------------------
-- Reports survive account deletion (H6)
-- ---------------------------------------------------------------------------
alter table public.reports add column subject_snapshot jsonb;
alter table public.reports drop constraint reports_check;
alter table public.reports drop constraint reports_reported_user_id_fkey,
  add constraint reports_reported_user_id_fkey foreign key (reported_user_id) references public.profiles (id) on delete set null;
alter table public.reports drop constraint reports_listing_id_fkey,
  add constraint reports_listing_id_fkey foreign key (listing_id) references public.listings (id) on delete set null;

create or replace function public.reports_set_reporter()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if caller_is_end_user() then
    new.reporter_id := auth.uid();
    new.status := 'open';
    perform consume_rate('report', 20, interval '1 day');
  end if;
  if new.listing_id is null and new.reported_user_id is null then
    raise exception 'report_target_required';
  end if;
  new.subject_snapshot := jsonb_build_object(
    'reported_user_id', new.reported_user_id,
    'reported_display_name', (select display_name from profiles where id = new.reported_user_id),
    'listing_id', new.listing_id,
    'listing_title', (select title from listings where id = new.listing_id),
    'listing_seller_id', (select seller_id from listings where id = new.listing_id)
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Contact form goes through the server, which rate-limits by IP (H3)
-- ---------------------------------------------------------------------------
revoke insert on public.contact_messages from anon, authenticated;
drop policy contact_insert on public.contact_messages;

-- ---------------------------------------------------------------------------
-- Index-friendly policies (M7) and closing listings when unverified (M5)
-- ---------------------------------------------------------------------------
drop policy conversations_read on public.conversations;
create policy conversations_read on public.conversations for select to authenticated
  using ((select auth.uid()) in (initiator_id, owner_id));

drop policy listings_read on public.listings;
create policy listings_read on public.listings for select using (
  seller_id = (select auth.uid())
  or (select is_staff())
  or (status in ('active', 'reserved', 'sold') and exists (
     select 1 from institutes i where i.id = institute_id and i.is_active
       and (coalesce((i.settings ->> 'public_browse')::boolean, false) or is_verified_member((select auth.uid()), i.id))))
);

drop policy listings_update on public.listings;
create policy listings_update on public.listings for update to authenticated
  using (seller_id = (select auth.uid()))
  with check (
    seller_id = (select auth.uid())
    and (is_verified_member((select auth.uid()), institute_id) or status in ('sold', 'removed', 'draft'))
  );

drop policy offers_read on public.offers;
create policy offers_read on public.offers for select to authenticated using ((select auth.uid()) in (buyer_id, seller_id));

drop policy notifications_read on public.notifications;
create policy notifications_read on public.notifications for select to authenticated using (user_id = (select auth.uid()));
drop policy notifications_update on public.notifications;
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy saved_read on public.saved_listings;
create policy saved_read on public.saved_listings for select to authenticated using (user_id = (select auth.uid()));

-- L8: indexes for policy filters and FK actions.
create index offers_buyer on public.offers (buyer_id, created_at desc);
create index offers_seller on public.offers (seller_id, created_at desc);
create index messages_sender on public.messages (sender_id);
create index reports_reporter on public.reports (reporter_id);
create index reports_reported_user on public.reports (reported_user_id);
create index reports_listing on public.reports (listing_id);
create index blocks_blocked on public.blocks (blocked_id);

-- ---------------------------------------------------------------------------
-- Privileges. Supabase's default privileges grant every new function to anon
-- and authenticated, so reset and grant explicitly (see docs/ARCHITECTURE.md).
-- ---------------------------------------------------------------------------
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on public.rate_limit_events from anon, authenticated;

grant execute on function
  public.is_staff(uuid), public.is_admin(uuid), public.is_verified_member(uuid, text), public.is_privileged(),
  public.is_participant(uuid, uuid), public.is_blocked_between(uuid, uuid), public.format_inr(bigint),
  public.caller_is_end_user()
  to anon, authenticated;
grant execute on function
  public.consume_rate(text, int, interval),
  public.my_profile_flags(),
  public.request_manual_review(text, text),
  public.start_conversation(uuid),
  public.mark_conversation_read(uuid),
  public.unread_conversation_count(),
  public.make_offer(uuid, bigint),
  public.respond_offer(uuid, text, bigint),
  public.withdraw_offer(uuid),
  public.my_listing_stats(uuid[]),
  public.save_listing(uuid, public.listing_kind, text, jsonb, text[], boolean),
  public.my_context(),
  public.my_unread_counts(),
  public.conversation_previews(uuid[]),
  public.admin_list_users(text, int),
  public.moderate_listing(uuid, text, text, uuid),
  public.resolve_report(uuid, public.report_status, text),
  public.review_membership(uuid, public.membership_status, text),
  public.set_user_suspension(uuid, boolean, text),
  public.set_user_role(uuid, public.app_role, boolean),
  public.admin_metrics()
  to authenticated;
grant execute on function
  public.membership_request_email_code(uuid, text, text, text, int),
  public.membership_confirm_email_code(uuid, text, text),
  public.prepare_account_deletion(uuid),
  public.rate_limit_hit(text, int, interval)
  to service_role;
