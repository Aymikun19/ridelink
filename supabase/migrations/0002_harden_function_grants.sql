-- Follow-up from the Supabase security advisor.
-- Internal helpers are not callable by signed-out visitors; the trigger function is not callable at all.
alter function public.guard_profile_update() set search_path = public;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.app_user_role() from public, anon;
revoke all on function public.is_ride_participant(text) from public, anon;
grant execute on function public.app_user_role() to authenticated;
grant execute on function public.is_ride_participant(text) to authenticated;
