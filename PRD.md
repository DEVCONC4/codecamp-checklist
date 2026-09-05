# PRD — Barangay AI Code Camp checklist (BAICC)

**Status:** shipped, v1.0 · **Owner:** DEVCON 17 / Barangay AI Code Camp
**Surface:** static web app (Vite + vanilla JS) on Supabase (Postgres · Auth · Storage)
**Last updated:** 2026-09-05

This documents the product as built, and states the requirements it is held to.
Where this file and the code disagree, the code wins and this file is wrong.

---

## 1 · Summary

A three-hour, BYOD workshop where ~30 participants build, customize and deploy
their own locally-running AI. The checklist is the room's operating surface:
codelab instructions on one side, structured proof-of-completion capture on the
other, and a live facilitator desk behind it.

One sentence: **Codelabs crossed with Google Forms, so a camp finishes with
every participant holding a portfolio piece and every facilitator knowing who to
walk to next.**

## 2 · The problem

A hands-on camp of this size fails in three predictable ways, and none of them
are content problems.

| Failure | What it looks like in the room |
|---|---|
| **Silent stalls** | Someone hits the CORS dead-end at minute 40 and says nothing. Nobody notices for twenty minutes. |
| **Unverifiable completion** | "Done" is self-reported. Nobody knows whether the AI actually ran offline, or whether a screenshot was of the projector. |
| **Nothing to take home** | The laptop closes and the work evaporates. No artifact, no proof, no story to post. |

Paper checklists and Google Forms solve the third badly and the first two not at
all: a form has no notion of order, no live room view, and no way to hold a
screenshot next to the answer that claims it.

## 3 · Goals

**G1 — Every participant leaves with an artifact.** A self-contained project
write-up, or failing that a progress report. Nobody leaves with nothing.

**G2 — A facilitator can answer "who needs me right now" in under five seconds,
on a phone, while standing.**

**G3 — Completion means something.** A step is stamped only after a check, and
the proof required is a thing that cannot be produced without doing the work.

**G4 — The camp runs on venue wifi and a free tier.** No server to operate, no
per-seat cost, no ops on the day.

**G5 — Changing the camp is editing one file.** Content is data, not code.

### Non-goals

- Not a learning-management system. One camp, one day, one cohort.
- Not an authoring tool. Steps are edited in source and shipped by deploy.
- Not a replacement for the Barangay AI app itself; this is a companion.
- No password recovery, no email delivery, no notifications (see §7.1).
- No grading, scoring, certificates or leaderboards.

## 4 · Success metrics

| # | Metric | Target |
|---|---|---|
| M1 | Participants reaching 19/19 | ≥ 70% of signups |
| M2 | Participants who download a write-up **or** progress report | 100% of signups |
| M3 | Median facilitator time-to-notice on a raised alert | < 5 min |
| M4 | Setup failures traceable to the two email switches | 0 |
| M5 | Cross-account data leaks | 0, asserted by `scripts/rls-test.mjs` on every project before the doors open |
| M6 | Wrap-up and feedback completion (`h4d`) | ≥ 60% — this is the planning data for the next camp |

## 5 · Users

**Participant.** Brings their own laptop. Skill floor is "has used a computer" —
the steps explain how to open a terminal. Wants the thing to work, and wants
something to post afterwards. Has one browser tab and low patience for
navigation.

**Facilitator.** Walking the room holding a phone. Needs the room's state and
one person's detail, in that order. Is not the person who owns the Supabase
project, and turns up at 9am rather than at setup time.

**Organizer.** Sets the project up once, edits `camp.js` between camps, exports
the spreadsheet afterwards, and plans the next camp from it.

## 6 · Requirements

### 6.1 Access and identity

- **R1.1** Sign-up and sign-in are email + password. The address is an
  identifier only; nothing is ever mailed to it, so an undeliverable address
  works.
- **R1.2** Sign-up captures name and OS. Both are used downstream (roster,
  exports, OS-specific step copy).
- **R1.3** The gate reads `/auth/v1/settings` on load and names the exact
  misconfiguration on the page when the email provider is off or email
  confirmation is on. Nobody discovers this thirty people deep.
- **R1.4** Two roles: `participant` and `facilitator`. Role is server-owned; a
  participant cannot promote themselves by any client-reachable path.
- **R1.5** Sign-out clears the in-memory mirror and drops pending writes — the
  next person on that laptop must not see a flash of the last one's answers.

### 6.2 The working surface

- **R2.1** Steps are grouped into modules and rendered one at a time, with a
  sidebar rail showing every step's state.
- **R2.2** Instructions distinguish **do** from **read**: numbered actions,
  explanation, callouts, per-OS command labels, and optional install help behind
  a disclosure. Nothing outside an action list is an instruction.
- **R2.3** Every command block has a copy button.
- **R2.4** Progress is saved continuously and survives a reload on any machine
  in the room. A save indicator states the current state.

### 6.3 Proof capture

- **R3.1** Four proof types: `text`, `longtext`, `choice` (with options),
  `screenshot`. A proof is required or not; **optionality is derived** — a step
  with no required proof drops out of the completion gate automatically.
- **R3.2** Screenshots are accepted by click, drag-and-drop, and **Ctrl/Cmd+V
  anywhere on the step**. Paste is the primary path — it removes the
  save-file-then-browse detour.
- **R3.3** Images are downscaled to 1280px and encoded WebP at q0.72, falling
  back to JPEG where the canvas cannot write WebP. Stored at
  `<user-id>/<step-id>/<uuid>.<ext>` in a private bucket; the first path segment
  is the owner and is what every storage policy keys off.
- **R3.4** Where a step takes more than one screenshot, paste must name which
  field took it.
- **R3.5** Proof fields are designed as comprehension checks where possible —
  prefer a question that cannot be answered without doing the thing. A field
  whose wrong answer is a real problem (`h4b.keywhere` = *in my repo*) must not
  gate; it raises a facilitator alert instead. **An honest answer beats a gate
  people learn to click past.**

### 6.4 Stamping and order

- **R4.1** **Nobody stamps their own step.** One button per step does both jobs:
  it checks every required proof, stamps, plays the seal, and advances. It stays
  disabled while anything required is missing, and names what is missing.
- **R4.2** There is no unstamp. Answers stay editable; the stamp records a check
  that happened, and `doneAt` is never rewritten.
- **R4.3** An optional step with nothing submitted reads *Skip this step* and
  advances without stamping.
- **R4.4** Steps open in order. A step with an unfinished required step before it
  renders as a **Preview** — prose and copy buttons fully live, proof fields
  inert behind an overlay linking back. Reading ahead is the point; only
  submitting ahead is refused. Paste is refused on a preview.
- **R4.5** A step that is itself stamped is never shut, whatever sits behind it.

### 6.5 What the participant takes home

- **R5.1 Project documentation** — unlocks at 19/19. A portfolio piece: hero,
  key decisions, module-by-module build log with screenshots, references.
  Self-contained HTML with images inlined; prints cleanly to PDF.
- **R5.2 Progress report** — always available, finished or not. This exists
  because the write-up is gated on finishing and the people who stall are
  exactly the ones whose data is most useful (**G1**).
- **R5.3 Share sheet** — one sheet for every platform, editable post text, with
  the documentation file travelling alongside: attached via `navigator.share`
  where files are supported, saved to Downloads otherwise. The file is built when
  the sheet **opens**, not when a platform is picked, because share and popup
  calls are refused once user activation lapses. Never cached across openings.
- **R5.4 Privacy split.** Wrap-up and feedback is facilitator data, not portfolio
  material: it reaches Excel and the progress report and never the public
  write-up. Anything internal added later routes to Excel only.

### 6.6 The facilitator desk

Three questions, in the order a facilitator actually asks them.

- **R6.1 Who needs me right now.** An alerts strip turning specific answers into
  a reason to walk over (leaked key, CORS dead-end, publishing without a key,
  storage that keeps nothing, "never got it working"). Each alert names who, and
  tapping a name opens them.
- **R6.2 A quiet column** — time since last write, falling back to signup, so
  somebody who has typed nothing since walking in is the loudest row rather than
  an empty one. Coloured against the step they are on, not a flat number: ten
  quiet minutes on a one-liner is stuck, the same ten on a deploy is working.
- **R6.3** The roster sorts by need by default: unfinished first, longest silence
  first. Name and Progress are one tap away.
- **R6.4 Show** filters to *Not started · Working · Idle · Complete*. None is
  stored — all four are derived from numbers already on the row, so no status
  column can drift out of step with the stamps.
- **R6.5** Filters narrow the roster **and nothing above it**. Tiles, alerts and
  the chart answer *where is the room*; a question about the room must not
  quietly start answering about six selected people.
- **R6.6 Where the room is stuck.** One bar per step. The largest consecutive
  drop is marked, unless it restates the *Most are at* tile.
- **R6.7 One person's sheet.** Every answer, every screenshot, fork/repo/live
  URLs as links, enough to debug a broken deploy from the front of the room.
  Hand-typed URLs get a scheme check before becoming an `href`.
- **R6.8 Excel export.** One sheet, one row per participant: identity and build
  first, then the whole wrap-up and feedback block. Live signals stay in the desk
  where they are actionable. CSV fallback with identical columns if SheetJS
  fails to load. Facilitators' own rows are excluded — staff answers are test data.
- **R6.9 Mobile first.** Every roster row folds into four short lines at 360px.
  This is the surface most likely to be used on a phone.
- **R6.10 Live by default.** The desk updates on change where realtime is
  enabled, and falls back to a 30-second refetch plus a Refresh button where it
  is not, stating which mode it is in. Realtime is a nudge to refetch through
  PostgREST — it never widens what anyone can read.

### 6.7 Groups

- **R7.1** A participant belongs to at most one group. A group carries a short
  code (`4KQ2`) alongside its uuid: the uuid is for the join, the code is for
  saying out loud across a noisy room.
- **R7.2** The code is generated by the database, never typed, from an alphabet
  with `I L O 0 1` removed. A chosen code would collide, and the one guarantee
  required is that "table 4KQ2" means one table.
- **R7.3** **The facilitator assigns.** Group membership is a fact about the
  room, not about the work. `group_id` is frozen against self-edits the same way
  `role` is.
- **R7.4** Removing a group empties it; members stay on the roster with no group.
- **R7.5** The desk writes exactly one thing about a participant — which group
  they are in. It never touches answers, stamps or screenshots.

### 6.8 Handing over the desk

- **R8.1** The first facilitator is bootstrapped with one SQL statement. **Every
  facilitator after the first is made from the desk**, behind a passphrase.
- **R8.2** The passphrase is compared in Postgres, not in the browser. A constant
  checked in client JavaScript is a label on a door.
- **R8.3** The promotion RPC is the only way in: a direct `update ... set role`
  at PostgREST is silently reverted even for a facilitator.
- **R8.4** Promotion is one-way from the app. Demotion is an SQL Editor statement.
- **R8.5** A promoted participant **keeps their work on the roster**, tagged
  *Staff*. The desk hides always-staff accounts because setup clicking would
  otherwise land in the room's counts; that reasoning does not cover somebody who
  sat through the camp and got handed the desk at 2pm. `promoted_at` is what
  distinguishes the two.
- **R8.6** A promoted account gets the desk on the session it already holds — no
  sign-out and back in.

### 6.9 Content model

- **R9.1** The entire camp is one exported object in `src/camp.js`. Changing the
  camp means editing that file and nothing else (**G5**).
- **R9.2** Its head is the camp's identity — tagline, promise, arc, event, date,
  time, partners, hashtags — taken off the poster, so the app, the poster and the
  generated write-ups cannot drift apart.
- **R9.3** **The acronym never appears alone.** Every surface showing `BAICC`
  puts the full name where the reader can see it.
- **R9.4** Step IDs are load-bearing: the exports and the desk look up specific
  fields by `stepId.key`.
- **R9.5** Each step carries a `minutes` budget and a `mentorNote`. Mentor notes
  render inline for facilitators only.

## 7 · Data and security

**Model.** `profiles` (one per participant, mirrored from `auth.users` by a
signup trigger) · `progress` (one row per participant×step, answers as `jsonb`,
plus `done`/`done_at`) · `screenshots` (one per upload, bytes in the private
`proofs` bucket) · `groups` · flattened views `v_roster` and `v_submissions` for
export.

- **S1** RLS on every table. A participant reads and writes only their own rows;
  a facilitator reads the room. Views use `security_invoker`.
- **S2** Storage mirrors it: a participant reaches only objects under their own
  user-id prefix; a facilitator can sign any object in the bucket, which is what
  lets the desk show a proof without a second implementation.
- **S3** `role` and `group_id` are frozen by trigger against self-edit, with an
  `auth.uid() is null` escape hatch so the SQL Editor can bootstrap.
- **S4** The anon key is public by design; RLS is the protection. The service
  role key never enters the client.
- **S5** These claims are executable, not aspirational: `scripts/rls-test.mjs`
  signs up two real accounts and asserts cross-user isolation across tables,
  views, storage and both privilege-escalation paths. It is a release gate.

### 7.1 Accepted trade-offs

- **No password recovery.** Email confirmation must be off — Supabase's shared
  SMTP is rate-limited to a couple of sends an hour, so leaving it on means most
  of the room gets a `429` instead of an account. With no mail path there is no
  reset. For a one-day camp this is the right trade; it must be said out loud at
  the start, and a facilitator resets from the dashboard.
- **The passphrase is not a secret.** It is the event's name and it is in the
  README. Only facilitators can reach the RPC at all — RLS is the boundary. The
  passphrase is a deliberate pause in front of the one irreversible action on the
  desk. Treat it as the lock on a stationery cupboard, not on a safe.

## 8 · Design requirements

The DEVCON 17 identity applied as a poster system, not as stationery. Three hues
and no fourth: white ground, purple `#4725BA` primary, gold `#E8CA04` accent —
plus one deliberate exception, `--flag` red, because "blocked" must read as
different from "worth a look" from the front of a room.

- **D1** Four form devices, and anything added uses them rather than inventing a
  fifth: fills and elevation over outlines; pills for every control; the
  purple-to-gold transition used only as a mark of progress, in five places; the
  gold sparkle only where something is titled or finished.
- **D2** Montserrat 800 for headings and micro-labels, Inter for prose. Mono is
  reserved for things that are literally code or literally numbers — a mono
  status label reads as a machine log, and this is a room full of people.
- **D3** The VERIFIED seal is the signature element: single-colour purple,
  pressed on completion, honouring `prefers-reduced-motion`, and reappearing in
  the review sheet and both downloads. It is what makes the artifact feel like a
  credential.
- **D4** Two background modes — purple ground for the sign-in gate (the one
  screen nobody works in), white ground for the app (a three-hour working
  session is not a poster). Gold is never body text.
- **D5** Copy voice: plain, second person, active. Name the trade-off rather than
  hiding it. No exclamation marks, no "simply", no praise the participant hasn't
  earned.

## 9 · Non-functional

- **N1** Static build, any static host. No server to operate on the day.
- **N2** Rendering is synchronous off an in-memory mirror; exactly one module
  talks to Postgres and Storage.
- **N3** Thumbnails use short-lived signed URLs, batched — one call, not one
  round trip per image. A thumbnail that cannot be signed is a missing image and
  must never abort an upload or block a stamp.
- **N4** Writes are debounced and flushed on unload.
- **N5** Every surface works at 360px; the desk is designed for the phone first.
- **N6** Venue wifi is assumed hostile: models are pulled at home the night
  before, and the app degrades to manual refresh rather than breaking.

## 10 · Known gaps

Carried from the README, all deliberate and all still open.

1. **Sprint 4 is thin.** A pull-request step was removed at the client's request,
   leaving one deploy step plus wrap-up against a full sprint — and the Barangay
   AI app still promises a PR in its own guidebook. This is the one place the app
   and the checklist disagree without the app winning. Sprints 2 and 3 were
   extended instead, so the dead air sits only at the very end.
2. **The step budget overruns the room.** 280 minutes across 19 steps, 45 of it
   pre-camp, leaving 235 against a 180-minute camp. The estimates drive nothing
   but the desk's quiet thresholds, so this is a planning number: decide in
   advance what gets cut live. `h2e` and the persona half of `h3d` are cheapest
   to drop; `h2f` is the one worth protecting — it is the only step that
   demonstrates the camp's central claim.
3. **`p2` and `h2b` are pure self-report.** Nothing independently verifies them.
   Survivable because Sprint 2 fails loudly if either was skipped, but the data
   cannot stand alone.
4. **Screenshots soften at 1280 / 0.72** — occasionally lossy on small terminal
   text.
5. **The Excel export ignores groups and filters.** A workbook exported while the
   desk is narrowed to one table is nonetheless the entire room. That is the
   safer of the two surprises, but a *Group* column is one header entry and one
   field away.

## 11 · Candidate next work

Ordered by value to the next camp, not by effort.

| | Item | Why |
|---|---|---|
| P1 | **Group column in the Excel export** | Closes gap 5. Two lines. Team-table camps currently lose the one dimension they ran on. |
| P2 | **A per-group view on the desk** | Groups exist and are assignable, but the desk still answers per-person. "How is table 3 doing" is the question a team-table room actually asks. |
| P3 | **Restore a pull-request step** | Closes gap 1 and the only app/checklist disagreement. Needs the client's agreement, not code. |
| P4 | **Screenshot fidelity control** | Raise `shrink()` per proof type, so terminal captures stay legible while chat UIs stay small. |
| P5 | **Facilitator-side note on a participant** | The desk reads the room and writes one thing. A short private note per person is the obvious second, and the smallest one that stays inside "the desk never touches their work". |

## 12 · Open questions

- Is 19 steps the right shape for a 180-minute room, or should the pre-camp
  module be split into a separate surface people are sent a week ahead?
- Should completion be a shareable public URL rather than a downloaded file?
  Every current export is self-contained on purpose; a hosted write-up is a
  different privacy conversation.
- Does the room want a second camp's worth of content in the same app, or is one
  camp per deploy the right boundary? `camp.js` assumes the latter.
