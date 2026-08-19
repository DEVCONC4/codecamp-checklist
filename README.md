# Barangay AI Code Camp — checklist

Codelabs crossed with Google Forms, for a 4-hour BYOD camp where participants
build and deploy their own local AI. Step-by-step instructions on one side,
structured proof-of-completion capture on the other.

Vite + vanilla JS on the front, Supabase (Postgres + Auth + Storage) behind it.
No framework, no server of your own.

- **Participants** work 16 steps in order, submitting answers and screenshots as
  they go. *Next step* is what stamps a step, and only unlocks once every
  required proof on it is in. All 16 required steps stamped, and a shareable
  project write-up unlocks.
- **Facilitators** get per-step mentor notes and a live view of the whole room,
  exportable to Excel.

---

## Setup

### 1 · Create the database

In your Supabase project, open **SQL Editor** and run
[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) as one
paste. It is idempotent — safe to re-run.

It creates:

| | |
|---|---|
| `profiles` | one row per participant, mirrored from `auth.users` by a signup trigger |
| `progress` | one row per (participant, step) — answers as `jsonb`, plus `done` / `done_at` |
| `screenshots` | one row per upload; the bytes live in the private `proofs` bucket |
| `v_roster`, `v_submissions` | flattened views for the Excel export |
| RLS on everything | participants see only their own rows; facilitators see the room |

Then run [`0003_username_auth.sql`](supabase/migrations/0003_username_auth.sql)
and [`0005_email_login.sql`](supabase/migrations/0005_email_login.sql), in that
order. `0003` moved login to usernames behind synthetic addresses; `0005` undoes
that and puts login back on plain email + password. Both are listed because the
pair is what a project applying migrations in order will run — starting fresh,
the state you end up in is the same either way.

Then [`0006_fix_role_promotion.sql`](supabase/migrations/0006_fix_role_promotion.sql),
which lets you promote your own facilitator account in step 6 — without it that
promotion silently reverts.

Finally, [`0002_realtime.sql`](supabase/migrations/0002_realtime.sql) to make the
facilitator room update live. It's optional — skip it and the desk falls back to
its Refresh button, showing "Manual refresh" instead of "Live". It doesn't widen
what anyone can read: a realtime event is only a nudge to refetch through
PostgREST, where RLS still decides what comes back.

Using the CLI instead? `supabase db push` picks them all up in order.

[`0004_confirm_existing_users.sql`](supabase/migrations/0004_confirm_existing_users.sql)
is a repair, not a step: run it only if accounts were created before you turned
email confirmation off in step 4. It matches nothing on a correctly configured
project.

> **If the storage policies error out**, your project restricts `storage.objects`
> to the dashboard. Skip that block and recreate the three policies under
> **Storage → proofs → Policies** with the same conditions.

The views use `security_invoker`, which needs Postgres 15+. Every current
Supabase project qualifies.

### 2 · Point the app at it

```bash
cp .env.example .env.local
```

Fill in both values from **Project settings → API**:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

The anon key is meant to be public — RLS is what protects the data, not the key.
Never put the **service role** key in here; it bypasses RLS entirely.

### 3 · Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

`npm run build` emits a static `dist/`.

### Deploying

[`vercel.json`](vercel.json) is set up for it — import the repo and Vercel picks
up the Vite preset, the build command and long-lived caching for hashed assets.

**Set both env vars in the Vercel project *before* the first build.** Vite
inlines `VITE_*` at build time, so a deploy that builds without them ships an app
that shows the "Supabase isn't configured" card. Add `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` under **Settings → Environment Variables** for all
environments, then redeploy if you'd already built once.

Nothing here is Vercel-specific — any static host works.

### 4 · Set the two email switches

Both are on one page — **Authentication → Sign In / Providers → Email** — and
they are easy to mix up, so check them against this:

| | |
|---|---|
| **Enable email provider** | **ON** — off means *"Email signups are disabled"* and nobody can sign up or sign in at all |
| **Confirm email** | **OFF** — on means signups start failing with a rate-limit error after roughly the second account |

Login is plain email + password. Nothing is ever mailed: with confirmation off,
the app makes exactly two auth calls, `signUp` and `signInWithPassword`, and
there is no magic link, OTP or password reset anywhere. The address is only ever
an identifier, so an address that cannot receive mail works fine.

That is also why confirmation has to be off. Leave it on and Supabase mails a
confirmation link to every new account, the built-in shared SMTP is rate-limited
to a couple of messages an hour, and most of the room gets `429` instead of an
account — and anyone who did get through is stuck on *"Email not confirmed"*
until [`0004_confirm_existing_users.sql`](supabase/migrations/0004_confirm_existing_users.sql)
releases them.

The gate reads `/auth/v1/settings` on load and says so on the page if either
switch is wrong, so you find out before thirty people do.

> **No password reset.** With confirmation off there is no mail path, so nobody
> can recover a forgotten password. For a one-day camp that is the right trade,
> but say it out loud at the start, and be ready to reset one from the dashboard.

### 5 · Check it

```bash
node scripts/probe.mjs      # tables, views, bucket, anon access, confirm-email state
node scripts/rls-test.mjs   # two throwaway accounts, proves cross-user isolation
```

`rls-test.mjs` is the one that matters. It signs up two real accounts and
asserts that B cannot read, update, insert-as, or delete A's rows; that
`v_roster` and `v_submissions` leak nothing across users; that B cannot reach
A's screenshots in storage or mint a signed URL for them; and that a participant
cannot promote themselves to facilitator. Add the elevated path with:

```bash
node scripts/rls-test.mjs --facilitator you@example.com yourpassword
```

It prints cleanup SQL for the accounts it created.

### 6 · Make yourself a facilitator

Sign up through the app first, then promote that account:

```sql
update public.profiles set role = 'facilitator' where email = 'you@example.com';
```

Sign out and back in. A **Facilitator** tab appears, and mentor notes start
showing inline under each step.

> **If the role snaps back to `participant`**, you are on a project that never
> got [`0006_fix_role_promotion.sql`](supabase/migrations/0006_fix_role_promotion.sql).
> Run it and try again. Before that migration the `freeze_role` trigger reverted
> any role change not made by an existing facilitator — and `auth.uid()` is null
> in the SQL Editor, so it caught the one promotion that has to work there. It
> fails silently: the statement reports success and the row is unchanged, which
> is what makes it worth naming here. Admin is no way around it either, since
> `service_role` bypasses RLS but not triggers.
>
> To promote without applying `0006`, take the trigger out of the way for the
> one statement:
>
> ```sql
> alter table public.profiles disable trigger profiles_freeze_role;
> update public.profiles set role = 'facilitator' where email = 'you@example.com';
> alter table public.profiles enable trigger profiles_freeze_role;
> ```
>
> Run all three together, and don't leave it disabled — that trigger is what
> stops a participant promoting themselves.

---

## How it fits together

```
src/
├── camp.js         all 16 steps — the only file you edit to change the camp
├── supabase.js     client + a legible failure when .env is missing
├── store.js        the only module that talks to Postgres and Storage
├── steps.js        the working surface: prose, proofs, stamping
├── record.js       My project — review sheet, unlock panel, downloads
├── share.js        the share sheet — post text + the documentation file
├── doc.js          the two exports (portfolio write-up, progress report)
├── facilitator.js  the room + Excel export
├── ui.js           $, esc, toast, the stamp, image downscaling
└── main.js         auth, tabs, boot
```

### Changing the camp

Everything lives in the `CAMP` object in `src/camp.js`. Proof types are `text`,
`longtext`, `choice` (needs `options`) and `screenshot`.

**Optionality is derived, never declared:**

```js
optional: !s.proofs.some(p => p.required)
```

A step with no required proof drops out of the completion gate automatically and
renders a dashed sidebar dot. The consequence worth remembering: strip the last
`required: true` proof from a step and it silently stops counting toward the 16.

No step is optional right now: the old optional cloud-model step became required
when the connect-a-model walkthrough absorbed it, so all 16 count. The *Skip this
step* path is live code that nothing currently exercises.

Step IDs are load-bearing — `doc.js` and `facilitator.js` look up specific
fields by `stepId.key`, so renaming one means updating those lookups.

Three proof fields are deliberately comprehension checks rather than data entry:

- `h4b.keywhere` offers "In a file in my repo" as a pickable answer. Anyone who
  picks it needs their key rotated, not moved — the mentor note says so.
- `h1a.why` asks for RAM and GPU, so it can't be answered by copying a model
  name off the projector.
- `h3c.qa` asks which chunk the Sources panel pulled and what the match score
  was. Unanswerable without opening the panel — which is the moment
  "grounded, not trained" lands.

Design new fields the same way: prefer a question that can't be answered without
doing the thing.

### Stamping, and the order steps open in

**Nobody stamps their own step.** There is one button on a step and it does both
jobs: *Next step* checks every required proof, stamps the step, plays the stamp,
then moves on. It stays disabled while anything required is missing, and
`#missingOut` names what — so being verified and moving on are the same action,
and a stamp can never sit on a step that was not checked first. There is no
unstamp: an answer stays editable, but the stamp is a record of a check that
happened.

Two deliberate exceptions:

- An **optional** step with nothing submitted reads *Skip this step* and moves on
  without stamping. A stamp on an untouched step would be a lie about what was
  done.
- A step already stamped just navigates. `doneAt` is the moment it was earned and
  is never rewritten.

**Steps open in order.** `blockerFor(id)` returns the first required step before
this one that is not stamped; while it returns something, the step renders as a
**Preview** — prose, code blocks and copy buttons fully live, the proof fields
blurred behind `inert` and a *Finish step N first* overlay that links back. The
sidebar keeps every step clickable, because reading ahead is the point; only
submitting ahead is refused. Ctrl/Cmd+V is refused on a preview too, so a pasted
screenshot cannot land on a step that has not opened.

One carve-out worth keeping: a step that is *itself* stamped is never shut,
whatever sits behind it. Accounts carrying stamps from before the order was
enforced would otherwise have their own finished answers hidden behind a preview.

### The two exports, and why they differ

**Project documentation** (participant, unlocks at 15/15) is a portfolio piece —
hero, key decisions, a module-by-module build log with screenshots, references.
Self-contained HTML with images inlined as data URIs; prints cleanly to PDF.

**Progress report** (participant, always available) is the working record:
every step, finished or not. This exists because the write-up is gated on
finishing, and the people who stall in Hour 2 are exactly the ones whose data is
most useful. Nobody leaves with nothing to hand in.

**Excel** (facilitator) has two sheets. *Roster* is one row per participant.
*Submissions* is one row per field per participant, which pivots easily. If
SheetJS fails to load it falls back to CSV.

A privacy split is enforced: `const PRIVATE = ['h4d']` keeps the wrap-up out of
the public write-up. Pace ratings and "anything we should change" are facilitator
feedback, not portfolio material — they still reach Excel and the progress
report. The one exception is `h4d.hardest`, which surfaces in *What I learned*
because it reads as genuine reflection. **Preserve this distinction:** anything
internal, route to Excel only.

### Sharing

The **Share** button on *My project* opens one sheet for every platform, rather
than a LinkedIn-only clipboard copy. The post text is editable, and the
documentation file travels with it: on browsers that support sharing files it
goes out attached through `navigator.share`, and everywhere else it saves to
Downloads the moment a platform is picked, because neither LinkedIn nor Facebook
accepts an attachment through a share URL.

The file is built when the sheet **opens**, not when a platform is picked, and
the tiles stay disabled until it is ready. That ordering is load-bearing:
inlining a dozen screenshots takes seconds, and both `navigator.share` and
`window.open` are refused once the click that triggered them no longer counts as
user activation. For the same reason `openOn` is synchronous — clipboard first
while the page still has focus, composer last. It is rebuilt for every opening,
never cached across them, or an edited answer would share a stale write-up.

Facebook is the one tile that needs a link, since its sharer takes a URL and
nothing else; it falls back to the repo when there is no Vercel URL yet. X gets
the post trimmed to 280 at a word boundary.

Adding a platform is one entry in `PLATFORMS` in `src/share.js`: a label, a note
and an `href(text, url)`.

### Finishing

On the last step (`h4d`) that same button reads **Finish →**: it stamps the step
like any other, then hands over to *My project* — where the documentation, the
share sheet and the progress report all live. The handover is deliberately not
gated on 15/15, because a step can be stamped out of order on older data:
someone who has not finished still lands on the page that tells them what is
left, with their progress report downloadable either way.

### Screenshots

Click, drag-drop, or **Ctrl/Cmd+V anywhere on the step**. Paste is the important
one — it removes the save-file-then-browse detour, the single biggest friction
reduction in the app. Images are downscaled to 1280px at JPEG 0.72 before upload,
then stored under `<user-id>/<step-id>/<uuid>.jpg` in the private `proofs`
bucket. The first path segment is the owner, which is what every storage policy
keys off. Paste is refused on a step that has not opened yet — see *Stamping, and
the order steps open in*.

Only 8 of the 16 steps take a screenshot: `p1`, `p3`, `h2a`, `h2c`, `h2d`,
`h3a`, `h4a`, `h4b`. The rule is that an image earns its place when it shows
something no field can assert — a URL you can click is better evidence than a
photo of a page.

---

## Design language

A workshop logbook: riso-style duotone on cool oat paper. Don't restyle without
reason.

```
paper #EDEFE8 · panel #E4E7DE · ink #17211C · soft #5D6A62 · rule #C6CCBD
viridian (verified) #17594A + tint #D9E6DF
ink-pink (required/alert) #B8244A + tint #F2DCE2
```

Space Grotesk for headings, Newsreader for body prose, JetBrains Mono for
labels, step numbers, status pills and all uppercase micro-copy. The downloaded
write-up uses the same palette on a lighter ground (`#F7F8F4`) with larger
display type, because it's an editorial piece rather than a working tool.

The stamp is the signature element. Completing a step presses a rotated viridian
VERIFIED stamp carrying the step number and timestamp, animated with a
scale-and-rotate press that respects `prefers-reduced-motion`. It reappears in
the review sheet and both downloads. Keep it — it's what makes the artifact feel
like a credential.

**Copy voice:** plain, second person, active. Name the trade-off rather than
hiding it. No exclamation marks, no "simply", no praise the participant hasn't
earned.

---

## Content source of truth

Step content is written against the Barangay AI app itself (`../context/`).
Where the app and this checklist disagree about a command, a URL or an order of
operations, **the app wins** — this is a companion to it, not a replacement.

---

## Known gaps

1. **Hour 4 is thin.** A pull-request step was removed at the client's request,
   leaving one deploy step plus a wrap-up against a full hour. Expect dead air
   near the end; consider extending Hour 3 or adding a closing activity.
2. **`p2` and `h2b` are pure self-report.** Neither has a screenshot, so nothing
   independently verifies them. Acceptable because Hour 2 fails loudly if either
   was skipped and `h2c`'s screenshot catches it — but the data can't stand alone.
3. **Screenshots soften at 1280px / 0.72.** Fine for chat UIs, occasionally lossy
   on small terminal text. Raise it in `shrink()` if legibility complaints appear.
4. **Realtime needs `0002`.** Without that migration the desk shows "Manual
   refresh" and updates only when you press the button.
5. **Email confirmation.** Leave it on and signups fail with a rate-limit error
   — `429 over_email_send_rate_limit`, shown as *"Too many attempts just now"* —
   after roughly the second account, because Supabase is trying to mail every
   undeliverable `.test` address through a shared SMTP capped at a couple of
   sends an hour. Waiting never clears it; the gate says so and names the
   setting. Turn it off under **Authentication → Sign In / Providers → Email**,
   then run `0004_confirm_camp_users.sql` for the accounts already stranded.
   The app checks `/auth/v1/settings` at boot and warns before anyone tries.
