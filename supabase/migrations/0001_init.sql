-- Barangay AI Code Camp — initial schema
-- Safe to run as one paste in the Supabase SQL editor, or via `supabase db push`.
--
-- Model: one row per participant (profiles), one row per (participant, step)
-- holding that step's answers as jsonb (progress), and one row per uploaded
-- screenshot (screenshots) whose bytes live in the private `proofs` bucket.
-- Answers are jsonb rather than a row-per-field table because a step's proof
-- set is defined in app config, not in the database — and v_submissions
-- unnests them anyway, so analytics still get one row per field.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────── tables ──

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text not null default '',
  email      text not null default '',
  os         text not null default 'Windows' check (os in ('Windows', 'macOS', 'Linux')),
  role       text not null default 'participant' check (role in ('participant', 'facilitator')),
  created_at timestamptz not null default now()
);

create table if not exists public.progress (
  user_id    uuid        not null references public.profiles (id) on delete cascade,
  step_id    text        not null,
  values     jsonb       not null default '{}'::jsonb,
  done       boolean     not null default false,
  done_at    timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, step_id)
);

create table if not exists public.screenshots (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  step_id    text not null,
  field_key  text not null,
  path       text not null unique,   -- object key inside the `proofs` bucket
  name       text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists screenshots_user_step_idx on public.screenshots (user_id, step_id);
create index if not exists progress_done_idx         on public.progress (user_id) where done;

-- ──────────────────────────────────────────────────────── functions ──

-- SECURITY DEFINER so a policy on profiles can ask "is this user staff?"
-- without re-entering profiles' own RLS and recursing.
create or replace function public.is_facilitator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'facilitator'
  );
$$;

-- Every auth user gets a profile immediately, seeded from the sign-up form.
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
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.email, ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'os', ''), 'Windows')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- A participant may edit their own profile but must not promote themselves.
create or replace function public.freeze_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_facilitator() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_freeze_role on public.profiles;
create trigger profiles_freeze_role
  before update on public.profiles
  for each row execute function public.freeze_role();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists progress_touch on public.progress;
create trigger progress_touch
  before update on public.progress
  for each row execute function public.touch_updated_at();

-- ────────────────────────────────────────────────────────────── RLS ──

alter table public.profiles    enable row level security;
alter table public.progress    enable row level security;
alter table public.screenshots enable row level security;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_facilitator());

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_facilitator())
  with check (id = auth.uid() or public.is_facilitator());

-- progress
drop policy if exists progress_select on public.progress;
create policy progress_select on public.progress
  for select to authenticated
  using (user_id = auth.uid() or public.is_facilitator());

drop policy if exists progress_write on public.progress;
create policy progress_write on public.progress
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists progress_update on public.progress;
create policy progress_update on public.progress
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists progress_delete on public.progress;
create policy progress_delete on public.progress
  for delete to authenticated
  using (user_id = auth.uid());

-- screenshots
drop policy if exists screenshots_select on public.screenshots;
create policy screenshots_select on public.screenshots
  for select to authenticated
  using (user_id = auth.uid() or public.is_facilitator());

drop policy if exists screenshots_insert on public.screenshots;
create policy screenshots_insert on public.screenshots
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists screenshots_delete on public.screenshots;
create policy screenshots_delete on public.screenshots
  for delete to authenticated
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────── storage ──

insert into storage.buckets (id, name, public)
values ('proofs', 'proofs', false)
on conflict (id) do nothing;

-- Object keys are `<user-id>/<step-id>/<uuid>.jpg`, so the first path segment
-- is the owner and every policy below keys off it.
drop policy if exists proofs_insert on storage.objects;
create policy proofs_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists proofs_select on storage.objects;
create policy proofs_select on storage.objects
  for select to authenticated
  using (bucket_id = 'proofs'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_facilitator()));

drop policy if exists proofs_delete on storage.objects;
create policy proofs_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);

-- ───────────────────────────────────────────────────── export views ──
-- security_invoker keeps the caller's RLS in force, so a participant hitting
-- these sees only their own row and a facilitator sees the whole room.

create or replace view public.v_roster
with (security_invoker = on) as
select
  p.id,
  p.name,
  p.email,
  p.os,
  p.role,
  p.created_at,
  count(*) filter (where pr.done)              as steps_done,
  max(pr.done_at) filter (where pr.done)       as last_stamp_at,
  max(pr.updated_at)                           as last_activity_at
from public.profiles p
left join public.progress pr on pr.user_id = p.id
group by p.id;

create or replace view public.v_submissions
with (security_invoker = on) as
select
  pr.user_id,
  p.name,
  p.os,
  pr.step_id,
  kv.key                as field_key,
  kv.value #>> '{}'     as value,
  pr.done,
  pr.done_at
from public.progress pr
join public.profiles p on p.id = pr.user_id
cross join lateral jsonb_each(pr.values) as kv(key, value)
where kv.value #>> '{}' <> '';

-- ─────────────────────────────────────────────────────────────────────
-- Promote your facilitator account AFTER it has signed up once:
--   update public.profiles set role = 'facilitator' where email = 'you@example.com';
