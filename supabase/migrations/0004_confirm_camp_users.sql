-- Release camp accounts stranded by email confirmation.
--
-- Login is by username, so the app registers <username>@codecamp.test — a
-- reserved-TLD address that can never receive mail (see 0003). If a project is
-- set up with "Confirm email" still on, two things go wrong at once: Supabase
-- mails a confirmation nobody can ever read, and the built-in shared SMTP caps
-- sends at a couple an hour, so the third signup of the day and everything
-- after it comes back 429. Turning the toggle off — Authentication → Sign In /
-- Providers → Email → uncheck "Confirm email" — fixes every signup from then
-- on, but the accounts already created stay unconfirmed and get "Email not
-- confirmed" at sign-in forever. This clears those.
--
-- Scoped to the synthetic domain, so it cannot touch a real address even if
-- this project is later reused for something with genuine email. Safe to
-- re-run, and safe to leave in the migration list: with confirmation off,
-- accounts are confirmed at creation and this matches nothing.

update auth.users
set email_confirmed_at = now(),
    updated_at = now()
where email_confirmed_at is null
  and email like '%@codecamp.test';
