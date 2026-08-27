-- Promoting a participant to facilitator, from the desk.
--
-- Until now this was an SQL Editor job (README §6), which is fine for the one
-- account that bootstraps a project and useless at 9am on camp day when a
-- second facilitator turns up and nobody has the database open. So it moves
-- into the app — behind a passphrase, because of what the role actually hands
-- over: every participant's answers, every screenshot, the whole room.
--
-- The passphrase is checked HERE, not in the browser. A constant compared in
-- client JavaScript is a label on a door, not a lock: the bundle ships to the
-- room and anyone can read it out of devtools and call PostgREST by hand. So
-- the check lives in a `security definer` function, and `freeze_role` is
-- tightened so that function is the ONLY way a signed-in session can change a
-- role. A facilitator writing `update profiles set role = 'facilitator'`
-- straight at PostgREST now gets the same silent revert a participant gets.
--
-- What this is and isn't: it is a second factor on an action only facilitators
-- can reach at all — RLS and `is_facilitator()` are still the boundary, and
-- this is the deliberate pause in front of the irreversible-from-the-app bit.
-- It is not a secret. Everyone at the camp will end up knowing the word.
--
-- The other half of this migration is `profiles.promoted_at`, which exists so
-- the desk can keep showing a promoted person's work. See the block below.
--
-- Safe to re-run.

-- ──────────────────────────────────────────────────────── promoted_at ──
-- Why a column and not just `role = 'facilitator'`.
--
-- The desk drops facilitators from the roster on purpose: whoever sets a
-- project up clicks through the steps to check the app works, and that noise
-- would otherwise land in the room's counts, the per-step chart and the
-- spreadsheet as if it were somebody's morning. Test data, correctly hidden.
--
-- That reasoning covers the account that was staff before the camp started. It
-- is exactly wrong for someone who sat through the whole camp, did the work,
-- and got handed the desk at 2pm — their stamps are as real as anyone's, and
-- losing them the moment they are promoted is losing real data. `role` alone
-- cannot tell those two apart, so the promotion records itself: null means
-- always-staff, a timestamp means "was a participant, and their work counts".
--
-- Nothing writes this but the function below.

alter table public.profiles
  add column if not exists promoted_at timestamptz;

-- ─────────────────────────────────────────────────────── the passphrase ──
-- Its own function so changing it is one `create or replace` and nothing that
-- uses it has to be touched. Stored uppercase; the caller's input is trimmed
-- and upper-cased before the compare, so a facilitator typing `devcon` into a
-- password field at the front of a room is not punished for it.

create or replace function public.promotion_passphrase()
returns text
language sql
immutable
as $$ select 'DEVCON' $$;

revoke all on function public.promotion_passphrase() from public, anon, authenticated;

-- ──────────────────────────────────────────────────────────── the gate ──
-- `set_config(..., true)` is transaction-local: PostgREST runs each call in
-- its own transaction, so the flag exists for exactly the one UPDATE below and
-- is gone before the next request. It is not a privilege — the trigger only
-- honours it after this function has already checked who is asking.

create or replace function public.promote_to_facilitator(target uuid, passphrase text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  promoted public.profiles;
begin
  -- Ordered so a participant poking at the RPC learns nothing about the word:
  -- they are turned away before it is ever compared.
  if not public.is_facilitator() then
    raise exception 'Only a facilitator can promote someone.' using errcode = '42501';
  end if;

  if upper(trim(coalesce(passphrase, ''))) is distinct from public.promotion_passphrase() then
    raise exception 'That passphrase is not right.' using errcode = '28000';
  end if;

  perform set_config('app.promoting', 'on', true);

  -- coalesce, so re-running on someone already promoted keeps the original
  -- moment rather than sliding it forward.
  update public.profiles
     set role        = 'facilitator',
         promoted_at = coalesce(promoted_at, now())
   where id = target
  returning * into promoted;

  if promoted.id is null then
    raise exception 'No such person on the roster.' using errcode = 'P0002';
  end if;

  return promoted;
end;
$$;

revoke all on function public.promote_to_facilitator(uuid, text) from public, anon;
grant execute on function public.promote_to_facilitator(uuid, text) to authenticated;

-- ───────────────────────────────────────────────────── freeze_role, v3 ──
-- 0001 froze role against everyone but a facilitator. 0006 swapped that for
-- "is a real user making this change", so the SQL Editor could bootstrap the
-- first account. This keeps 0006's escape hatch verbatim — `auth.uid()` is
-- null for the SQL Editor, the Table Editor and `service_role`, sessions that
-- already hold full admin, so README §6 still works exactly as written — and
-- narrows the signed-in case from "is a facilitator" to "came through
-- promote_to_facilitator". That is the whole reason the passphrase means
-- anything: without it a facilitator could route around the check.
--
-- Demotion stays an SQL Editor job, and still is one statement:
--   update public.profiles set role = 'participant' where email = 'them@example.com';

create or replace function public.freeze_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and current_setting('app.promoting', true) is distinct from 'on' then
    new.role := old.role;
  end if;
  return new;
end;
$$;

-- The trigger itself is unchanged and still points at this function; 0001
-- created it and re-creating it here would only churn.

-- ────────────────────────────────────────────────────────── v_roster ──
-- Dropped and recreated rather than replaced, for the same reason 0007 did it:
-- `create or replace view` is fussy about column lists, and this is the third
-- migration to touch the shape. Identical to 0007's apart from `promoted_at`.

drop view if exists public.v_roster;

create view public.v_roster
with (security_invoker = on) as
select
  p.id,
  p.name,
  p.email,
  p.os,
  p.role,
  p.promoted_at,
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
