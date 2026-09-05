# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page checklist app for the Barangay AI Code Camp (BAICC) — a 3-hour BYOD
workshop. Participants work 19 steps in order, submitting answers and screenshots;
facilitators get a live desk showing the room. Vite + vanilla JS (no framework, no
router, no client-side deps beyond `@supabase/supabase-js` and `xlsx`), Supabase for
Postgres + Auth + Storage. There is no backend of our own — RLS is the security
boundary.

[README.md](README.md) is unusually thorough and is the reference for setup, design
language and rationale. [PRD.md](PRD.md) documents the product as built.

## Commands

```bash
npm install
npm run dev        # vite, http://localhost:5173
npm run build      # static dist/
npm run preview

node scripts/probe.mjs      # tables, views, bucket, anon access, confirm-email state
node scripts/rls-test.mjs   # the real test suite — see below
node scripts/rls-test.mjs --facilitator you@example.com yourpassword
```

There is no unit-test framework and no linter. **`scripts/rls-test.mjs` is the test
suite.** It signs up two throwaway accounts against the live project and asserts the
security model end to end: B cannot read/update/insert-as/delete A's rows, the views
leak nothing cross-user, B cannot reach A's screenshots or mint a signed URL for
them, a participant cannot self-promote (not by writing `role`, not by calling the
RPC with the correct passphrase), `profiles.group_id` is frozen against self-edits,
and a promoted account keeps the steps it stamped. There is no way to run a single
assertion — the script runs all of them, prints PASS/FAIL per line, and ends with
cleanup SQL for the accounts it created. **Run it after any change to a migration, to
`store.js`, or to anything touching roles, groups or storage paths.**

Env: `cp .env.example .env.local`, fill `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY`. Never put the service-role key there. `scripts/env.mjs`
reads these the same way Vite does (`.env.local` wins over `.env`).

Migrations in [supabase/migrations/](supabase/migrations/) apply **in numeric order**
(`supabase db push`, or paste each into the SQL Editor). Several of them drop and
recreate `v_roster` and narrow `freeze_role()`, so the order is load-bearing rather
than cosmetic.

The project also needs two Supabase auth switches set: **Enable email provider ON**,
**Confirm email OFF**. Getting either wrong fails in a way the error text doesn't
explain; `authPreflight()` reads `/auth/v1/settings` at boot and says so on the gate.

## Architecture

[src/main.js](src/main.js) boots: auth gate → three tabs (`#view-steps`,
`#view-record`, `#view-desk`). `show()` is the whole router. [index.html](index.html)
holds every element the app addresses by id; modules reach them with `$`/`$$` from
`ui.js`. Rendering is `innerHTML` string building, not components — `esc()` anything
user-supplied.

**[src/camp.js](src/camp.js) is the content source of truth.** The `CAMP` object
holds the camp's identity (tagline, event, date, hashtags — taken off the DEVCON 17
poster) and all 19 steps with their prose and proof fields. Changing the camp means
editing this file and nothing else. Proof types are `text`, `longtext`, `choice`
(needs `options`) and `screenshot`. It exports the flattened `STEPS`, `REQ`, `TOTAL`,
`stepById`, `stepNumber`, `CAMP_NAME` and `PRIVATE`.

**[src/store.js](src/store.js) is the only module that talks to Postgres or
Storage** — with two deliberate exceptions, `groups.js` and `promote.js`, each kept a
small named module because they are the only writes the facilitator side makes. Store
keeps an in-memory mirror (`store.profile`, `store.progress`, `store.shots`) so every
render stays synchronous. Writes debounce 600ms into a dirty set and upsert; a failed
flush re-dirties the ids rather than losing the answer. New data access belongs here,
not inline in a view module.

The rest, roughly in the order a session touches them:

| | |
|---|---|
| [supabase.js](src/supabase.js) | client, `configured`, `bootFailure()`, `authPreflight()`, `PROOF_BUCKET` |
| [steps.js](src/steps.js) | the working surface — rail, step render, stamping, `blockerFor()` |
| [record.js](src/record.js) | *My project* — review sheet, unlock panel, downloads |
| [doc.js](src/doc.js) | the two exports (portfolio write-up, progress report) as self-contained HTML |
| [share.js](src/share.js) | the share sheet; adding a platform is one entry in `PLATFORMS` |
| [facilitator.js](src/facilitator.js) | the desk — alerts, roster, filters, one participant, groups UI, Excel |
| [groups.js](src/groups.js) / [promote.js](src/promote.js) | the only facilitator-side writes |
| [ui.js](src/ui.js) | `$`, `esc`, `toast`, `pill`, `stampHTML`, `zoom`, `download`, `shrink` |

## Invariants worth not breaking

- **Optionality is derived, never declared:** `optional: !s.proofs.some(p => p.required)`.
  Strip the last `required: true` proof from a step and it silently stops counting
  toward the 19.
- **Step ids are load-bearing.** `doc.js` and `facilitator.js` look up specific
  `stepId.key` fields, so renaming one means updating those lookups.
- **Nobody stamps their own step.** One button does both jobs: *Next step* checks
  every required proof, stamps, then navigates. There is no unstamp, and `doneAt` is
  never rewritten.
- **Steps open in order.** `blockerFor(id)` returns the first unstamped required step
  before this one; while it does, the step renders as a Preview — prose live, proof
  fields `inert`, Ctrl/Cmd+V refused. A step that is itself stamped is never shut.
- **The privacy split.** `PRIVATE = ['h4d']` keeps wrap-up and feedback out of the
  public write-up; it reaches Excel and the progress report only. Anything internal
  routes to Excel only. The one carve-out is `h4d.hardest`.
- **The promotion passphrase is compared in Postgres, not the browser.** It lives in
  `promotion_passphrase()` and is checked inside `promote_to_facilitator()`;
  `freeze_role()` accepts a signed-in role change only when it came through that RPC
  (signalled by a transaction-local `set_config`), with `auth.uid() is null` as the
  SQL-Editor escape hatch. Never move that check into `promote.js` — the bundle ships
  to every laptop in the room.
- **Screenshot paths are `<user-id>/<step-id>/<uuid>.<webp|jpg>`.** The first segment
  is what every storage policy keys off. Extension and content type both come from
  the blob `shrink()` actually produced, not the format it was asked for (it falls
  back to JPEG where WebP can't be encoded).
- **The desk derives, it does not store.** Roster status (Not started / Working /
  Idle / Complete), progress counts and which step someone is on are all computed
  from numbers the row already shows — there is no status column to drift out of step
  with the stamps. Progress comes off the `progress` table rather than `v_roster` so
  it matches the participant's own rail. Facilitators are hidden from the roster
  unless `promoted_at` is set (they sat the camp, so their stamps are real).
- **The share sheet builds its file on open, not on click.** `openOn` is synchronous
  because `navigator.share` and `window.open` are both refused once the user
  activation from the click has lapsed.

## Content

Step content is written against the Barangay AI app itself (`../context/`). Where the
app and this checklist disagree about a command, a URL or an order of operations,
**the app wins** — this is a companion to it, not a replacement.

Step bodies use a fixed vocabulary, and nothing outside `.acts` is an instruction:
`<ol class="acts">` an action · `<div class="lesson">` explanation ·
`<div class="callout">` an aside or gotcha · `<p class="cmdlabel">` which machine the
command block below is for · `<details class="how">` optional help behind an "i".

Prefer proof fields that cannot be answered without doing the thing — README's
*Changing the camp* section explains the five existing comprehension checks and why
each is shaped the way it is.

Copy voice: plain, second person, active. Name the trade-off rather than hiding it.
No exclamation marks, no "simply", no praise the participant hasn't earned.

## Design language

Three hues only — white ground, purple `#4725BA` primary, gold `#E8CA04` accent —
plus derived tints and one deliberate exception, `--flag` red for blocked. Don't
introduce a fourth. Four form devices carry the DEVCON 17 key visual: fills and
elevation rather than outlines, pills for every control, the purple→gold `--grad`
used only as a mark of progress (exactly five places), and the gold sparkle only
where something is titled or finished. Montserrat 800 for headings *and*
micro-labels — **mono is reserved for things that are literally code or numbers.**
Read README's *Design language* section before restyling anything.
