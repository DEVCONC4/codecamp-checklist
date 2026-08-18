-- Release accounts stranded by email confirmation.
--
-- A repair, not a step. Run it only if accounts were created while "Confirm
-- email" was still on (README §4). Those accounts exist but sign-in refuses
-- them with "Email not confirmed" forever, because the confirmation mail either
-- never arrived or was never sent — the built-in SMTP caps sends at a couple an
-- hour. Turning the setting off fixes every signup after it and does nothing
-- for the ones already made. This clears those.
--
-- It confirms every unconfirmed account on the project, which is the intent for
-- a camp — confirmation is deliberately off, so there is nothing for anyone to
-- confirm. Do not run it on a project that shares this database with something
-- where a verified address actually means something.
--
-- Safe to re-run, and safe to leave in the migration list: with confirmation
-- off, accounts are confirmed at creation and this matches nothing.

update auth.users
set email_confirmed_at = now(),
    updated_at = now()
where email_confirmed_at is null;
