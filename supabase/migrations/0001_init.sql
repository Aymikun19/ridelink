-- =====================================================================
-- RideLink schema
-- Run in the Supabase SQL editor (or `supabase db push`) on a fresh project.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  email          text not null,
  full_name      text,
  phone          text,
  role           text check (role in ('customer', 'driver')),
  vehicle_make   text,
  vehicle_model  text,
  vehicle_color  text,
  plate_number   text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Role can be chosen once. Email is owned by auth.users.
create or replace function public.guard_profile_update()
returns trigger language plpgsql as $$
begin
  if old.role is not null and new.role is distinct from old.role then
    raise exception 'Role cannot be changed once set';
  end if;
  new.email := old.email;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.guard_profile_update();

create or replace function public.app_user_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- Driver live status / location
-- ---------------------------------------------------------------------
create table if not exists public.driver_status (
  driver_id   uuid primary key references public.profiles (id) on delete cascade,
  is_online   boolean not null default false,
  lat         double precision,
  lng         double precision,
  heading     double precision,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Rides
-- ---------------------------------------------------------------------
create table if not exists public.rides (
  id                uuid primary key default gen_random_uuid(),
  customer_id       uuid not null references public.profiles (id) on delete cascade,
  driver_id         uuid references public.profiles (id) on delete set null,
  status            text not null default 'requested'
                    check (status in ('requested','accepted','arrived','in_progress','completed','cancelled')),
  pickup_address    text not null,
  pickup_lat        double precision not null,
  pickup_lng        double precision not null,
  dropoff_address   text not null,
  dropoff_lat       double precision not null,
  dropoff_lng       double precision not null,
  distance_m        integer,
  duration_s        integer,
  notes             text check (char_length(notes) <= 280),
  cancelled_by      uuid references public.profiles (id),
  cancel_reason     text,
  customer_rating   smallint check (customer_rating between 1 and 5),
  customer_feedback text check (char_length(customer_feedback) <= 500),
  requested_at      timestamptz not null default now(),
  accepted_at       timestamptz,
  arrived_at        timestamptz,
  started_at        timestamptz,
  completed_at      timestamptz,
  cancelled_at      timestamptz
);

create index if not exists rides_status_idx on public.rides (status, requested_at desc);
create index if not exists rides_customer_idx on public.rides (customer_id, requested_at desc);
create index if not exists rides_driver_idx on public.rides (driver_id, requested_at desc);

-- One active ride per customer and per driver.
create unique index if not exists one_active_ride_per_customer
  on public.rides (customer_id)
  where status in ('requested','accepted','arrived','in_progress');

create unique index if not exists one_active_ride_per_driver
  on public.rides (driver_id)
  where driver_id is not null and status in ('accepted','arrived','in_progress');

create table if not exists public.ride_declines (
  ride_id    uuid not null references public.rides (id) on delete cascade,
  driver_id  uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (ride_id, driver_id)
);

create or replace function public.is_ride_participant(p_ride text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.rides r
    where r.id::text = p_ride
      and (r.customer_id = auth.uid() or r.driver_id = auth.uid())
  );
$$;

-- ---------------------------------------------------------------------
-- Messages (text + voice notes) scoped to a ride
-- ---------------------------------------------------------------------
create table if not exists public.messages (
  id                 uuid primary key default gen_random_uuid(),
  ride_id            uuid not null references public.rides (id) on delete cascade,
  sender_id          uuid not null references public.profiles (id) on delete cascade,
  kind               text not null check (kind in ('text','voice')),
  body               text check (char_length(body) <= 2000),
  audio_path         text,
  audio_duration_ms  integer,
  read_at            timestamptz,
  created_at         timestamptz not null default now(),
  constraint message_payload check (
    (kind = 'text' and body is not null and char_length(trim(body)) > 0)
    or (kind = 'voice' and audio_path is not null)
  )
);

create index if not exists messages_ride_idx on public.messages (ride_id, created_at);

-- ---------------------------------------------------------------------
-- Message templates (text and recorded voice). user_id null = built-in.
-- ---------------------------------------------------------------------
create table if not exists public.message_templates (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references public.profiles (id) on delete cascade,
  role               text check (role in ('customer','driver')),
  kind               text not null check (kind in ('text','voice')),
  title              text not null check (char_length(title) between 1 and 60),
  body               text check (char_length(body) <= 500),
  audio_path         text,
  audio_duration_ms  integer,
  sort_order         integer not null default 0,
  created_at         timestamptz not null default now(),
  constraint template_payload check (
    (kind = 'text' and body is not null) or (kind = 'voice' and audio_path is not null)
  )
);

create index if not exists templates_user_idx on public.message_templates (user_id, sort_order);

-- Built-in quick replies (functional defaults, users add their own).
insert into public.message_templates (user_id, role, kind, title, body, sort_order)
select * from (values
  (null::uuid, 'driver',   'text', 'On my way',         'I am on my way to the pickup point.', 1),
  (null::uuid, 'driver',   'text', 'Arrived',           'I have arrived at the pickup point.', 2),
  (null::uuid, 'driver',   'text', 'Running late',      'Traffic is heavy, I will be a few minutes late.', 3),
  (null::uuid, 'driver',   'text', 'Confirm location',  'Please confirm your exact pickup location.', 4),
  (null::uuid, 'customer', 'text', 'Coming out',        'I am coming out now.', 1),
  (null::uuid, 'customer', 'text', 'Wait please',       'Please wait for me, I will be there shortly.', 2),
  (null::uuid, 'customer', 'text', 'Where are you',     'Where are you right now?', 3),
  (null::uuid, 'customer', 'text', 'Call me',           'Please call me when you arrive.', 4)
) as t(user_id, role, kind, title, body, sort_order)
where not exists (select 1 from public.message_templates where user_id is null);

-- ---------------------------------------------------------------------
-- OTP codes (service role only; no client policies)
-- ---------------------------------------------------------------------
create table if not exists public.otp_codes (
  email         text primary key,
  code_hash     text not null,
  expires_at    timestamptz not null,
  attempts      integer not null default 0,
  last_sent_at  timestamptz not null default now(),
  send_count    integer not null default 1,
  window_start  timestamptz not null default now()
);

-- =====================================================================
-- Row level security
-- =====================================================================
alter table public.profiles          enable row level security;
alter table public.driver_status     enable row level security;
alter table public.rides             enable row level security;
alter table public.ride_declines     enable row level security;
alter table public.messages          enable row level security;
alter table public.message_templates enable row level security;
alter table public.otp_codes         enable row level security;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid()
  or exists (
    select 1 from public.rides r
    where (r.customer_id = auth.uid() and r.driver_id = profiles.id)
       or (r.driver_id = auth.uid() and r.customer_id = profiles.id)
       or (r.status = 'requested' and r.customer_id = profiles.id and public.app_user_role() = 'driver')
  )
);

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- driver_status
drop policy if exists driver_status_select on public.driver_status;
create policy driver_status_select on public.driver_status for select to authenticated using (
  driver_id = auth.uid()
  or exists (
    select 1 from public.rides r
    where r.driver_id = driver_status.driver_id
      and r.customer_id = auth.uid()
      and r.status in ('accepted','arrived','in_progress')
  )
);

drop policy if exists driver_status_insert on public.driver_status;
create policy driver_status_insert on public.driver_status for insert to authenticated
  with check (driver_id = auth.uid() and public.app_user_role() = 'driver');

drop policy if exists driver_status_update on public.driver_status;
create policy driver_status_update on public.driver_status for update to authenticated
  using (driver_id = auth.uid()) with check (driver_id = auth.uid());

-- rides
drop policy if exists rides_select on public.rides;
create policy rides_select on public.rides for select to authenticated using (
  customer_id = auth.uid()
  or driver_id = auth.uid()
  or (status = 'requested' and public.app_user_role() = 'driver')
);

drop policy if exists rides_insert on public.rides;
create policy rides_insert on public.rides for insert to authenticated with check (
  customer_id = auth.uid()
  and driver_id is null
  and status = 'requested'
  and public.app_user_role() = 'customer'
);
-- No direct UPDATE/DELETE. State changes go through the functions below.

-- ride_declines
drop policy if exists declines_select on public.ride_declines;
create policy declines_select on public.ride_declines for select to authenticated
  using (driver_id = auth.uid());

-- messages
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages for select to authenticated
  using (public.is_ride_participant(ride_id::text));

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated with check (
  sender_id = auth.uid()
  and read_at is null
  and exists (
    select 1 from public.rides r
    where r.id = messages.ride_id
      and r.driver_id is not null
      and (r.customer_id = auth.uid() or r.driver_id = auth.uid())
  )
);

-- message_templates
drop policy if exists templates_select on public.message_templates;
create policy templates_select on public.message_templates for select to authenticated using (
  user_id = auth.uid()
  or (user_id is null and (role is null or role = public.app_user_role()))
);

drop policy if exists templates_insert on public.message_templates;
create policy templates_insert on public.message_templates for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists templates_update on public.message_templates;
create policy templates_update on public.message_templates for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists templates_delete on public.message_templates;
create policy templates_delete on public.message_templates for delete to authenticated
  using (user_id = auth.uid());

-- =====================================================================
-- Ride lifecycle functions
-- =====================================================================

create or replace function public.accept_ride(p_ride uuid)
returns public.rides language plpgsql security definer set search_path = public as $$
declare
  v_ride public.rides;
begin
  if public.app_user_role() is distinct from 'driver' then
    raise exception 'Only drivers can accept rides';
  end if;

  if exists (
    select 1 from public.rides
    where driver_id = auth.uid() and status in ('accepted','arrived','in_progress')
  ) then
    raise exception 'You already have an active ride';
  end if;

  update public.rides
     set driver_id = auth.uid(), status = 'accepted', accepted_at = now()
   where id = p_ride and status = 'requested' and driver_id is null
  returning * into v_ride;

  if v_ride.id is null then
    raise exception 'This ride is no longer available';
  end if;

  return v_ride;
end $$;

create or replace function public.decline_ride(p_ride uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.app_user_role() is distinct from 'driver' then
    raise exception 'Only drivers can decline rides';
  end if;
  insert into public.ride_declines (ride_id, driver_id)
  values (p_ride, auth.uid())
  on conflict do nothing;
end $$;

create or replace function public.advance_ride(p_ride uuid, p_status text)
returns public.rides language plpgsql security definer set search_path = public as $$
declare
  v_ride public.rides;
begin
  select * into v_ride from public.rides where id = p_ride for update;

  if v_ride.id is null or v_ride.driver_id is distinct from auth.uid() then
    raise exception 'Ride not found';
  end if;

  if not (
    (v_ride.status = 'accepted'    and p_status = 'arrived') or
    (v_ride.status = 'arrived'     and p_status = 'in_progress') or
    (v_ride.status = 'in_progress' and p_status = 'completed')
  ) then
    raise exception 'Cannot move ride from % to %', v_ride.status, p_status;
  end if;

  update public.rides set
    status       = p_status,
    arrived_at   = case when p_status = 'arrived'     then now() else arrived_at end,
    started_at   = case when p_status = 'in_progress' then now() else started_at end,
    completed_at = case when p_status = 'completed'   then now() else completed_at end
  where id = p_ride
  returning * into v_ride;

  return v_ride;
end $$;

-- Customer cancel ends the ride. Driver cancel releases it back to the pool.
create or replace function public.cancel_ride(p_ride uuid, p_reason text default null)
returns public.rides language plpgsql security definer set search_path = public as $$
declare
  v_ride public.rides;
begin
  select * into v_ride from public.rides where id = p_ride for update;
  if v_ride.id is null then
    raise exception 'Ride not found';
  end if;

  if v_ride.customer_id = auth.uid() then
    if v_ride.status not in ('requested','accepted','arrived') then
      raise exception 'This ride can no longer be cancelled';
    end if;
    update public.rides set
      status = 'cancelled', cancelled_by = auth.uid(),
      cancel_reason = left(p_reason, 280), cancelled_at = now()
    where id = p_ride returning * into v_ride;

  elsif v_ride.driver_id = auth.uid() then
    if v_ride.status not in ('accepted','arrived') then
      raise exception 'This ride can no longer be cancelled';
    end if;
    insert into public.ride_declines (ride_id, driver_id) values (p_ride, auth.uid())
    on conflict do nothing;
    update public.rides set
      status = 'requested', driver_id = null, accepted_at = null, arrived_at = null,
      cancel_reason = left(p_reason, 280)
    where id = p_ride returning * into v_ride;

  else
    raise exception 'Ride not found';
  end if;

  return v_ride;
end $$;

create or replace function public.rate_ride(p_ride uuid, p_rating smallint, p_feedback text default null)
returns public.rides language plpgsql security definer set search_path = public as $$
declare
  v_ride public.rides;
begin
  update public.rides
     set customer_rating = p_rating, customer_feedback = left(p_feedback, 500)
   where id = p_ride and customer_id = auth.uid() and status = 'completed'
  returning * into v_ride;
  if v_ride.id is null then
    raise exception 'Only completed rides you took can be rated';
  end if;
  return v_ride;
end $$;

create or replace function public.mark_messages_read(p_ride uuid)
returns void language sql security definer set search_path = public as $$
  update public.messages
     set read_at = now()
   where ride_id = p_ride
     and sender_id <> auth.uid()
     and read_at is null
     and public.is_ride_participant(p_ride::text);
$$;

-- Open requests near a point (haversine, km), excluding ones this driver declined.
create or replace function public.nearby_ride_requests(p_lat double precision, p_lng double precision, p_radius_km double precision default 15)
returns table (
  id uuid, customer_id uuid, customer_name text,
  pickup_address text, pickup_lat double precision, pickup_lng double precision,
  dropoff_address text, dropoff_lat double precision, dropoff_lng double precision,
  distance_m integer, duration_s integer, notes text, requested_at timestamptz,
  pickup_distance_km double precision
) language sql stable security definer set search_path = public as $$
  select * from (
    select r.id, r.customer_id, p.full_name,
           r.pickup_address, r.pickup_lat, r.pickup_lng,
           r.dropoff_address, r.dropoff_lat, r.dropoff_lng,
           r.distance_m, r.duration_s, r.notes, r.requested_at,
           6371 * 2 * asin(sqrt(
             power(sin(radians(r.pickup_lat - p_lat) / 2), 2) +
             cos(radians(p_lat)) * cos(radians(r.pickup_lat)) *
             power(sin(radians(r.pickup_lng - p_lng) / 2), 2)
           )) as pickup_distance_km
    from public.rides r
    join public.profiles p on p.id = r.customer_id
    where public.app_user_role() = 'driver'
      and r.status = 'requested'
      and r.requested_at > now() - interval '30 minutes'
      and not exists (
        select 1 from public.ride_declines d where d.ride_id = r.id and d.driver_id = auth.uid()
      )
  ) q
  where q.pickup_distance_km <= p_radius_km
  order by q.pickup_distance_km asc, q.requested_at asc
  limit 20;
$$;

revoke all on function public.accept_ride(uuid) from public, anon;
revoke all on function public.decline_ride(uuid) from public, anon;
revoke all on function public.advance_ride(uuid, text) from public, anon;
revoke all on function public.cancel_ride(uuid, text) from public, anon;
revoke all on function public.rate_ride(uuid, smallint, text) from public, anon;
revoke all on function public.mark_messages_read(uuid) from public, anon;
revoke all on function public.nearby_ride_requests(double precision, double precision, double precision) from public, anon;
grant execute on function public.accept_ride(uuid) to authenticated;
grant execute on function public.decline_ride(uuid) to authenticated;
grant execute on function public.advance_ride(uuid, text) to authenticated;
grant execute on function public.cancel_ride(uuid, text) to authenticated;
grant execute on function public.rate_ride(uuid, smallint, text) to authenticated;
grant execute on function public.mark_messages_read(uuid) to authenticated;
grant execute on function public.nearby_ride_requests(double precision, double precision, double precision) to authenticated;

-- =====================================================================
-- Storage: private bucket for voice notes
--   rides/<ride_id>/<file>       readable/writable by ride participants
--   templates/<user_id>/<file>   readable/writable by the owner
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('voice-notes', 'voice-notes', false, 5242880,
        array['audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav','audio/aac'])
on conflict (id) do nothing;

drop policy if exists voice_select on storage.objects;
create policy voice_select on storage.objects for select to authenticated using (
  bucket_id = 'voice-notes' and (
    ((storage.foldername(name))[1] = 'rides' and public.is_ride_participant((storage.foldername(name))[2]))
    or ((storage.foldername(name))[1] = 'templates' and (storage.foldername(name))[2] = auth.uid()::text)
  )
);

drop policy if exists voice_insert on storage.objects;
create policy voice_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'voice-notes' and (
    ((storage.foldername(name))[1] = 'rides' and public.is_ride_participant((storage.foldername(name))[2]))
    or ((storage.foldername(name))[1] = 'templates' and (storage.foldername(name))[2] = auth.uid()::text)
  )
);

drop policy if exists voice_delete on storage.objects;
create policy voice_delete on storage.objects for delete to authenticated using (
  bucket_id = 'voice-notes'
  and (storage.foldername(name))[1] = 'templates'
  and (storage.foldername(name))[2] = auth.uid()::text
);

-- =====================================================================
-- Realtime
-- =====================================================================
alter table public.rides replica identity full;
alter table public.driver_status replica identity full;

do $$
begin
  begin alter publication supabase_realtime add table public.rides;         exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.messages;      exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.driver_status; exception when duplicate_object then null; end;
end $$;
