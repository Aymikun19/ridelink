-- =====================================================================
-- 0003: password accounts, profile photos, saved places
-- =====================================================================

-- One-time codes now have a purpose: 'login', 'signup' (email verification) or 'reset' (password).
alter table public.otp_codes add column if not exists purpose text not null default 'login'
  check (purpose in ('login', 'signup', 'reset'));
alter table public.otp_codes drop constraint if exists otp_codes_pkey;
alter table public.otp_codes add primary key (email, purpose);

-- Server-side lookup of an auth user by email (service role only).
create or replace function public.auth_user_by_email(p_email text)
returns table (id uuid, email_confirmed boolean, has_password boolean)
language sql stable security definer set search_path = public, auth as $$
  select u.id, u.email_confirmed_at is not null, u.encrypted_password is not null and u.encrypted_password <> ''
  from auth.users u
  where lower(u.email) = lower(p_email)
  limit 1;
$$;
revoke all on function public.auth_user_by_email(text) from public, anon, authenticated;
grant execute on function public.auth_user_by_email(text) to service_role;

-- Keep the name given at sign-up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''))
  on conflict (id) do nothing;
  return new;
end $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Profile photos
alter table public.profiles add column if not exists avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists avatar_insert on storage.objects;
create policy avatar_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists avatar_update on storage.objects;
create policy avatar_update on storage.objects for update to authenticated using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists avatar_delete on storage.objects;
create policy avatar_delete on storage.objects for delete to authenticated using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);

-- Saved places (Home, Work, ...)
create table if not exists public.saved_places (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  label       text not null check (char_length(label) between 1 and 40),
  address     text not null check (char_length(address) <= 300),
  lat         double precision not null,
  lng         double precision not null,
  created_at  timestamptz not null default now()
);
create index if not exists saved_places_user_idx on public.saved_places (user_id, created_at);
alter table public.saved_places enable row level security;

drop policy if exists saved_places_all on public.saved_places;
create policy saved_places_all on public.saved_places for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
