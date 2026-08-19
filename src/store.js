// The single place that talks to Postgres and Storage. Everything else reads
// from the in-memory mirror this keeps, so rendering stays synchronous.
import { supabase, PROOF_BUCKET } from './supabase.js';
import { STEPS, REQ, TOTAL } from './camp.js';
import { shrink, pill, saved, toast } from './ui.js';

export const store = {
  profile: null,
  progress: {},   // stepId -> { values, done, doneAt }
  shots: {},      // stepId -> [{ id, key, name, path, url }]
};

export const V = (stepId, key) => String(store.progress[stepId]?.values?.[key] ?? '').trim();
export const SH = (stepId) => store.shots[stepId] || [];
export const doneCount = () => REQ.filter((s) => store.progress[s.id]?.done).length;
export const allDone = () => doneCount() === TOTAL;
export const isFacilitator = () => store.profile?.role === 'facilitator';

// Sign-out has to leave nothing behind: the mirror outlives the session, and
// the next person to sign in on this laptop must not see a flash of the last
// one's answers before their own load. Pending writes are dropped too — they
// belong to a session that no longer has the rights to make them.
export function clearStore() {
  clearTimeout(timer);
  dirty.clear();
  store.profile = null;
  store.progress = {};
  store.shots = {};
}

function blank() {
  const out = {};
  for (const s of STEPS) out[s.id] = { values: {}, done: false, doneAt: null };
  return out;
}

export async function loadProfile(userId) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  store.profile = data;
  return data;
}

export async function loadAll(userId) {
  store.progress = blank();

  const [{ data: rows, error: e1 }, { data: pics, error: e2 }] = await Promise.all([
    supabase.from('progress').select('step_id, values, done, done_at').eq('user_id', userId),
    supabase.from('screenshots').select('id, step_id, field_key, path, name').eq('user_id', userId).order('created_at'),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  for (const r of rows || []) {
    if (!store.progress[r.step_id]) continue; // a step that left the config
    store.progress[r.step_id] = {
      values: r.values || {},
      done: !!r.done,
      doneAt: r.done_at ? new Date(r.done_at).getTime() : null,
    };
  }

  store.shots = {};
  for (const s of STEPS) store.shots[s.id] = [];
  const paths = (pics || []).map((p) => p.path);
  const urls = await signedUrls(paths);
  for (const p of pics || []) {
    (store.shots[p.step_id] = store.shots[p.step_id] || []).push({
      id: p.id, key: p.field_key, name: p.name, path: p.path, url: urls[p.path] || '',
    });
  }
}

// The bucket is private, so every thumbnail needs a short-lived signed URL.
// One batched call rather than one round trip per image.
// Never throws. A thumbnail that can't be signed is a missing image; it must
// not be able to abort an upload or block the participant from stamping.
// Exported because the desk signs other people's proofs with it — the storage
// policy lets a facilitator read any object in the bucket, so the same batched
// call works there without a second implementation.
export async function signedUrls(paths, expiresIn = 60 * 60 * 4) {
  if (!paths.length) return {};
  try {
    const { data, error } = await supabase.storage.from(PROOF_BUCKET).createSignedUrls(paths, expiresIn);
    if (error || !Array.isArray(data)) return {};
    const map = {};
    for (const d of data) if (d?.path && d?.signedUrl) map[d.path] = d.signedUrl;
    return map;
  } catch {
    return {};
  }
}

// ── writes ───────────────────────────────────────────────────────────

let timer = null;
const dirty = new Set();

export function setValue(stepId, key, value) {
  const row = (store.progress[stepId] ||= { values: {}, done: false, doneAt: null });
  row.values[key] = value;
  queue(stepId);
}

function queue(stepId) {
  dirty.add(stepId);
  pill('Saving…');
  clearTimeout(timer);
  timer = setTimeout(flush, 600);
}

export async function flush() {
  clearTimeout(timer);
  if (!dirty.size || !store.profile) return;
  const ids = [...dirty];
  dirty.clear();
  const rows = ids.map((id) => ({
    user_id: store.profile.id,
    step_id: id,
    values: store.progress[id]?.values || {},
    done: !!store.progress[id]?.done,
    done_at: store.progress[id]?.doneAt ? new Date(store.progress[id].doneAt).toISOString() : null,
  }));
  const { error } = await supabase.from('progress').upsert(rows, { onConflict: 'user_id,step_id' });
  if (error) {
    ids.forEach((i) => dirty.add(i));
    pill('Not saved — retrying');
    toast("Couldn't reach the database — your answer is still on screen");
    return;
  }
  saved();
}

export async function setDone(stepId, done) {
  const row = (store.progress[stepId] ||= { values: {}, done: false, doneAt: null });
  row.done = done;
  row.doneAt = done ? Date.now() : null;
  queue(stepId);
  await flush();
}

export async function addScreenshots(stepId, fieldKey, files) {
  const imgs = [...files].filter((f) => f.type.startsWith('image/'));
  if (!imgs.length) {
    toast("That file isn't an image");
    return 0;
  }
  pill('Uploading…');
  let n = 0;
  for (const f of imgs) {
    const small = await shrink(f);
    if (!small) continue;
    const path = `${store.profile.id}/${stepId}/${crypto.randomUUID()}.jpg`;
    const up = await supabase.storage.from(PROOF_BUCKET).upload(path, small, { contentType: 'image/jpeg' });
    if (up.error) { toast('Upload failed: ' + up.error.message); continue; }
    const ins = await supabase
      .from('screenshots')
      .insert({ user_id: store.profile.id, step_id: stepId, field_key: fieldKey, path, name: f.name || 'pasted-screenshot.png' })
      .select('id')
      .single();
    if (ins.error) { toast('Upload failed: ' + ins.error.message); continue; }
    const urls = await signedUrls([path]);
    (store.shots[stepId] ||= []).push({ id: ins.data.id, key: fieldKey, name: f.name || 'pasted-screenshot.png', path, url: urls[path] || '' });
    n++;
  }
  saved();
  return n;
}

export async function removeScreenshot(stepId, id) {
  const list = store.shots[stepId] || [];
  const ix = list.findIndex((x) => x.id === id);
  if (ix < 0) return;
  const [gone] = list.splice(ix, 1);
  await supabase.from('screenshots').delete().eq('id', id);
  await supabase.storage.from(PROOF_BUCKET).remove([gone.path]);
  saved();
}

// Images are fetched and inlined at export time so the downloaded write-up is
// a single self-contained file, not a page of dead signed URLs.
export async function inlineShots(stepId) {
  const out = [];
  for (const s of SH(stepId)) {
    try {
      const { data } = await supabase.storage.from(PROOF_BUCKET).download(s.path);
      if (!data) continue;
      const fr = new FileReader();
      const dataUrl = await new Promise((res) => { fr.onload = () => res(fr.result); fr.onerror = () => res(null); fr.readAsDataURL(data); });
      if (dataUrl) out.push({ ...s, data: dataUrl });
    } catch { /* a missing object shouldn't sink the whole export */ }
  }
  return out;
}
