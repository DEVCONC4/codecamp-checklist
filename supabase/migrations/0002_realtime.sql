-- Live facilitator room.
--
-- The app never trusts realtime payloads as data — a change event is only a
-- nudge to refetch through PostgREST, where RLS still decides what the
-- facilitator may see. Adding these tables to the publication therefore does
-- not widen what anyone can read.
--
-- Safe to run on its own, and safe to re-run.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'progress'
  ) then
    alter publication supabase_realtime add table public.progress;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end
$$;

-- Skipping this migration is fine: the desk falls back to its Refresh button
-- and shows "Manual refresh" instead of "Live".
