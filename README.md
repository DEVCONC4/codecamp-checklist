# Barangay AI Code Camp — checklist

Codelabs crossed with Google Forms, for a 4-hour BYOD camp where participants
build and deploy their own local AI. Step-by-step instructions on one side,
structured proof-of-completion capture on the other.

Vite + vanilla JS on the front, Supabase (Postgres + Auth + Storage) behind it.
No framework, no server of your own.

- **Participants** work 16 steps, submitting answers and screenshots as they go.
  Stamp all 15 required steps and a shareable project write-up unlocks.
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

Then run [`0003_username_auth.sql`](supabase/migrations/0003_username_auth.sql),
which switches login to usernames and drops the email column.

Finally, [`0002_realtime.sql`](supabase/migrations/0002_realtime.sql) to make the
facilitator room update live. It's optional — skip it and the desk falls back to
its Refresh button, showing "Manual refresh" instead of "Live". It doesn't widen
what anyone can read: a realtime event is only a nudge to refetch through
PostgREST, where RLS still decides what comes back.

Using the CLI instead? `supabase db push` picks them all up in order.

[`0004_confirm_camp_users.sql`](supabase/migrations/0004_confirm_camp_users.sql)
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

### 4 · Turn OFF email confirmation

**Authentication → Sign In / Providers → Email → uncheck "Confirm email".**

Participants sign in with a **username**, never an email — but Supabase Auth
still requires an address internally, so the app registers
`<username>@codecamp.test`. `.test` is reserved by RFC 6761: it can never
resolve and can never receive mail, so nothing is ever delivered anywhere and
no address can collide with something real.

Leaving confirmation on breaks the camp anyway. Supabase would try to mail every
one of those undeliverable addresses, and the built-in shared SMTP is
rate-limited to a couple of messages per hour on the free tier — so most of the
room simply could not create an account. With it off, no mail is ever sent and
there is no rate limit to hit.

The app makes exactly two auth calls, `signUp` and `signInWithPassword`. There
is no magic link, OTP or password reset anywhere, so email delivery is never on
the critical path.

> **No password reset.** Nobody can recover a forgotten password without a real
> address. For a one-day camp that is the right trade, but say it out loud at
> the start, and be ready to reset one from the dashboard.

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
node scripts/rls-test.mjs --facilitator yourusername yourpassword
```

It prints cleanup SQL for the accounts it created.

### 6 · Make yourself a facilitator

Sign up through the app first, then promote that account:

```sql
update public.profiles set role = 'facilitator' where username = 'yourname';
```

Sign out and back in. A **Facilitator** tab appears, and mentor notes start
showing inline under each step.

---

## How it fits together

```
src/
├── camp.js         all 16 steps — the only file you edit to change the camp
├── supabase.js     client + a legible failure when .env is missing
├── store.js        the only module that talks to Postgres and Storage
├── steps.js        the working surface: prose, proofs, stamping
├── record.js       My project — review sheet, unlock panel, downloads
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
`required: true` proof from a step and it silently stops counting toward the 15.

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

### Screenshots

Click, drag-drop, or **Ctrl/Cmd+V anywhere on the step**. Paste is the important
one — it removes the save-file-then-browse detour, the single biggest friction
reduction in the app. Images are downscaled to 1280px at JPEG 0.72 before upload,
then stored under `<user-id>/<step-id>/<uuid>.jpg` in the private `proofs`
bucket. The first path segment is the owner, which is what every storage policy
keys off.

Only 7 of the 16 steps take a screenshot: `p1`, `p3`, `h2a`, `h2c`, `h3a`,
`h4a`, `h4b`. The rule is that an image earns its place when it shows something
no field can assert — a URL you can click is better evidence than a photo of a
page.

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
