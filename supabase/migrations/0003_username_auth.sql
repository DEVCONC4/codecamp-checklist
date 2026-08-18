-- Username login; email removed from the product surface.
--
-- Supabase Auth requires an email for password sign-in, so the app registers
-- <username>@codecamp.test under the hood. `.test` is reserved by RFC 6761:
-- it can never resolve and can never receive mail, so no address here can
-- collide with, or accidentally be delivered to, anything real. (`.invalid` is
-- rejected by Supabase's validator; `.test` is accepted.)
--
-- The synthetic address stays in auth.users where it belongs. `profiles` drops
-- its email column entirely — nothing in the app displays or exports it.
--
-- Safe to re-run.

-- ── username column ──────────────────────────────────────────────────

alter table public.profiles add column if not exists username text;

-- Backfill anything created before this migration from its address local-part.
update public.profiles p
set username = split_part(u.email, '@', 1)
from auth.users u
where u.id = p.id and (p.username is null or p.username = '');

update public.profiles set username = 'user_' || left(id::text, 8)
where username is null or username = '';

alter table public.profiles alter column username set not null;

-- Case-insensitive uniqueness: "Juan" and "juan" must not be two people.
create unique index if not exists profiles_username_key
  on public.profiles (lower(username));

-- ── drop email ───────────────────────────────────────────────────────
-- v_roster selects it, so the view has to go first and come back after.

drop view if exists public.v_roster;
alter table public.profiles drop column if exists email;

create or replace view public.v_roster
with (security_invoker = on) as
select
  p.id,
  p.name,
  p.username,
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
  insert into public.profiles (id, name, username, os)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'username', ''),
      split_part(new.email, '@', 1)
    ),
    coalesce(nullif(new.raw_user_meta_data ->> 'os', ''), 'Windows')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- Promote your facilitator account by username now, not email:
--   update public.profiles set role = 'facilitator' where username = 'yourname';
