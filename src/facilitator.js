// The desk. The old POC made participants download a write-up and email it so
// the facilitator could re-parse it; with a database the room is just a query,
// and incomplete participants show up automatically instead of contributing
// nothing. RLS decides who may see this, not a PIN in the client bundle.
//
// Three questions, in the order a facilitator actually asks them:
//
//   who needs me right now             the alerts strip, then the quiet column
//   where is the room stuck            the per-step chart
//   what is this one person looking at  tap their name
//
// The desk reads the room and says where to walk. It writes exactly one thing:
// which group somebody is in. That is a fact about the room rather than about
// the work — only the person who arranged the tables knows it, and there is
// nowhere else for it to come from. Those four verbs live in groups.js so the
// exception stays visible; nothing in this file touches a participant's answers.
//
// It hands one other thing over: the desk itself, when a second facilitator
// turns up. That is behind a passphrase the database checks, not this file —
// promote.js posts it, 0008 compares it.
import { supabase } from './supabase.js';
import { CAMP, STEPS, REQ, TOTAL, stepById, stepNumber } from './camp.js';
import { signedUrls } from './store.js';
import { listGroups, createGroup, renameGroup, deleteGroup, assignGroup } from './groups.js';
import { promoteToFacilitator } from './promote.js';
import { $, $$, esc, toast, download, slug, zoom, stampHTML } from './ui.js';

let roster = [];
let subs = [];
let groups = [];         // groups rows, ordered by code
let answer = new Map();  // `user|step|field` -> value
let stamped = new Set(); // `user|step` for a stamped step
let stampAt = new Map(); // `user|step` -> when it was stamped
let sort = 'need';       // need | name | progress
let status = 'all';      // all | new | live | idle | done
let group = 'all';       // all | '' (nobody's group) | a group id

const shotCache = new Map();

const LABEL = {};
for (const s of STEPS) for (const p of s.proofs) LABEL[`${s.id}.${p.key}`] = p.label;

// ── how long is too long ─────────────────────────────────────────────
// Silence only means something next to what the step was supposed to cost, and
// camp.js already carries that estimate — steps run from 5 minutes to 25. Ten
// quiet minutes on the CORS one-liner is someone stuck; on "deploy to Vercel"
// it is someone working. So the budget sets the threshold, and these are the
// floors under it, because a short step still deserves a few minutes' reading.
const IDLE_WARN = 8;
const IDLE_BAD = 15;

// ── the tripwires ────────────────────────────────────────────────────
// Answers that mean "go to this person", lifted out of the mentor notes that
// used to ask a facilitator to watch for them by eye. The key question is the
// reason this strip exists: it is self-reported and nothing blocks on it, so
// an honest answer is only worth having if the desk shouts about it.
const ALERTS = [
  {
    step: 'h4b', key: 'keywhere', is: 'In a file in my repo',
    level: 'bad', tag: 'KEY',
    title: 'API key committed to a public repo',
    what: 'Go now. The key is already public, so it needs rotating at the provider — moving it into Vercel is only the second half of the fix.',
  },
  {
    step: 'h4d', key: 'stuck', is: 'I never got it working',
    level: 'bad', tag: 'NEVER RAN',
    title: 'Says they never got it working',
    what: 'They are filling in wrap-up and feedback having never seen it run. Catch them before they leave the room.',
  },
  {
    step: 'p2', key: 'restarted', is: 'Not yet',
    level: 'warn', tag: 'CORS',
    title: 'Ollama not restarted after setting OLLAMA_ORIGINS',
    what: 'The classic Sprint 2 dead-end: the server looks healthy and every request from the browser fails. Have them restart Ollama, or point them at the bundled script in Sprint 2.',
  },
  {
    step: 'h2e', key: 'survived', is: 'Gone — the list was empty',
    level: 'warn', tag: 'NO STORAGE',
    title: 'Browser is not keeping anything',
    what: 'Conversations gone after a reload means storage is blocked — a private window, or site data refused for localhost. The same block will eat their settings, their sources and their published file, so it is cheaper to move them to a normal window now than at Publish.',
  },
  {
    step: 'h4b', key: 'keywhere', is: "I haven't added one yet",
    level: 'warn', tag: 'NO KEY',
    title: 'Published, but no model key yet',
    what: 'Their live link loads and then answers nothing. Two minutes at Vercel → Settings → Environment Variables, then a redeploy.',
  },
];

// ── live updates ─────────────────────────────────────────────────────
// The realtime event is only a nudge to refetch — never the data itself.
// loadRoom() goes back through PostgREST, so RLS decides what the facilitator
// actually sees and we never depend on realtime honouring it.
let channel = null;
let clock = null;
let live = 'off'; // off | connecting | live | manual

export const liveState = () => live;

export function subscribeRoom(onData, onStatus) {
  if (channel) return;
  let t = null;
  const nudge = () => { clearTimeout(t); t = setTimeout(onData, 700); };

  live = 'connecting';
  channel = supabase
    .channel('camp-room')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'progress' }, nudge)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, nudge)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, nudge)
    .subscribe((state) => {
      // Realtime may be disabled for these tables, or blocked by the network.
      // Either way the desk still works — it just needs the Refresh button.
      if (state === 'SUBSCRIBED') live = 'live';
      else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') live = 'manual';
      onStatus?.();
    });

  // How long someone has been quiet is the one number that changes while
  // nothing happens, so a silent room still has to re-render — it is exactly
  // then that the column matters. With no socket the same tick does the
  // fetching, which turns the manual fallback into a slow live view rather
  // than a button somebody has to remember to press.
  clock = setInterval(() => (live === 'live' ? onStatus?.() : onData()), 30000);
}

export function unsubscribeRoom() {
  clearInterval(clock);
  clock = null;
  if (!channel) return;
  supabase.removeChannel(channel);
  channel = null;
  live = 'off';
}

export async function loadRoom() {
  const [r, s, g, gr] = await Promise.all([
    supabase.from('v_roster').select('*').order('name'),
    supabase.from('v_submissions').select('*'),
    // Straight off the table: the roster view can only count stamps, and the
    // desk needs to know *which* steps they were. RLS hands the whole room to
    // a facilitator and one row to everyone else.
    supabase.from('progress').select('user_id, step_id, done, done_at'),
    // The full list, not just the groups somebody is in — an empty group still
    // has to be pickable, or it could never be filled.
    listGroups(),
  ]);
  if (r.error) throw r.error;
  if (s.error) throw s.error;
  if (g.error) throw g.error;

  groups = gr;
  roster = (r.data || []).filter((p) => p.role !== 'facilitator');

  // A group can be deleted while its filter is the one on screen. Falling back
  // to everyone is better than an empty roster with no visible cause.
  if (group !== 'all' && group !== '' && !groups.some((x) => x.id === group)) group = 'all';
  const ids = new Set(roster.map((p) => p.id));

  // Staff answers are test data. They are already out of the roster; keep them
  // out of the room's numbers and out of the spreadsheet too.
  subs = (s.data || []).filter((x) => ids.has(x.user_id));

  answer = new Map();
  for (const x of subs) answer.set(`${x.user_id}|${x.step_id}|${x.field_key}`, x.value || '');

  stamped = new Set();
  stampAt = new Map();
  for (const x of g.data || []) {
    if (!x.done || !ids.has(x.user_id)) continue;
    const k = `${x.user_id}|${x.step_id}`;
    stamped.add(k);
    if (x.done_at) stampAt.set(k, new Date(x.done_at).getTime());
  }

  shotCache.clear();
}

const field = (userId, stepId, key) => answer.get(`${userId}|${stepId}|${key}`) || '';
const isDone = (userId, stepId) => stamped.has(`${userId}|${stepId}`);

// Counted against the required steps only, so the number on the desk is the
// same number the participant sees on their own progress rail.
const doneCount = (userId) => REQ.reduce((n, s) => n + (isDone(userId, s.id) ? 1 : 0), 0);

// The first required step they have not stamped. Derived from which steps are
// done rather than from how many — people skip one and come back, and a count
// read as a position puts them further along than they actually are.
const nextStep = (userId) => REQ.find((s) => !isDone(userId, s.id)) || null;

// Never null: someone who signed up and has typed nothing has been quiet since
// they walked in, and that is precisely the person worth surfacing.
const idleMs = (p) => Date.now() - new Date(p.last_activity_at || p.created_at).getTime();
const idleMin = (p) => Math.floor(idleMs(p) / 60000);

function ago(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m quiet`;
  return `${Math.floor(m / 60)}h ${m % 60}m quiet`;
}

// What the step in front of them was budgeted to take, and the two thresholds
// that follow from it.
function idleBands(p) {
  const budget = nextStep(p.id)?.minutes || 10;
  return { budget, warn: Math.max(IDLE_WARN, budget), bad: Math.max(IDLE_BAD, Math.round(budget * 1.5)) };
}

const idleLevel = (p) => {
  if (doneCount(p.id) >= TOTAL) return '';
  const { warn, bad } = idleBands(p);
  const m = idleMin(p);
  return m >= bad ? 'bad' : m >= warn ? 'warn' : '';
};

// A URL typed by hand, about to become an href on a facilitator's screen. Only
// http(s) survives; a bare host gets a scheme, since the hint on the live-URL
// field asks for `your-ai.vercel.app` and most people write exactly that.
function safeHref(v) {
  const s = String(v || '').trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(s)) return 'https://' + s;
  return '';
}

const flagsFor = (userId) => ALERTS.filter((a) => field(userId, a.step, a.key) === a.is);

// ── the room ─────────────────────────────────────────────────────────

const LIVE_PILL = {
  live: ['on', 'Live'],
  connecting: ['wait', 'Connecting'],
  manual: ['off', 'Manual refresh'],
  off: ['off', ''],
};

function livePill() {
  const [cls, text] = LIVE_PILL[live] || LIVE_PILL.off;
  if (!text) return '';
  return `<span class="livepill ${cls}"><i></i>${text}</span>`;
}

const SORTS = {
  // Who to walk to next: unfinished first, longest silence at the top.
  need: (a, b) => {
    const ca = doneCount(a.id) >= TOTAL;
    const cb = doneCount(b.id) >= TOTAL;
    if (ca !== cb) return ca ? 1 : -1;
    return idleMs(b) - idleMs(a) || doneCount(a.id) - doneCount(b.id);
  },
  name: (a, b) => String(a.name || '').localeCompare(String(b.name || '')),
  progress: (a, b) => doneCount(b.id) - doneCount(a.id) || idleMs(b) - idleMs(a),
};

const SORT_LABEL = { need: 'Needs attention', name: 'Name', progress: 'Progress' };

// ── the four states somebody can be in ───────────────────────────────
// Derived, not stored — there is no status column and there should not be one,
// because every one of these is already visible in a row and would only drift
// if it were written down. Idle borrows the same per-step budget thresholds as
// the coloured Quiet-for column, so the pill and the column agree by
// construction rather than by coincidence.
//
// The four real buckets partition the roster exactly: idleLevel() returns ''
// once somebody is complete, and idle needs at least one stamp. Someone who
// signed up and has said nothing for forty minutes lands in Not started rather
// than Idle — of the two facts that is the more specific one, and the row
// already spells out the silence next to it.
const STATUS = {
  all:  { label: 'Everyone',    is: () => true },
  new:  { label: 'Not started', is: (p) => doneCount(p.id) === 0 },
  live: { label: 'Working',     is: (p) => { const n = doneCount(p.id); return n > 0 && n < TOTAL && !idleLevel(p); } },
  idle: { label: 'Idle',        is: (p) => doneCount(p.id) > 0 && !!idleLevel(p) },
  done: { label: 'Complete',    is: (p) => doneCount(p.id) >= TOTAL },
};

const inGroup = (p) => group === 'all' || (group === '' ? !p.group_id : p.group_id === group);
const filtered = () => (status === 'all' && group === 'all' ? roster : roster.filter((p) => (STATUS[status] || STATUS.all).is(p) && inGroup(p)));

const groupLabel = (g) => (g.name ? `${g.code} · ${g.name}` : g.code);

function alertsHTML() {
  const hits = ALERTS
    .map((a) => ({ a, who: roster.filter((p) => field(p.id, a.step, a.key) === a.is) }))
    .filter((h) => h.who.length)
    .sort((x, y) => (x.a.level === y.a.level ? 0 : x.a.level === 'bad' ? -1 : 1));
  if (!hits.length) return '';

  return `<div class="alerts">${hits
    .map(({ a, who }) => `<div class="alert ${a.level}">
      <span class="eyebrow">${a.level === 'bad' ? 'Go now' : 'Worth a look'} · ${who.length} ${who.length === 1 ? 'person' : 'people'}</span>
      <strong>${esc(a.title)}</strong>
      <p>${esc(a.what)}</p>
      <div class="chips">${who
        .map((p) => `<button type="button" class="chip" data-user="${esc(p.id)}">${esc(p.name || '(no name)')}</button>`)
        .join('')}</div>
    </div>`)
    .join('')}</div>`;
}

// Where the wall is. One bar per step, and a marker on the biggest single drop
// between two consecutive required steps — that gap is the thing to stop the
// room and re-explain, and it is invisible in a per-person roster.
//
// `frontier` is the step the most people have in front of them, which the stats
// above already name. Counts only ever fall, so mid-camp the biggest drop is
// usually just the frontier; marking it there would restate the tile rather
// than point at a cliff, so in that case the marker stays off.
function wallHTML(frontier) {
  const list = REQ.concat(STEPS.filter((s) => s.optional));
  const counts = list.map((s) => roster.filter((p) => isDone(p.id, s.id)).length);

  let wall = -1;
  if (roster.length >= 3) {
    let worst = 0;
    for (let i = 1; i < REQ.length; i++) {
      const drop = counts[i - 1] - counts[i];
      if (drop > worst) { worst = drop; wall = i; }
    }
    if (wall >= 0 && list[wall].id === frontier) wall = -1;
  }

  return `<div class="tablewrap">
    <table class="wall">
    <caption>Stamped, step by step</caption>
    <thead><tr>
      <th scope="col" class="c-n">#</th>
      <th scope="col">Step</th>
      <th scope="col" class="c-bar">Stamped by</th>
      <th scope="col" class="c-num">Of ${roster.length}</th>
    </tr></thead>
    <tbody>${list
      .map((s, i) => {
        const pct = roster.length ? Math.round((counts[i] / roster.length) * 100) : 0;
        return `<tr${i === wall ? ' class="drop"' : ''}>
          <td class="c-n">${stepNumber(s.id)}</td>
          <th scope="row" class="c-step">${esc(s.title)}${
            i === wall ? '<span class="wtag">stalls here</span>' : ''}</th>
          <td class="c-bar"><span class="wbar">${pct ? `<i style="width:${pct}%"></i>` : ''}</span></td>
          <td class="c-num">${counts[i]}</td>
        </tr>`;
      })
      .join('')}</tbody>
    </table>
  </div>`;
}

export function renderRoom() {
  const out = $('#roomOut');
  if (!out) return;

  if (!roster.length) {
    out.innerHTML = `${livePill()}<div class="empty"><div class="big">Nobody has signed up yet</div>
      Participants appear here the moment they create an account.</div>`;
    return;
  }

  // The filters narrow the roster and nothing above it. The tiles, the alerts
  // strip and the wall chart answer "where is the room", and a question about
  // the room should not quietly start answering about six of its people —
  // "4 complete" meaning four out of the group you happen to have selected is
  // the kind of number that gets read out loud and is then wrong.
  const shown = filtered();

  const complete = roster.filter((p) => doneCount(p.id) >= TOTAL).length;
  const started = roster.filter((p) => doneCount(p.id) > 0).length;
  const avg = Math.round(roster.reduce((a, p) => a + doneCount(p.id), 0) / roster.length);
  const attention = roster.filter(
    (p) => idleLevel(p) === 'bad' || flagsFor(p.id).some((f) => f.level === 'bad'),
  ).length;

  // Where the room actually is: the step the most people have in front of them
  // is the one to talk about from the front.
  const at = {};
  for (const p of roster) {
    const s = nextStep(p.id);
    if (s) at[s.id] = (at[s.id] || 0) + 1;
  }
  const worst = Object.entries(at).sort((a, b) => b[1] - a[1])[0];

  out.innerHTML = `
    ${livePill()}
    ${alertsHTML()}
    <dl class="stats">
      <div><dt>Signed up</dt><dd>${roster.length}</dd></div>
      <div><dt>Started</dt><dd>${started}</dd></div>
      <div><dt>Complete</dt><dd>${complete}</dd></div>
      <div><dt>Average steps</dt><dd>${avg}/${TOTAL}</dd></div>
      <div><dt>Needs attention</dt><dd class="${attention ? 'bad' : ''}">${attention}</dd></div>
      <div><dt>Most are at</dt><dd class="sm">${
        worst ? `${stepNumber(worst[0])} · ${esc(stepById(worst[0]).title)}` : 'Everyone is finished'
      }</dd></div>
    </dl>
    ${wallHTML(worst?.[0])}
    <div class="rosterhead">
      <span class="eyebrow">${shown.length === roster.length ? `${roster.length} in the room` : `${shown.length} of ${roster.length} in the room`}</span>
      <span class="sp"></span>
      <span class="eyebrow">Group</span>
      <select class="gpick" id="groupPick" aria-label="Show one group">
        <option value="all"${group === 'all' ? ' selected' : ''}>All groups</option>
        <option value=""${group === '' ? ' selected' : ''}>No group</option>
        ${groups.map((g) => `<option value="${esc(g.id)}"${group === g.id ? ' selected' : ''}>${esc(groupLabel(g))}</option>`).join('')}
      </select>
    </div>
    <div class="rosterhead tight">
      <span class="eyebrow">Show</span>
      <div class="segs" role="group" aria-label="Filter the roster by status">${Object.keys(STATUS)
        .map((k) => `<button type="button" class="seg" data-status="${k}" aria-pressed="${k === status}">${STATUS[k].label}</button>`)
        .join('')}</div>
      <span class="sp"></span>
      <span class="eyebrow">Sort</span>
      <div class="segs" role="group" aria-label="Sort the roster">${Object.keys(SORTS)
        .map((k) => `<button type="button" class="seg" data-sort="${k}" aria-pressed="${k === sort}">${SORT_LABEL[k]}</button>`)
        .join('')}</div>
    </div>
    <div class="tablewrap">
    <table class="roster">
      <caption>Tap anyone to see their answers and screenshots.</caption>
      <thead><tr>
        ${th('Name', 'c-name', 'name')}
        ${th('Group', 'c-group')}
        ${th('OS', 'c-os')}
        ${th('Progress', 'c-bar', 'progress')}
        ${th('Steps', 'c-num')}
        ${th('Up next', 'c-next')}
        ${th('Flags', 'c-flags')}
        ${th('Quiet for', 'c-quiet', 'need')}
      </tr></thead>
      <tbody>${
        shown.length
          ? [...shown].sort(SORTS[sort] || SORTS.need).map(rowHTML).join('')
          : `<tr class="rnone"><td colspan="8">Nobody in the room matches that.
               <button type="button" class="btn btn-ghost btn-sm" data-clear>Show everyone</button></td></tr>`
      }</tbody>
    </table>
    </div>`;

  $$('#roomOut [data-sort]').forEach((b) =>
    b.addEventListener('click', () => { sort = b.dataset.sort; renderRoom(); }),
  );
  $$('#roomOut [data-status]').forEach((b) =>
    b.addEventListener('click', () => { status = b.dataset.status; renderRoom(); }),
  );
  $('#groupPick').addEventListener('change', (ev) => { group = ev.target.value; renderRoom(); });
  $$('#roomOut [data-clear]').forEach((b) =>
    b.addEventListener('click', () => { status = 'all'; group = 'all'; renderRoom(); }),
  );
  $$('#roomOut [data-user]').forEach((b) =>
    b.addEventListener('click', () => openParticipant(b.dataset.user)),
  );
}

// The code carries and the name follows it, because the code is what gets said
// out loud and what stays put when a group is renamed. An unassigned row says
// so quietly rather than leaving a hole the eye reads as missing data.
function groupCell(p) {
  if (!p.group_id) return '<span class="nogroup">—</span>';
  return `<span class="gtag">${esc(p.group_code || '')}</span>${p.group_name ? `<span class="gname">${esc(p.group_name)}</span>` : ''}`;
}

function th(label, cls, sortedBy = '') {
  const on = sortedBy && sort === sortedBy;
  return `<th scope="col" class="${cls}"${on ? ' aria-sort="descending"' : ''}>${label}</th>`;
}

function rowHTML(p) {
  const n = doneCount(p.id);
  const pct = Math.round((n / TOTAL) * 100);
  const done = n >= TOTAL;
  const next = nextStep(p.id);
  const lvl = idleLevel(p);
  const flags = flagsFor(p.id);
  const quiet = n === 0 && idleMin(p) >= IDLE_WARN ? 'not started · ' + ago(idleMs(p)) : ago(idleMs(p));
  const hot = lvl === 'bad' || flags.some((f) => f.level === 'bad');
  // Why this one is coloured and the one above it isn't.
  const why = done ? '' : ` title="${next ? `Step ${stepNumber(next.id)} is budgeted at ${idleBands(p).budget} min` : ''}"`;

  // The row is clickable, and the name is a real button inside it — the whole
  // row for a mouse, one focus stop and Enter for a keyboard. The click on the
  // button bubbles to the row, so the handler is bound once either way.
  return `<tr class="rline${hot ? ' hot' : ''}" data-user="${esc(p.id)}">
    <th scope="row" class="c-name"><button type="button" class="rowbtn">${esc(p.name || '(no name)')}</button></th>
    <td class="c-group" data-label="Group">${groupCell(p)}</td>
    <td class="c-os" data-label="OS">${esc(p.os || '')}</td>
    <td class="c-bar" data-label="Progress"><span class="minirail">${pct ? `<i style="width:${pct}%"></i>` : ''}</span></td>
    <td class="c-num" data-label="Steps">${n}<span class="of">/${TOTAL}</span></td>
    <td class="c-next" data-label="Up next">${done ? '<span class="ok">Complete</span>' : next ? `<span class="sn">${stepNumber(next.id)}</span>${esc(next.title)}` : '—'}</td>
    <td class="c-flags" data-label="Flags">${flags.map((f) => `<span class="rflag ${f.level}">${f.tag}</span>`).join('')}</td>
    <td class="c-quiet ${lvl}" data-label="Quiet for"${why}>${done ? '' : quiet}</td>
  </tr>`;
}

// ── one participant ──────────────────────────────────────────────────
// The read a participant gets of their own record, opened over the desk:
// answers, screenshots, links. Enough to debug a broken deploy from the front
// of the room instead of leaning over somebody's keyboard.

async function loadShots(userId) {
  if (shotCache.has(userId)) return shotCache.get(userId);
  const { data, error } = await supabase
    .from('screenshots')
    .select('id, step_id, field_key, path, name')
    .eq('user_id', userId)
    .order('created_at');
  if (error) return {};
  const urls = await signedUrls((data || []).map((x) => x.path));
  const by = {};
  for (const x of data || []) (by[x.step_id] ||= []).push({ ...x, url: urls[x.path] || '' });
  shotCache.set(userId, by);
  return by;
}

export async function openParticipant(userId) {
  const p = roster.find((x) => x.id === userId);
  if (!p) return;

  const n = doneCount(p.id);
  const flags = flagsFor(p.id);
  const links = [
    ['Live site', field(p.id, 'h4b', 'liveurl')],
    ['Repo', field(p.id, 'h4a', 'repo')],
    ['Fork', field(p.id, 'h1b', 'forkurl')],
  ].filter(([, v]) => v);

  const el = document.createElement('div');
  el.className = 'sheet';
  el.innerHTML = `<div class="sheet-in" role="dialog" aria-modal="true" aria-labelledby="pTitle">
    <button class="sheet-x" id="pClose" title="Close" aria-label="Close">×</button>
    <span class="eyebrow">${esc(p.os || '')}${p.email ? ' · ' + esc(p.email) : ''}</span>
    <h3 id="pTitle">${esc(p.name || '(no name)')}</h3>
    <p class="sheet-lede">${n}/${TOTAL} stamped · ${n >= TOTAL ? 'complete' : ago(idleMs(p))}${
      field(p.id, 'h3a', 'ainame') ? ' · building ' + esc(field(p.id, 'h3a', 'ainame')) : ''
    }</p>
    ${flags.length
      ? `<div class="alerts tight">${flags
          .map((f) => `<div class="alert ${f.level}"><strong>${esc(f.title)}</strong><p>${esc(f.what)}</p></div>`)
          .join('')}</div>`
      : ''}
    <div class="passign">
      <label class="eyebrow" for="pGroup">Group</label>
      <select class="gpick" id="pGroup">
        <option value=""${p.group_id ? '' : ' selected'}>No group</option>
        ${groups.map((g) => `<option value="${esc(g.id)}"${p.group_id === g.id ? ' selected' : ''}>${esc(groupLabel(g))}</option>`).join('')}
      </select>
    </div>
    <form class="ppromote" id="pPromote" autocomplete="off">
      <label class="eyebrow" for="pPass">Make them a facilitator</label>
      <div class="prow">
        <input type="password" id="pPass" placeholder="Passphrase" autocomplete="off"
               aria-describedby="pPromoteNote">
        <button type="submit" class="btn btn-sm" id="pPromoteGo">Promote</button>
      </div>
      <p class="pnote" id="pPromoteNote">Hands over the desk: every participant's answers and screenshots, and the power to do this again. They leave the roster.</p>
    </form>
    ${links.length
      ? `<div class="plinks">${links
          .map(([k, v]) => {
            const href = safeHref(v);
            return href
              ? `<a href="${esc(href)}" target="_blank" rel="noopener"><span class="eyebrow">${k}</span>${esc(v)}</a>`
              : `<span class="dead"><span class="eyebrow">${k}</span>${esc(v)}</span>`;
          })
          .join('')}</div>`
      : ''}
    <div id="pBody"><p class="nowt">Loading their screenshots…</p></div>
    <div class="sheet-foot"><span class="sp"></span><button class="btn btn-ghost btn-sm" id="pDone">Close</button></div>
  </div>`;

  document.body.appendChild(el);

  const close = () => {
    el.remove();
    document.removeEventListener('keydown', onKey);
  };
  function onKey(ev) {
    if (ev.key === 'Escape') close();
  }
  document.addEventListener('keydown', onKey);
  el.addEventListener('click', (ev) => { if (ev.target === el) close(); });
  $('#pClose', el).addEventListener('click', close);
  $('#pDone', el).addEventListener('click', close);

  // The everyday write on the desk. Disabled while it is in flight so a fast
  // second change cannot race the first, and the roster underneath is rebuilt
  // from the database rather than patched — the group's code and name live on
  // the view, not on the option that was picked.
  const pick = $('#pGroup', el);
  pick.addEventListener('change', async () => {
    const was = p.group_id || '';
    pick.disabled = true;
    try {
      await assignGroup(userId, pick.value);
      await loadRoom();
      renderRoom();
      const g = groups.find((x) => x.id === pick.value);
      toast(g ? `${p.name || 'They'} → ${groupLabel(g)}` : `${p.name || 'They'} → no group`);
    } catch (e) {
      pick.value = was;
      toast("Couldn't change their group — " + e.message);
    } finally {
      // The sheet can be closed mid-write; re-enabling a detached node is
      // harmless, but there is nothing to re-enable if it went with it.
      if (pick.isConnected) pick.disabled = false;
    }
  });

  // The rare one. No confirm() in front of it — typing a passphrase is already
  // the deliberate act, and a dialog on top of it would only teach people to
  // dismiss dialogs. The word is not checked here; it goes to the database,
  // which is the only place a check would mean anything (see promote.js).
  //
  // On success they are staff, and loadRoom() drops them from the roster —
  // facilitators are filtered out of it — so the sheet is closed rather than
  // left open on somebody who is no longer there.
  const promote = $('#pPromote', el);
  const pass = $('#pPass', el);
  const go = $('#pPromoteGo', el);
  promote.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!pass.value.trim()) { pass.focus(); return; }
    pass.disabled = go.disabled = true;
    try {
      await promoteToFacilitator(userId, pass.value);
      close();
      await loadRoom();
      renderRoom();
      toast(`${p.name || 'They'} is a facilitator now — off the roster, on the desk`);
    } catch (e) {
      // Postgres wrote the message ("That passphrase is not right."), so say it
      // rather than inventing a friendlier one that hides which check failed.
      toast("Couldn't promote them — " + e.message);
      if (pass.isConnected) {
        pass.disabled = go.disabled = false;
        pass.value = '';
        pass.focus();
      }
    }
  });

  const shots = await loadShots(userId);
  // The sheet can be closed while the signed URLs are still coming back, and
  // a stale node is harmless to skip.
  if (!el.isConnected) return;

  $('#pBody', el).innerHTML = REQ.concat(STEPS.filter((s) => s.optional))
    .map((s) => {
      const num = stepNumber(s.id);
      const ans = s.proofs.filter((x) => x.type !== 'screenshot' && field(userId, s.id, x.key));
      const pics = shots[s.id] || [];
      return `<div class="rrow">
        <div class="num">${num}</div>
        <div>
          <h4>${esc(s.title)}</h4>
          ${ans.length
            ? `<dl class="answers">${ans
                .map((x) => `<dt>${esc(x.label)}</dt><dd>${esc(field(userId, s.id, x.key))}</dd>`)
                .join('')}</dl>`
            : '<p class="nowt">Nothing submitted yet</p>'}
          ${pics.length
            ? `<div class="rshots">${pics
                .map((x) => `<img src="${esc(x.url)}" data-zoom="${esc(x.url)}" alt="${esc(x.name)}">`)
                .join('')}</div>`
            : ''}
        </div>
        <div class="rstamp">${
          isDone(userId, s.id)
            ? stampHTML(num, stampAt.get(`${userId}|${s.id}`))
            : '<span class="pill">Not stamped</span>'
        }</div>
      </div>`;
    })
    .join('');

  $$('#pBody [data-zoom]', el).forEach((img) =>
    img.addEventListener('click', () => zoom(img.dataset.zoom)),
  );
}

// ── the group list ───────────────────────────────────────────────────
// Make the tables, then put people at them. Kept off the roster on purpose:
// creating and deleting groups is a two-minute job at the start of the day,
// and it should not sit permanently beside the thing the desk is actually for.
//
// The code is generated by the database and shown, never typed. A code someone
// chose would collide, and the one thing this list has to guarantee is that
// "table 4KQ2" means one table.

export async function openGroups() {
  const el = document.createElement('div');
  el.className = 'sheet';
  el.innerHTML = `<div class="sheet-in" role="dialog" aria-modal="true" aria-labelledby="gTitle">
    <button class="sheet-x" id="gClose" title="Close" aria-label="Close">×</button>
    <span class="eyebrow">Facilitator only</span>
    <h3 id="gTitle">Groups</h3>
    <p class="sheet-lede">Each group gets a short code the moment you make it. Put people in one from their name on the roster.</p>
    <div id="gBody"></div>
    <div class="gnew">
      <input type="text" id="gName" placeholder="Name the group — Table 1, Team Mango…" autocomplete="off">
      <button class="btn btn-primary btn-sm" id="gAdd">Add group</button>
    </div>
    <div class="sheet-foot"><span class="sp"></span><button class="btn btn-ghost btn-sm" id="gDone">Close</button></div>
  </div>`;

  document.body.appendChild(el);

  const close = () => {
    el.remove();
    document.removeEventListener('keydown', onKey);
  };
  function onKey(ev) {
    if (ev.key === 'Escape') close();
  }
  document.addEventListener('keydown', onKey);
  el.addEventListener('click', (ev) => { if (ev.target === el) close(); });
  $('#gClose', el).addEventListener('click', close);
  $('#gDone', el).addEventListener('click', close);

  // Every mutation goes back through loadRoom() before anything is redrawn, so
  // the sheet and the desk behind it are two views of one fetch rather than two
  // guesses that have to be kept in step.
  async function sync() {
    await loadRoom();
    renderRoom();
    if (el.isConnected) draw();
  }

  function draw() {
    const body = $('#gBody', el);
    if (!groups.length) {
      body.innerHTML = '<p class="nowt">No groups yet. Add the first one below.</p>';
      return;
    }

    body.innerHTML = `<div class="glist">${groups
      .map((g) => {
        const n = roster.filter((p) => p.group_id === g.id).length;
        return `<div class="grow">
          <span class="gtag">${esc(g.code)}</span>
          <input type="text" class="gedit" value="${esc(g.name)}" data-rename="${esc(g.id)}"
                 placeholder="Unnamed" aria-label="Name of group ${esc(g.code)}">
          <span class="gcount">${n} ${n === 1 ? 'person' : 'people'}</span>
          <button type="button" class="btn btn-ghost btn-sm" data-drop-group="${esc(g.id)}">Remove</button>
        </div>`;
      })
      .join('')}</div>`;

    // Rename on blur rather than per-keystroke: this is a text field somebody
    // is typing into, and a write per character would fight the refetch.
    $$('#gBody [data-rename]', el).forEach((input) => {
      const was = input.value;
      input.addEventListener('blur', async () => {
        if (input.value.trim() === was.trim()) return;
        input.disabled = true;
        try {
          await renameGroup(input.dataset.rename, input.value);
          await sync();
        } catch (e) {
          input.value = was;
          input.disabled = false;
          toast("Couldn't rename that group — " + e.message);
        }
      });
      input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') input.blur(); });
    });

    $$('#gBody [data-drop-group]', el).forEach((b) => {
      b.addEventListener('click', async () => {
        const g = groups.find((x) => x.id === b.dataset.dropGroup);
        const n = roster.filter((p) => p.group_id === b.dataset.dropGroup).length;
        // Nobody is deleted with the group — the foreign key empties them. Say
        // so, because "remove" next to a person count reads worse than it is.
        if (n && !confirm(`Remove ${groupLabel(g)}? The ${n} ${n === 1 ? 'person' : 'people'} in it stay on the roster with no group.`)) return;
        b.disabled = true;
        try {
          await deleteGroup(b.dataset.dropGroup);
          await sync();
        } catch (e) {
          b.disabled = false;
          toast("Couldn't remove that group — " + e.message);
        }
      });
    });
  }

  const name = $('#gName', el);
  const add = $('#gAdd', el);
  async function submit() {
    add.disabled = true;
    try {
      const g = await createGroup(name.value);
      name.value = '';
      await sync();
      toast(`${groupLabel(g)} added`);
    } catch (e) {
      toast("Couldn't add that group — " + e.message);
    } finally {
      if (add.isConnected) add.disabled = false;
      if (name.isConnected) name.focus();
    }
  }
  add.addEventListener('click', submit);
  name.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') submit(); });

  draw();
}

// ── spreadsheet ──────────────────────────────────────────────────────

// One sheet, one row per participant: who they are, what they built, where it
// lives, whether they finished, and the whole wrap-up and feedback block — the
// eight answers that are the only reason to open this file weeks later. Live
// signals stay in the desk UI, where they are actionable; the old per-field
// dump is gone.
export async function exportXlsx() {
  const aoa = [[
    'Name', 'Model', 'Email', 'OS', 'GitHub', 'AI name',
    'Live URL', 'GitHub repo URL', 'Completed',
    'Pace', 'Hardest part', 'Could build again', 'Would recommend',
    'Stuck for', 'What next', 'Best bit', 'Feedback',
  ]];

  for (const p of roster) {
    aoa.push([
      p.name || '',
      field(p.id, 'p1', 'model'),
      p.email || '',
      p.os || '',
      field(p.id, 'p3', 'gh'),
      field(p.id, 'h3a', 'ainame'),
      field(p.id, 'h4b', 'liveurl'),
      field(p.id, 'h4a', 'repo'),
      doneCount(p.id) >= TOTAL ? 'Yes' : 'No',
      field(p.id, 'h4d', 'pace'),
      field(p.id, 'h4d', 'hardest'),
      field(p.id, 'h4d', 'again'),
      field(p.id, 'h4d', 'recommend'),
      field(p.id, 'h4d', 'stuck'),
      field(p.id, 'h4d', 'next'),
      field(p.id, 'h4d', 'bestbit'),
      field(p.id, 'h4d', 'feedback'),
    ]);
  }

  const name = `${slug(CAMP.code)}-submissions`;
  try {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Participants');
    XLSX.writeFile(wb, name + '.xlsx');
    toast(`Workbook downloaded — ${roster.length} participant${roster.length === 1 ? '' : 's'}`);
  } catch {
    const csv = aoa.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    download(new Blob(['\ufeff' + csv], { type: 'text/csv' }), name + '.csv');
    toast("Excel library didn't load — exported as CSV instead");
  }
}
