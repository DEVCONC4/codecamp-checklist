// The desk. The old POC made participants download a write-up and email it so
// the facilitator could re-parse it; with a database the room is just a query,
// and incomplete participants show up automatically instead of contributing
// nothing. RLS decides who may see this, not a PIN in the client bundle.
import { supabase } from './supabase.js';
import { CAMP, STEPS, TOTAL, stepById } from './camp.js';
import { $, esc, toast, download, slug } from './ui.js';

let roster = [];
let subs = [];

const LABEL = {};
for (const s of STEPS) for (const p of s.proofs) LABEL[`${s.id}.${p.key}`] = p.label;

// ── live updates ─────────────────────────────────────────────────────
// The realtime event is only a nudge to refetch — never the data itself.
// loadRoom() goes back through PostgREST, so RLS decides what the facilitator
// actually sees and we never depend on realtime honouring it.
let channel = null;
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
    .subscribe((status) => {
      // Realtime may be disabled for these tables, or blocked by the network.
      // Either way the desk still works — it just needs the Refresh button.
      if (status === 'SUBSCRIBED') live = 'live';
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') live = 'manual';
      onStatus?.();
    });
}

export function unsubscribeRoom() {
  if (!channel) return;
  supabase.removeChannel(channel);
  channel = null;
  live = 'off';
}

export async function loadRoom() {
  const [r, s] = await Promise.all([
    supabase.from('v_roster').select('*').order('name'),
    supabase.from('v_submissions').select('*'),
  ]);
  if (r.error) throw r.error;
  if (s.error) throw s.error;
  roster = (r.data || []).filter((p) => p.role !== 'facilitator');
  subs = s.data || [];
}

const field = (userId, stepId, key) =>
  subs.find((x) => x.user_id === userId && x.step_id === stepId && x.field_key === key)?.value || '';

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

export function renderRoom() {
  if (!roster.length) {
    $('#roomOut').innerHTML = `${livePill()}<div class="empty"><div class="big">Nobody has signed up yet</div>
      Participants appear here the moment they create an account.</div>`;
    return;
  }

  const complete = roster.filter((p) => p.steps_done >= TOTAL).length;
  const started = roster.filter((p) => p.steps_done > 0).length;
  const avg = Math.round(roster.reduce((a, p) => a + Number(p.steps_done || 0), 0) / roster.length);

  // Where the room actually is: the first required step most people haven't
  // stamped is the one to talk about from the front.
  const stuck = {};
  for (const p of roster) {
    const at = STEPS.filter((s) => !s.optional)[Number(p.steps_done)] || null;
    if (at) stuck[at.id] = (stuck[at.id] || 0) + 1;
  }
  const worst = Object.entries(stuck).sort((a, b) => b[1] - a[1])[0];

  $('#roomOut').innerHTML = `
    ${livePill()}
    <dl class="stats">
      <div><dt>Signed up</dt><dd>${roster.length}</dd></div>
      <div><dt>Started</dt><dd>${started}</dd></div>
      <div><dt>Complete</dt><dd>${complete}</dd></div>
      <div><dt>Average steps</dt><dd>${avg}/${TOTAL}</dd></div>
      <div><dt>Most are at</dt><dd style="font-size:15px;line-height:1.35">${worst ? esc(stepById(worst[0]).title) : '—'}</dd></div>
    </dl>
    <div class="roster">${roster
      .map((p) => {
        const n = Number(p.steps_done || 0);
        const pct = Math.round((n / TOTAL) * 100);
        return `<div class="rline">
          <span class="nm">${esc(p.name || '(no name)')}</span>
          <span class="mt">${esc(p.os || '')}</span>
          <span class="minirail"><i style="width:${pct}%"></i></span>
          <span class="mt">${n}/${TOTAL}</span>
          <span class="mt" style="color:${n >= TOTAL ? 'var(--stamp)' : 'var(--flag)'}">${n >= TOTAL ? 'Complete' : 'In progress'}</span>
          <span class="sp"></span>
          <span class="mt">${esc(field(p.id, 'h3a', 'ainame') || '—')}</span>
        </div>`;
      })
      .join('')}</div>`;
}

export async function exportXlsx() {
  const rosterAoa = [[
    'Name', 'Username', 'OS', 'GitHub', 'AI name', 'Model', 'Language', 'Live URL', 'Repo',
    'Steps stamped', 'Steps total', 'Status', 'Completed', 'Pace', 'Hardest hour', 'Feedback',
  ]];
  const subsAoa = [['Participant', 'OS', 'Step #', 'Step', 'Module', 'Field', 'Answer', 'Stamped at']];

  for (const p of roster) {
    const n = Number(p.steps_done || 0);
    rosterAoa.push([
      p.name || '', p.username || '', p.os || '',
      field(p.id, 'p3', 'gh'),
      field(p.id, 'h3a', 'ainame'),
      field(p.id, 'p1', 'model'),
      field(p.id, 'h3b', 'lang'),
      field(p.id, 'h4b', 'liveurl'),
      field(p.id, 'h4a', 'repo'),
      n, TOTAL,
      n >= TOTAL ? 'Complete' : 'In progress',
      n >= TOTAL && p.last_stamp_at ? new Date(p.last_stamp_at).toLocaleString() : '',
      field(p.id, 'h4d', 'pace'),
      field(p.id, 'h4d', 'hardest'),
      field(p.id, 'h4d', 'feedback'),
    ]);
  }

  const order = new Map(STEPS.map((s, i) => [s.id, i]));
  for (const row of [...subs].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '') || (order.get(a.step_id) ?? 99) - (order.get(b.step_id) ?? 99))) {
    const s = stepById(row.step_id);
    if (!s) continue;
    subsAoa.push([
      row.name || '', row.os || '',
      s.optional ? '—' : String(STEPS.filter((x) => !x.optional).findIndex((x) => x.id === s.id) + 1).padStart(2, '0'),
      s.title, s.module,
      LABEL[`${row.step_id}.${row.field_key}`] || row.field_key,
      row.value || '',
      row.done_at ? new Date(row.done_at).toLocaleString() : '',
    ]);
  }

  const name = `${slug(CAMP.code)}-submissions`;
  try {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rosterAoa), 'Roster');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(subsAoa), 'Submissions');
    XLSX.writeFile(wb, name + '.xlsx');
    toast('Workbook downloaded — Roster and Submissions sheets');
  } catch {
    const csv = rosterAoa.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    download(new Blob(['﻿' + csv], { type: 'text/csv' }), name + '.csv');
    toast("Excel library didn't load — exported the roster as CSV");
  }
}
