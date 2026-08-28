# Barangay AI Code Camp — checklist

Codelabs crossed with Google Forms, for a 3-hour BYOD camp where participants
build and deploy their own local AI. Step-by-step instructions on one side,
structured proof-of-completion capture on the other.

Vite + vanilla JS on the front, Supabase (Postgres + Auth + Storage) behind it.
No framework, no server of your own.

- **Participants** work 19 steps in order, submitting answers and screenshots as
  they go. *Next step* is what stamps a step, and only unlocks once every
  required proof on it is in. All 19 required steps stamped, and a shareable
  project write-up unlocks.
- **Facilitators** get per-step mentor notes and a live view of the whole room:
  who to walk to next, where the room is stuck, and any one person's answers and
  screenshots on tap. Exportable to Excel.

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

Then [`0007_groups.sql`](supabase/migrations/0007_groups.sql), which adds the
`groups` table, `profiles.group_id` and the group columns on `v_roster`. It
drops and recreates `v_roster`, so run it after the ones above rather than
before them.

Then [`0008_promote_facilitator.sql`](supabase/migrations/0008_promote_facilitator.sql),
which lets a facilitator hand the desk to a second one from inside the app,
behind a passphrase. It adds `profiles.promoted_at` and so drops and recreates
`v_roster` again — run it after `0007`, not before. Skip it and promotion stays
an SQL Editor job; nothing else changes.

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
cannot promote themselves to facilitator — not by writing the column, and not by
calling the promotion RPC with the right passphrase. Add the elevated path with:

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

That is the bootstrap, and you only do it once. **Every facilitator after the
first is made from the desk** — open their name on the roster and use *Make them
a facilitator*. The passphrase is `DEVCON`, and it is checked in Postgres, not in
the browser. See [Handing over the desk](#handing-over-the-desk).

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
├── camp.js         all 19 steps — the only file you edit to change the camp
├── supabase.js     client + a legible failure when .env is missing
├── store.js        the only module that talks to Postgres and Storage
├── groups.js       make a group, name it, remove it, put somebody in one
├── promote.js      one call: hand a participant the desk, passphrase and all
├── steps.js        the working surface: prose, proofs, stamping
├── record.js       My project — review sheet, unlock panel, downloads
├── share.js        the share sheet — post text + the documentation file
├── doc.js          the two exports (portfolio write-up, progress report)
├── facilitator.js  the desk — alerts, the room, filters, one participant, Excel
├── ui.js           $, esc, toast, the stamp, image downscaling
└── main.js         auth, tabs, boot
```

### Changing the camp

Everything lives in the `CAMP` object in `src/camp.js`. Proof types are `text`,
`longtext`, `choice` (needs `options`) and `screenshot`.

The head of that object is the camp's identity, taken off the DEVCON 17 poster so
the app, the poster and the generated write-ups can't drift apart: `tagline`,
`promise`, `arc`, `event`, `date`, `time`, `partners`, `hashtags`. The gate renders
all of them; `doc.js` uses `event`, `date` and `hashtags`. Deliberately absent is a
list of models — the step bodies own that, and a second list here would be a rival
source of truth.

**The acronym never appears alone.** `code` is `BAICC-2026`, and every surface that
shows it puts the full name where the reader can see it: beside the `<h1>` in the
masthead, after the title in the gate eyebrow, spelled out in the write-up's
verified-completion line, and in the code pill's tooltip for the narrow layout that
hides its neighbour. `CAMP_NAME` exports the one form allowed on its own —
`BAICC (Barangay AI Code Camp)`. A new surface that can't fit the expansion should
use `CAMP.title` instead of the acronym.

**Optionality is derived, never declared:**

```js
optional: !s.proofs.some(p => p.required)
```

A step with no required proof drops out of the completion gate automatically and
renders a dashed sidebar dot. The consequence worth remembering: strip the last
`required: true` proof from a step and it silently stops counting toward the 19.

No step is optional right now: the old optional cloud-model step became required
when the connect-a-model walkthrough absorbed it, so all 19 count. The *Skip this
step* path is live code that nothing currently exercises.

Step IDs are load-bearing — `doc.js` and `facilitator.js` look up specific
fields by `stepId.key`, so renaming one means updating those lookups.

Five proof fields are deliberately comprehension checks rather than data entry:

- `h4b.keywhere` offers "In a file in my repo" as a pickable answer. Anyone who
  picks it needs their key rotated, not moved — the mentor note says so.
- `h1a.why` asks for RAM and GPU, so it can't be answered by copying a model
  name off the projector.
- `h3c.context` wants a capture of the *What the model actually read* panel.
  Impossible to produce without opening it — which is the moment "grounded, not
  trained" lands, and where the retrieved chunks visibly outweigh the question
  that was asked.
- `h2e.survived` offers "Gone — the list was empty" as a pickable answer,
  because a browser that refuses to persist anything is a real result and worth
  a facilitator rather than a retry. Nothing gates on it; the desk raises it.
- `h2f.shot` asks for the whole screen, wifi indicator included. A photo of the
  app answering proves nothing on its own — the disconnected icon in the same
  frame is the evidence, and it can't be produced without actually going
  offline.

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

**Project documentation** (participant, unlocks at 19/19) is a portfolio piece —
hero, key decisions, a module-by-module build log with screenshots, references.
Self-contained HTML with images inlined as data URIs; prints cleanly to PDF.

**Progress report** (participant, always available) is the working record:
every step, finished or not. This exists because the write-up is gated on
finishing, and the people who stall in Sprint 2 are exactly the ones whose data is
most useful. Nobody leaves with nothing to hand in.

**Excel** (facilitator) is one sheet, *Participants*, one row each, carrying
only what gets read after the room empties. Identity and build first — Name,
Model, Email, OS, GitHub, AI name, Live URL, GitHub repo URL, Completed — then
the whole wrap-up and feedback block: Pace, Hardest part, Could build again,
Would recommend, Stuck for, What next, Best bit, Feedback. That block is the
planning data for the next camp, so it ships complete rather than sampled. Live
signals — last activity, flags, per-step progress — stay in the desk, where they
are actionable; the per-field dump is gone. If SheetJS fails to load it falls
back to CSV with the same columns. Facilitators' own rows are excluded: staff
answers are test data.

A privacy split is enforced: `const PRIVATE = ['h4d']` keeps wrap-up and feedback out of
the public write-up. Pace ratings and "anything we should change" are facilitator
feedback, not portfolio material — they still reach Excel and the progress
report. The one exception is `h4d.hardest`, which surfaces in *What I learned*
because it reads as genuine reflection. **Preserve this distinction:** anything
internal, route to Excel only.

### The facilitator desk

Three questions, in the order a facilitator actually asks them.

**Who needs me right now.** Two signals, both at the top of the desk. The
**alerts strip** turns specific answers into a reason to walk over. The one that
matters most is `h4b.keywhere` = *In a file in my repo*: a live API key is
already public and needs **rotating**, not moving. Nothing gates on that answer
by design — an honest answer beats a gate people learn to click past — so the
desk shouts about it instead. Each alert names who, and tapping a name opens
them. The others are the CORS dead-end (`p2.restarted` = *Not yet*), publishing
without a key, a browser that keeps nothing across a reload (`h2e.survived` =
*Gone*, which will also eat their settings, sources and published file), and
anyone who says in wrap-up and feedback that they never got it working.
Adding one is a row in the `ALERTS` table in `facilitator.js`.

The **quiet column** is time since a participant's last write, from
`v_roster.last_activity_at` and falling back to signup — so somebody who has
typed nothing since they walked in is the loudest row rather than an empty one.
It is coloured against the step they are actually on, not a flat number:
`camp.js` budgets steps between 5 and 25 minutes, so the thresholds are that
budget and 1.5× it, with floors of 8 and 15 minutes. Ten quiet minutes on the
CORS one-liner is someone stuck; the same ten on *Deploy to Vercel* is someone
working. The roster sorts by need by default — unfinished first, longest silence
first — with Name and Progress a tap away, because alphabetical is the one
ordering that carries no information and you still sometimes need to find one
person by name.

**Show** narrows the roster to one of four states: *Not started*, *Working*,
*Idle*, *Complete*. None of them is stored — every one is derived from the same
numbers the row already shows, so there is no status column to drift out of step
with the stamps. *Idle* borrows the quiet column's per-step thresholds exactly,
which is why the pill and the colouring always agree. The four partition the
room: someone silent since signup is *Not started* rather than *Idle*, because of
the two facts that is the more specific one and the row spells out the silence
next to it either way.

The filters narrow the roster and nothing above it. The tiles, the alerts strip
and the bar chart answer *where is the room*, and a question about the room
should not quietly start answering about the six people you have selected —
"4 complete" is a number that gets read out loud.

**Where the room is stuck.** One bar per step, counting who has stamped it. The
biggest drop between two consecutive steps gets a marker, *unless* that drop is
the same step the *Most are at* tile already names: counts only ever fall, so
mid-camp the two usually coincide and marking it would restate the tile. It
fires on the case worth seeing — a step people reached and could not get past
while others moved on.

**What one person is looking at.** Tapping any row opens their record: every
answer, every screenshot, and their fork, repo and live URL as links. RLS and the
`proofs` storage policy already permit this, so the desk reuses `signedUrls()`
from `store.js` rather than growing a second implementation. Enough to debug a
broken deploy from the front of the room instead of leaning over a keyboard.
Hand-typed URLs get a scheme check before they become an `href`, and a bare
`your-ai.vercel.app` gets `https://` prepended, since that is what the field hint
asks for.

Two things the desk deliberately does not read from `v_roster`. Progress comes
off the `progress` table so the count matches the participant's own rail
(required steps only), and the step someone is on is derived from *which* steps
are stamped rather than from how many — people skip one and come back, and a
count read as a position puts them further along than they are.

The desk is built to be used on a phone, because that is what a facilitator is
holding while walking the room: every roster row folds into four short lines at
360px, and the masthead gives up a line so the list gets the screen.

### Groups

A room run at team tables has a question the per-person roster cannot answer:
*how is table 3 doing*. So a participant may belong to one group, and a group
carries a short code — `4KQ2` — alongside its uuid. The uuid is for the join;
the code is for saying out loud.

The code is generated by the database and never typed. Four characters drawn
from an alphabet with `I`, `L`, `O`, `0` and `1` removed, because these get read
across a noisy room. A code somebody chose would collide, and the one thing the
list has to guarantee is that "table 4KQ2" means one table.

**The facilitator assigns.** Groups are made in the *Groups* sheet on the desk
and people are put in one from their own sheet, opened by tapping their name.
Which table someone is sitting at is a fact about the room, not about the work —
the person who arranged the room is the one who knows it, and a picker at signup
would only produce a room where three people chose *Group 1* by accident. That
means `profiles.group_id` is frozen against self-edits the same way `role` is:
`freeze_group()` in `0007`, mirroring `freeze_role()`, with the same
`auth.uid() is null` escape hatch for the SQL Editor. `rls-test.mjs` asserts it.

Removing a group empties it. The foreign key is `on delete set null`, so its
members stay on the roster with no group rather than going with it.

The desk reads the room and says where to walk. It writes exactly one thing —
which group somebody is in — and those four verbs live in `src/groups.js` so the
exception stays one small named module. Nothing on the desk touches a
participant's answers, their stamps or their screenshots.

It hands over one other thing, and only one: the desk itself.

### Handing over the desk

A camp usually has more than one facilitator, and the second one turns up at
9am, not at setup time. Bootstrapping the first account is an SQL Editor job
(§6) and that is fine once; making it the only route means a room where the
person who can answer questions has to go find whoever owns the Supabase
project. So promotion moved into the desk: open somebody's sheet from the
roster and *Make them a facilitator*, passphrase `DEVCON`.

**The passphrase is compared in Postgres, not in the browser.** A constant
checked in client JavaScript is a label on a door — the bundle ships to every
laptop in the room and anyone can read it out of devtools and call PostgREST by
hand. So the word lives in `promotion_passphrase()` and the check lives in
`promote_to_facilitator()`, a `security definer` function that asks *who is
this* before it asks *what did they type*. A participant who knows the word is
turned away before it is ever compared, and `rls-test.mjs` asserts exactly that.

For the passphrase to mean anything, that function has to be the only way in.
So `0008` narrows `freeze_role()` a third time: 0001 froze the column against
everyone but a facilitator, 0006 swapped that for *is a real user making this
change* so the SQL Editor could bootstrap, and 0008 narrows the signed-in case
from "is a facilitator" to "came through the RPC" — which the function signals
with a transaction-local `set_config`. A facilitator writing
`update profiles set role = 'facilitator'` straight at PostgREST now gets the
same silent revert a participant gets. `auth.uid() is null` is still the escape
hatch, so §6 works as written.

Be clear-eyed about what this buys. Only facilitators can reach the RPC at all —
RLS and `is_facilitator()` are the security boundary, and they were already
there. The passphrase is a second factor in front of the one irreversible thing
on the desk, and a deliberate pause before handing someone every participant's
answers and screenshots. It is not a secret: it is the event's own name, it is
in this file, and by lunchtime it will have been said out loud. Treat it as the
lock on a stationery cupboard, not on a safe.

Promotion is one-way from the app. Demotion is a single statement in the SQL
Editor, where `auth.uid()` is null and the trigger stands aside:

```sql
update public.profiles set role = 'participant' where email = 'them@example.com';
```

A promoted account gets the desk on the session it is already holding — no
sign-out and back in — because `is_facilitator()` reads the table rather than
the JWT.

**Their own work stays on the roster.** The desk hides facilitators on purpose:
whoever sets a project up walks the steps to check the app works, and that
clicking would otherwise land in the room's counts, the per-step chart and the
spreadsheet as if it were somebody's morning. That reasoning covers the account
that was staff before the doors opened. It is exactly wrong for someone who sat
through the whole camp and got handed the desk at 2pm — their stamps are as real
as anyone's, and dropping them at the moment of promotion would be losing data.

`role` alone cannot tell those two apart, so the promotion records itself:
`promoted_at` is null for always-staff and a timestamp for *was a participant*.
The roster keeps the second kind, tagged **Staff** under the name, and their
sheet says when they were promoted instead of offering to promote them again.
`rls-test.mjs` asserts a promoted account keeps the steps it stamped.

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
gated on 19/19, because a step can be stamped out of order on older data:
someone who has not finished still lands on the page that tells them what is
left, with their progress report downloadable either way.

### Screenshots

Click, drag-drop, or **Ctrl/Cmd+V anywhere on the step**. Paste is the important
one — it removes the save-file-then-browse detour, the single biggest friction
reduction in the app. Images are downscaled to 1280px at quality 0.72 and
encoded as WebP before upload — about 40% smaller than the JPEG it replaced, on
both the bucket and the desk view's thumbnail refetches — falling back to JPEG
on a browser whose canvas can't write WebP. They are stored under
`<user-id>/<step-id>/<uuid>.<webp|jpg>` in the private `proofs`
bucket. The first path segment is the owner, which is what every storage policy
keys off. Paste is refused on a step that has not opened yet — see *Stamping, and
the order steps open in*.

Thirteen of the 19 steps take a screenshot: `p1`, `p3`, `h1c`, `h2a`, `h2c`,
`h2d`, `h2e`, `h2f`, `h3a`, `h3c`, `h3d`, `h4a`, `h4b` — fourteen fields in all,
because `h3c` takes two. The rule is that an image earns its place when it shows something no field
can assert — a URL you can click is better evidence than a photo of a page.

`h3c` is also the only step where paste has to choose a field. Ctrl/Cmd+V files
under the drop zone that has focus, then the last one clicked or dropped on, and
only then the first — and the toast names which field took it, so a mis-aimed
paste doesn't pass unnoticed.

---

## Design language

The official DEVCON 17 identity, applied as a poster system rather than as
stationery. Don't restyle without reason, and don't introduce a fourth hue.

```
white  #FFFFFF   ground
purple #4725BA   primary - headlines, controls, progress, the VERIFIED seal
gold   #E8CA04   accent - the acronym badge, the finish state, progress edges
```

```
derived  panel #F6F3FD  panel-2 #EAE3F9  ink #1C0F4A  soft #574C7A
         faint #8981A8  rule #E4DDF5  stamp-tint #EDE7FB  gold-tint #FDF6D2
warn     #7A6600 + tint #FCF3C9   - the gold hue pushed to text contrast
flag     #C8102E + tint #FBE7EA   - the one deliberate exception
```

`--flag` is red rather than a second gold on purpose: "blocked" has to read as
different from "worth a look" from the front of a room, and gold cannot carry
both. Everything else stays inside the three.

### The four form devices

The palette is only half of it. The form comes from the DEVCON 17 key visual,
and four devices carry it. Anything added to the app should use them rather than
inventing a fifth:

1. **Fills and elevation, not outlines.** Almost nothing has a border. Panels
   are flat tinted shapes lifted off the ground by soft purple shadow (`--lift`,
   `--lift-2`), which is why the radii are large — 12px on controls, 14–22px on
   panels — and the few hairlines left are quiet `--rule`.
2. **Pills.** Every control is fully rounded: buttons, tabs, segments, chips,
   status pills, the acronym badge, the toast.
3. **The purple-to-gold transition** (`--grad`), used as a mark of progress and
   never as decoration. It appears in exactly five places: the leading edge of
   the progress rail, the short bar under a section heading, the top edge of a
   command block, the avatar, and the write-up's title rule. Note the rail is a
   *solid purple bar with a gold leading edge* rather than a gradient fill — a
   gradient compressed into a 10%-wide bar reads as a bug.
4. **The gold four-point sparkle**, the brand's own decorative element, as a
   data-URI mask in `--spark` so it inherits `currentColor`. Used only where
   something is titled or finished: module labels, the finish panel, the seal.

### Type

Montserrat ExtraBold (800) for headings — the kit's own fallback for Proxima
Nova Extrabold, which isn't a web font — at the brand's **92% leading** on every
display-sized headline, and `.95` elsewhere so two-line UI headings don't
collide. Inter for prose.

**Micro-labels are Montserrat, not mono, and this matters more than the
palette.** Mono is now reserved for things that are literally code or literally
numbers: commands, keyboard keys, step counts, timestamps, file paths, URLs. A
mono label on a status pill reads as a machine log, and this is a room full of
people. If you add a label, it goes in Montserrat 800 uppercase.

### The seal

The stamp is the signature element. Completing a step presses a rotated
**single-colour purple** VERIFIED seal — the brand sparkle, the word, the step
number and timestamp, all in the one ink, because that is what a seal is. It
animates with a scale-and-rotate press that respects `prefers-reduced-motion`,
and reappears in the review sheet and both downloads. Keep it; it's what makes
the artifact feel like a credential.

### The two background modes

Both of the brand's modes are in use, as the kit describes them. The sign-in
gate runs **purple ground, white headline, gold key phrase**, with concentric
rings from the key visual behind it — it's the one screen nobody works in, so it
gets to look like the poster on the wall. The app itself runs **white ground,
purple headlines, gold accents**, because a three-hour working session is not a
poster. Gold is never body text; at 4.7:1 against white it cannot be.

Both downloads share the palette and the devices. The write-up takes the larger
display setting because it's an editorial piece rather than a working tool.


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

1. **Sprint 4 is thin.** A pull-request step was removed at the client's request,
   leaving one deploy step plus wrap-up and feedback against a full sprint — and
   the app still promises a PR in its own guidebook (*Hour 4 … open your first
   Pull Request*), which is the one place the app and this checklist disagree
   without the app winning. Deliberate, not an oversight. Sprint 2 and Sprint 3
   were extended instead (`h2e`, `h2f`, `h3d`), so the dead air now sits only at
   the very end.
2. **The step budget overruns the room.** `minutes` across the 19 steps totals
   280, of which 45 is pre-camp — leaving 235 against a 180-minute camp. It was
   already over before `h2e`, `h2f` and `h3d` added 30. Those estimates are
   generous per step and drive nothing but the desk's quiet-column thresholds, so
   this is a planning number rather than a bug: decide in advance what gets cut
   live. `h2e` and the persona half of `h3d` are the cheapest to drop, `h2f` is
   the one worth protecting — it is the only step that demonstrates the camp's
   central claim.
3. **`p2` and `h2b` are pure self-report.** Neither has a screenshot, so nothing
   independently verifies them. Acceptable because Sprint 2 fails loudly if either
   was skipped and `h2c`'s screenshot catches it — but the data can't stand alone.
4. **Screenshots soften at 1280px / 0.72.** Fine for chat UIs, occasionally lossy
   on small terminal text. Raise it in `shrink()` if legibility complaints appear.
5. **Realtime needs `0002`.** Without that migration the desk shows "Manual
   refresh" and refetches on a 30-second timer instead of on change — slower to
   notice a stamp, but not dependent on the Refresh button. With realtime on, the
   same timer re-renders without refetching, because how long someone has been
   quiet changes while nothing happens.
6. **Email confirmation.** Leave it on and signups fail with a rate-limit error
   — `429 over_email_send_rate_limit`, shown as *"Too many attempts just now"* —
   after roughly the second account, because Supabase is trying to mail every
   undeliverable `.test` address through a shared SMTP capped at a couple of
   sends an hour. Waiting never clears it; the gate says so and names the
   setting. Turn it off under **Authentication → Sign In / Providers → Email**,
   then run `0004_confirm_camp_users.sql` for the accounts already stranded.
   The app checks `/auth/v1/settings` at boot and warns before anyone tries.
7. **The Excel export ignores groups and filters.** `exportXlsx()` still walks
   the whole roster and its 17 columns carry no group, so a workbook exported
   while the desk is narrowed to one table is nonetheless the entire room. That
   is the safer of the two surprises — an export that silently dropped two
   thirds of the camp would be worse — but a *Group* column is one entry in the
   header array and one `p.group_code` in the row, if the day wants it.
