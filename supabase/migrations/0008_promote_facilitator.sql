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
-- Safe to re-run.

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

  update public.profiles
     set role = 'facilitator'
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
