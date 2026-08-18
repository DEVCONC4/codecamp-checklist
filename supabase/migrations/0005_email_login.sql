-- Back to plain email + password. Reverts the username layer from 0003.
--
-- 0003 hid email behind a username by registering <username>@codecamp.test.
-- It worked, but every failure mode it created had to be explained to a room of
-- beginners — undeliverable confirmations, a mail cap that reads as "too many
-- attempts", accounts that can never be released — so the app now asks for an
-- address and hands it straight to Supabase Auth. Nothing is ever sent to it:
-- confirmation is off (README §4) and there is no magic link, OTP or password
-- reset anywhere.
--
-- `username` has to go rather than just stop being written, because the signup
-- trigger derived it from the address local-part under a unique index: with real
-- addresses, dale@gmail.com and dale@yahoo.com both want `dale`, and the second
-- signup would die inside the trigger with a constraint error nobody could read.
--
-- No information is lost — a username here was always the local-part of the
-- address being restored in the same migration.
--
-- Safe to re-run.

-- ── email column ─────────────────────────────────────────────────────

alter table public.profiles add column if not exists email text not null default '';

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email = '';

-- auth.users already enforces this, but the roster and the export read from
-- here. Partial, so a row whose backfill found nothing doesn't block the rest.
create unique index if not exists profiles_email_key
  on public.profiles (lower(email)) where email <> '';

-- ── drop username ────────────────────────────────────────────────────
-- v_roster selects it, so the view has to go first and come back after.
-- Dropping the column takes profiles_username_key with it.

drop view if exists public.v_roster;
alter table public.profiles drop column if exists username;

create or replace view public.v_roster
with (security_invoker = on) as
select
  p.id,
  p.name,
  p.email,
  p.os,
  p.role,
  p.created_at,
  count(*) filter (where pr.done)         as steps_done,
  max(pr.done_at) filter (where pr.done)  as last_stamp_at,
  max(pr.updated_at)                      as last_activity_at
from public.profiles p
left join public.progress pr on pr.user_id = p.id
group by p.id;

-- ── signup trigger ───────────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, os)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)),
    coalesce(new.email, ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'os', ''), 'Windows')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- Promote your facilitator account by email:
--   update public.profiles set role = 'facilitator' where email = 'you@example.com';
