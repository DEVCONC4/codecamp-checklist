-- Let an admin session promote a facilitator. Fixes freeze_role from 0001.
--
-- The trigger blocked every role change that wasn't made by an existing
-- facilitator. Correct for participants, wrong for the person setting up the
-- project: `auth.uid()` is null in the SQL Editor and the Table Editor, so
-- `is_facilitator()` returned false there and the promotion documented in
-- README §6 was reverted — silently, because the trigger rewrites the row
-- rather than raising. It reported success and changed nothing.
--
-- Being admin was no escape either. `service_role` and `postgres` bypass RLS;
-- they do not bypass triggers. And the only accounts that could promote anyone
-- were facilitators, which is the account you are trying to create.
--
-- So the guard now asks whether a real user is making the change, and only
-- polices that case. A participant always carries a uid and stays blocked —
-- `rls-test.mjs` still asserts it. A session with no uid is already inside the
-- database with RLS turned off; there is nothing left for this trigger to
-- protect against.
--
-- Safe to re-run.

create or replace function public.freeze_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() is null for the SQL Editor, the Table Editor and service_role —
  -- sessions that hold full admin already. The guard is for signed-in users.
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_facilitator() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

-- The trigger itself is unchanged and still points at this function; 0001
-- created it and re-creating it here would only churn.

-- ─────────────────────────────────────────────────────────────────────
-- Promote your facilitator account by email, then sign out and back in:
--   update public.profiles set role = 'facilitator' where email = 'you@example.com';
