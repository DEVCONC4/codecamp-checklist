// Proves the security model with two real accounts and the anon key — the same
// key a browser gets. Every assertion below is something a malicious
// participant would actually try.
//
//   node scripts/rls-test.mjs
//   node scripts/rls-test.mjs --facilitator you@example.com yourpassword
//
// Requires the Email provider ON and "Confirm email" OFF (both under
// Authentication → Sign In / Providers → Email); otherwise signUp returns no
// session and nothing here can run.
//
// Accounts it creates are rlstest-<runid>-a / -b at example.com, a domain
// reserved by RFC 2606 that accepts no mail. Cleanup SQL is printed at the end.
import { createClient } from '@supabase/supabase-js';
import { loadEnv } from './env.mjs';

const { url, key } = loadEnv();
// Reserved for documentation and examples (RFC 2606), so these addresses cannot
// collide with, or be delivered to, anything real.
const DOMAIN = 'example.com';
const RUN = Date.now().toString(36);

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const client = () => createClient(url, key, { auth: { persistSession: false } });

async function makeUser(tag, name, os) {
  const sb = client();
  const email = `rlstest-${RUN}-${tag}@${DOMAIN}`;
  const { data, error } = await sb.auth.signUp({
    email, password: `RlsTest!${RUN}`, options: { data: { name, os } },
  });
  if (error) throw new Error(`signUp(${tag}) failed: ${error.message}`);
  if (!data.session) throw new Error(
    'signUp returned no session — "Confirm email" is still ON. Disable it under\n' +
    '  Authentication → Sign In / Providers → Email, then re-run.');
  return { sb, id: data.user.id, email };
}

console.log(`project: ${new URL(url).host}   run: ${RUN}\n`);

let A, B;
try {
  A = await makeUser('a', 'Alice Test', 'Windows');
  B = await makeUser('b', 'Bob Test', 'Linux');
} catch (e) {
  console.error('\n' + e.message);
  // Exiting hard while undici still holds sockets trips a libuv assertion on
  // Windows, so set the code and let Node drain and end on its own.
  process.exitCode = 1;
}
if (A && B) {
console.log(`A = ${A.email}\nB = ${B.email}\n`);

// ── the signup trigger ────────────────────────────────────────────────
{
  const { data } = await A.sb.from('profiles').select('id,name,email,os,role').eq('id', A.id).maybeSingle();
  check('Signup trigger creates a profile with the right name/email/OS',
    data?.name === 'Alice Test' && data?.os === 'Windows' && data?.email === A.email,
    JSON.stringify(data));
  check('New accounts default to role=participant', data?.role === 'participant', data?.role);
}

// ── A does some work ──────────────────────────────────────────────────
{
  const { error } = await A.sb.from('progress').upsert([
    { user_id: A.id, step_id: 'p1', values: { model: 'qwen2.5:3b', os: 'Windows' }, done: true, done_at: new Date().toISOString() },
    { user_id: A.id, step_id: 'h3a', values: { ainame: 'ALICE-SECRET-AI', prompt: 'private system prompt' }, done: true, done_at: new Date().toISOString() },
  ], { onConflict: 'user_id,step_id' });
  check('A can write their own progress', !error, error?.message);

  const { data } = await A.sb.from('progress').select('step_id').eq('user_id', A.id);
  check('A can read their own progress back', data?.length === 2, `${data?.length} rows`);
}

// ── isolation: B must not see or touch A ──────────────────────────────
{
  const { data } = await B.sb.from('progress').select('*');
  check('B sees none of A\'s progress on an unfiltered select',
    Array.isArray(data) && data.length === 0, `${data?.length} rows`);
}
{
  const { data } = await B.sb.from('progress').select('*').eq('user_id', A.id);
  check('B cannot read A\'s progress by explicit user_id',
    Array.isArray(data) && data.length === 0, `${data?.length} rows`);
}
{
  const { data } = await B.sb.from('profiles').select('*');
  const leaked = (data || []).filter((p) => p.id !== B.id);
  check('B sees only their own profile row', leaked.length === 0,
    leaked.length ? 'leaked: ' + leaked.map((p) => p.name).join(', ') : '1 row (own)');
}
{
  const { data } = await B.sb.from('v_submissions').select('*');
  const leaked = (data || []).filter((r) => r.user_id !== B.id);
  check('v_submissions leaks nothing to B (security_invoker holds)',
    leaked.length === 0, leaked.length ? `${leaked.length} foreign rows` : 'clean');
}
{
  const { data } = await B.sb.from('v_roster').select('*');
  const leaked = (data || []).filter((r) => r.id !== B.id);
  check('v_roster leaks nothing to B', leaked.length === 0,
    leaked.length ? `${leaked.length} foreign rows` : 'clean');
}
{
  const { data, error } = await B.sb.from('progress')
    .update({ values: { ainame: 'DEFACED' }, done: false }).eq('user_id', A.id).select();
  check('B cannot UPDATE A\'s progress', (data?.length ?? 0) === 0,
    error ? 'rejected: ' + error.code : `${data?.length ?? 0} rows changed`);
  const { data: after } = await A.sb.from('progress').select('values').eq('user_id', A.id).eq('step_id', 'h3a').maybeSingle();
  check('A\'s data is untouched after B\'s attempt',
    after?.values?.ainame === 'ALICE-SECRET-AI', JSON.stringify(after?.values?.ainame));
}
{
  const { error } = await B.sb.from('progress')
    .insert({ user_id: A.id, step_id: 'h4b', values: { liveurl: 'evil' } });
  check('B cannot INSERT a row owned by A', !!error, error ? error.code : 'INSERT SUCCEEDED');
}
{
  const { data, error } = await B.sb.from('progress').delete().eq('user_id', A.id).select();
  check('B cannot DELETE A\'s progress', (data?.length ?? 0) === 0,
    error ? 'rejected: ' + error.code : `${data?.length ?? 0} rows deleted`);
}

// ── privilege escalation ──────────────────────────────────────────────
{
  await B.sb.from('profiles').update({ role: 'facilitator' }).eq('id', B.id);
  const { data } = await B.sb.from('profiles').select('role').eq('id', B.id).maybeSingle();
  check('B cannot promote themselves to facilitator (freeze_role trigger)',
    data?.role === 'participant', 'role is now: ' + data?.role);
}
{
  const { data } = await B.sb.from('profiles').update({ name: 'Renamed By Bob' }).eq('id', A.id).select();
  check('B cannot rename A', (data?.length ?? 0) === 0, `${data?.length ?? 0} rows changed`);
}

// ── storage ───────────────────────────────────────────────────────────
const shotPath = `${A.id}/p1/${crypto.randomUUID()}.jpg`;
{
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00, 0xff, 0xd9]);
  const { error } = await A.sb.storage.from('proofs').upload(shotPath, bytes, { contentType: 'image/jpeg' });
  check('The proofs bucket exists and A can upload into their own folder', !error,
    error ? error.message.slice(0, 70) : shotPath.slice(0, 44) + '…');
}
{
  const evil = `${A.id}/p1/${crypto.randomUUID()}.jpg`;
  const { error } = await B.sb.storage.from('proofs').upload(evil, new Uint8Array([1, 2, 3]), { contentType: 'image/jpeg' });
  check('B cannot upload into A\'s folder', !!error, error ? error.message.slice(0, 60) : 'UPLOAD SUCCEEDED');
}
{
  const { data, error } = await B.sb.storage.from('proofs').createSignedUrl(shotPath, 60);
  check('B cannot mint a signed URL for A\'s screenshot', !!error || !data?.signedUrl,
    error ? error.message.slice(0, 60) : 'GOT A URL');
}
{
  const { error } = await B.sb.storage.from('proofs').download(shotPath);
  check('B cannot download A\'s screenshot', !!error, error ? error.message.slice(0, 60) : 'DOWNLOAD SUCCEEDED');
}
{
  const { data, error } = await A.sb.storage.from('proofs').createSignedUrl(shotPath, 60);
  check('A can still sign their own screenshot', !error && !!data?.signedUrl, error?.message);
}

// ── optional: the elevated path ───────────────────────────────────────
const fi = process.argv.indexOf('--facilitator');
if (fi > -1) {
  const [femail, password] = process.argv.slice(fi + 1);
  const F = client();
  const { data: sess, error } = await F.auth.signInWithPassword({
    email: String(femail).trim().toLowerCase(), password,
  });
  if (error) {
    check('Facilitator sign-in', false, error.message);
  } else {
    const { data: prof } = await F.from('profiles').select('role').eq('id', sess.user.id).maybeSingle();
    check('Facilitator account really has role=facilitator', prof?.role === 'facilitator', prof?.role);

    const { data: roster } = await F.from('v_roster').select('*');
    const sawBoth = roster?.some((r) => r.id === A.id) && roster?.some((r) => r.id === B.id);
    check('Facilitator sees the whole room in v_roster', !!sawBoth, `${roster?.length} rows`);

    const { data: subs } = await F.from('v_submissions').select('*').eq('user_id', A.id);
    check('Facilitator sees A\'s submissions', (subs?.length ?? 0) >= 2, `${subs?.length} rows`);

    const { data: sgn } = await F.storage.from('proofs').createSignedUrl(shotPath, 60);
    check('Facilitator can sign a participant\'s screenshot', !!sgn?.signedUrl);

    const steps = (roster || []).find((r) => r.id === A.id)?.steps_done;
    check('v_roster counts stamped steps correctly', Number(steps) === 2, `steps_done=${steps}`);
  }
} else {
  console.log('\n(skipping facilitator checks — pass --facilitator <email> <password> to include them)');
}

// ── summary ───────────────────────────────────────────────────────────
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) console.log('FAILED:\n  ' + failed.map((f) => f.name).join('\n  '));

console.log(`\nClean up the throwaway accounts when you're done:\n
  delete from auth.users where email like 'rlstest-%@${DOMAIN}';\n`);
process.exitCode = failed.length ? 1 : 0;
}
