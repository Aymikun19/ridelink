-- =====================================================================
-- 0004: driver vehicle + document details, verification, messages inbox
-- =====================================================================

-- Vehicle details customers see
alter table public.profiles
  add column if not exists vehicle_type text check (vehicle_type in ('sedan', 'suv', 'minivan', 'tricycle', 'motorcycle')),
  add column if not exists vehicle_year smallint check (vehicle_year between 1980 and 2100),
  add column if not exists vehicle_seats smallint check (vehicle_seats between 1 and 14),
  add column if not exists vehicle_photo_url text,
  add column if not exists driver_verified boolean not null default false;

-- Users cannot mark themselves verified; only the documents trigger or an admin can.
create or replace function public.guard_profile_update()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.role is not null and new.role is distinct from old.role then
    raise exception 'Role cannot be changed once set';
  end if;
  new.email := old.email;
  -- The 'role' setting is the app user's role even inside security-definer code.
  if current_setting('role', true) = 'authenticated' and pg_trigger_depth() = 1 then
    new.driver_verified := old.driver_verified;
  end if;
  new.updated_at := now();
  return new;
end $$;

-- Private driver documents (only the driver can read them; admins use the dashboard)
create table if not exists public.driver_documents (
  driver_id              uuid primary key references public.profiles (id) on delete cascade,
  license_number         text check (char_length(license_number) <= 40),
  license_expiry         date,
  license_photo_path     text,
  registration_number    text check (char_length(registration_number) <= 40),
  registration_doc_path  text,
  insurance_doc_path     text,
  status                 text not null default 'incomplete'
                         check (status in ('incomplete', 'submitted', 'approved', 'rejected')),
  review_note            text,
  submitted_at           timestamptz,
  reviewed_at            timestamptz,
  updated_at             timestamptz not null default now()
);

create or replace function public.driver_documents_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  complete boolean;
  p public.profiles;
begin
  -- Admin changes (SQL editor, service role) are taken as they are.
  if coalesce(current_setting('role', true), 'none') <> 'authenticated' then
    new.updated_at := now();
    if new.status = 'approved' and new.reviewed_at is null then new.reviewed_at := now(); end if;
    update public.profiles set driver_verified = (new.status = 'approved') where id = new.driver_id;
    return new;
  end if;

  select * into p from public.profiles where id = new.driver_id;

  -- Drivers cannot review themselves.
  if tg_op = 'UPDATE' then
    new.review_note := old.review_note;
    new.reviewed_at := old.reviewed_at;
  else
    new.review_note := null;
    new.reviewed_at := null;
  end if;

  complete := coalesce(trim(new.license_number), '') <> ''
          and new.license_expiry is not null and new.license_expiry > current_date
          and new.license_photo_path is not null
          and coalesce(trim(new.registration_number), '') <> ''
          and new.registration_doc_path is not null
          and p.avatar_url is not null
          and p.vehicle_photo_url is not null
          and p.vehicle_type is not null
          and p.plate_number is not null;

  if not complete then
    new.status := 'incomplete';
  elsif tg_op = 'UPDATE' and old.status = 'approved'
        and new.license_number is not distinct from old.license_number
        and new.license_expiry is not distinct from old.license_expiry
        and new.license_photo_path is not distinct from old.license_photo_path
        and new.registration_number is not distinct from old.registration_number
        and new.registration_doc_path is not distinct from old.registration_doc_path then
    new.status := 'approved';
  else
    new.status := 'submitted';
    if tg_op = 'INSERT' or old.status <> 'submitted' then new.submitted_at := now(); end if;
  end if;

  new.updated_at := now();
  update public.profiles set driver_verified = (new.status = 'approved') where id = new.driver_id;
  return new;
end $$;

drop trigger if exists driver_documents_status on public.driver_documents;
create trigger driver_documents_status
  before insert or update on public.driver_documents
  for each row execute function public.driver_documents_status();

alter table public.driver_documents enable row level security;

drop policy if exists driver_docs_select on public.driver_documents;
create policy driver_docs_select on public.driver_documents for select to authenticated
  using (driver_id = auth.uid());
drop policy if exists driver_docs_insert on public.driver_documents;
create policy driver_docs_insert on public.driver_documents for insert to authenticated
  with check (driver_id = auth.uid() and public.app_user_role() = 'driver');
drop policy if exists driver_docs_update on public.driver_documents;
create policy driver_docs_update on public.driver_documents for update to authenticated
  using (driver_id = auth.uid()) with check (driver_id = auth.uid());

-- Re-check document status when profile parts it depends on change (photo, vehicle, plate).
create or replace function public.recheck_driver_documents()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'driver' and (
       new.avatar_url is distinct from old.avatar_url
    or new.vehicle_photo_url is distinct from old.vehicle_photo_url
    or new.vehicle_type is distinct from old.vehicle_type
    or new.plate_number is distinct from old.plate_number) then
    update public.driver_documents set updated_at = now() where driver_id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists profiles_recheck_docs on public.profiles;
create trigger profiles_recheck_docs
  after update on public.profiles
  for each row execute function public.recheck_driver_documents();

revoke all on function public.driver_documents_status() from public, anon, authenticated;
revoke all on function public.recheck_driver_documents() from public, anon, authenticated;

-- Going online and accepting rides require submitted (or approved) documents.
create or replace function public.driver_documents_ready()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.driver_documents
    where driver_id = auth.uid() and status in ('submitted', 'approved')
  );
$$;
revoke all on function public.driver_documents_ready() from public, anon;
grant execute on function public.driver_documents_ready() to authenticated;

drop policy if exists driver_status_insert on public.driver_status;
create policy driver_status_insert on public.driver_status for insert to authenticated
  with check (driver_id = auth.uid() and public.app_user_role() = 'driver'
              and (not is_online or public.driver_documents_ready()));

drop policy if exists driver_status_update on public.driver_status;
create policy driver_status_update on public.driver_status for update to authenticated
  using (driver_id = auth.uid())
  with check (driver_id = auth.uid() and (not is_online or public.driver_documents_ready()));

create or replace function public.accept_ride(p_ride uuid)
returns public.rides language plpgsql security definer set search_path = public as $$
declare
  v_ride public.rides;
begin
  if public.app_user_role() is distinct from 'driver' then
    raise exception 'Only drivers can accept rides';
  end if;
  if not public.driver_documents_ready() then
    raise exception 'Submit your driver documents before accepting rides';
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

-- Storage: public vehicle photos, private driver documents
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vehicles', 'vehicles', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('driver-docs', 'driver-docs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

drop policy if exists vehicles_insert on storage.objects;
create policy vehicles_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'vehicles' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists vehicles_delete on storage.objects;
create policy vehicles_delete on storage.objects for delete to authenticated using (
  bucket_id = 'vehicles' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists driver_docs_obj_select on storage.objects;
create policy driver_docs_obj_select on storage.objects for select to authenticated using (
  bucket_id = 'driver-docs' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists driver_docs_obj_insert on storage.objects;
create policy driver_docs_obj_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'driver-docs' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists driver_docs_obj_delete on storage.objects;
create policy driver_docs_obj_delete on storage.objects for delete to authenticated using (
  bucket_id = 'driver-docs' and (storage.foldername(name))[1] = auth.uid()::text
);

-- Messages inbox: one row per ride conversation, newest activity first.
create or replace function public.my_conversations()
returns table (
  ride_id uuid, status text, requested_at timestamptz,
  pickup_address text, dropoff_address text,
  counterpart_id uuid, counterpart_name text, counterpart_avatar text,
  last_kind text, last_body text, last_sender uuid, last_at timestamptz,
  unread integer
) language sql stable security definer set search_path = public as $$
  select r.id, r.status, r.requested_at, r.pickup_address, r.dropoff_address,
         c.id, c.full_name, c.avatar_url,
         m.kind, m.body, m.sender_id, coalesce(m.created_at, r.accepted_at, r.requested_at),
         (select count(*)::int from public.messages u
           where u.ride_id = r.id and u.sender_id <> auth.uid() and u.read_at is null)
  from public.rides r
  join public.profiles c on c.id = case when r.customer_id = auth.uid() then r.driver_id else r.customer_id end
  left join lateral (
    select kind, body, sender_id, created_at from public.messages
    where ride_id = r.id order by created_at desc limit 1
  ) m on true
  where r.driver_id is not null
    and (r.customer_id = auth.uid() or r.driver_id = auth.uid())
  order by coalesce(m.created_at, r.accepted_at, r.requested_at) desc
  limit 100;
$$;
revoke all on function public.my_conversations() from public, anon;
grant execute on function public.my_conversations() to authenticated;

alter table public.driver_documents replica identity full;
