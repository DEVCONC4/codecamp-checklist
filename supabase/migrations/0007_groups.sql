-- Groups.
--
-- A room run at team tables has a question the per-person roster cannot answer:
-- how is table 3 doing. So a participant may belong to one group, and a group
-- carries a short code alongside its uuid — because the uuid is for the join
-- and the code is for saying out loud across a room.
--
-- Who assigns: the facilitator, from the desk. Not the participant at signup.
-- Which table someone sits at is a fact about the room, and the person who
-- arranged the room is the one who knows it. That means profiles.group_id has
-- to be frozen against self-edits the same way role already is — the update
-- policy on profiles lets a user write their own row.
--
-- Safe to run as one paste in the Supabase SQL editor, and safe to re-run.

-- ──────────────────────────────────────────────────────────── codes ──
-- Four characters, and not from the full alphabet: I/L/O/0/1 are the pairs
-- that get misheard when a code is read to a table across a noisy room, so
-- they are simply not in it. 31^4 is about 920k, which is absurd headroom for
-- a day's camp — the loop is only here so a collision retries rather than
-- surfacing as a constraint violation on someone's first group.

create or replace function public.gen_group_code()
returns text
language plpgsql
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  candidate text;
begin
  for attempt in 1..20 loop
    candidate := '';
    for ch in 1..4 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    if not exists (select 1 from public.groups where code = candidate) then
      return candidate;
    end if;
  end loop;
  -- Twenty collisions in a row means the table is far bigger than this scheme
  -- was meant for. Fall back to something that cannot collide and let the
  -- unique constraint stay untroubled.
  return upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
end;
$$;

-- ─────────────────────────────────────────────────────────── tables ──

create table if not exists public.groups (
  id         uuid        primary key default gen_random_uuid(),
  code       text        not null unique default public.gen_group_code(),
  name       text        not null default '',
  created_at timestamptz not null default now()
);

-- on delete set null: removing a group empties it. Deleting a table of people
-- because somebody tidied up the group list would be an appalling trade.
alter table public.profiles
  add column if not exists group_id uuid references public.groups (id) on delete set null;

create index if not exists profiles_group_idx on public.profiles (group_id);

-- ──────────────────────────────────────────────────────── functions ──

-- The same guard as freeze_role, for the same reason and with the same escape
-- hatch: auth.uid() is null in the SQL Editor and for service_role, sessions
-- that already hold full admin, so the check only polices real signed-in users.
create or replace function public.freeze_group()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.group_id is distinct from old.group_id
     and auth.uid() is not null
     and not public.is_facilitator() then
    new.group_id := old.group_id;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_freeze_group on public.profiles;
create trigger profiles_freeze_group
  before update on public.profiles
  for each row execute function public.freeze_group();

-- ────────────────────────────────────────────────────────────── RLS ──

alter table public.groups enable row level security;

-- Everyone reads. v_roster is security_invoker and now joins groups, so a
-- participant fetching their own roster row needs select here or the view
-- returns nothing at all. A group's name and code are not a secret — where
-- someone is sitting is visible from across the room.
drop policy if exists groups_select on public.groups;
create policy groups_select on public.groups
  for select to authenticated
  using (true);

drop policy if exists groups_insert on public.groups;
create policy groups_insert on public.groups
  for insert to authenticated
  with check (public.is_facilitator());

drop policy if exists groups_update on public.groups;
create policy groups_update on public.groups
  for update to authenticated
  using (public.is_facilitator())
  with check (public.is_facilitator());

drop policy if exists groups_delete on public.groups;
create policy groups_delete on public.groups
  for delete to authenticated
  using (public.is_facilitator());

-- ───────────────────────────────────────────────────── export views ──
-- Dropped and recreated rather than replaced: `create or replace view` may only
-- append columns, and the group belongs beside the person it describes.

drop view if exists public.v_roster;

create view public.v_roster
with (security_invoker = on) as
select
  p.id,
  p.name,
  p.email,
  p.os,
  p.role,
  p.group_id,
  g.code                                       as group_code,
  g.name                                       as group_name,
  p.created_at,
  count(*) filter (where pr.done)              as steps_done,
  max(pr.done_at) filter (where pr.done)       as last_stamp_at,
  max(pr.updated_at)                           as last_activity_at
from public.profiles p
left join public.groups g on g.id = p.group_id
left join public.progress pr on pr.user_id = p.id
group by p.id, g.id;

-- ───────────────────────────────────────────────────────── realtime ──
-- Same deal as 0002: the event is only a nudge to refetch through PostgREST,
-- so publishing this table widens nothing. Skipping it costs the desk a live
-- update when a group is renamed — the Refresh button still gets there.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'groups'
  ) then
    alter publication supabase_realtime add table public.groups;
  end if;
end
$$;
