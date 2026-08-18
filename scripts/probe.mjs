// Connectivity + schema probe. Run after applying the migration:
//   node scripts/probe.mjs
// Uses the anon key only — everything it can reach, a browser could too.
import { createClient } from '@supabase/supabase-js';
import { loadEnv } from './env.mjs';

const { url, key } = loadEnv();
console.log('project host :', new URL(url).host);
console.log('anon key     : present,', key.length, 'chars\n');

const sb = createClient(url, key, { auth: { persistSession: false } });

// Signed out, RLS should refuse everything: no policy grants the `anon` role.
for (const t of ['profiles', 'progress', 'screenshots', 'v_roster', 'v_submissions']) {
  const { data, error } = await sb.from(t).select('*').limit(1);
  const exists = error?.code === '42P01' ? 'MISSING' : 'ok';
  // Signed out, the correct outcome is zero rows: the policies are `to
  // authenticated`, so anon matches none and PostgREST returns an empty set
  // rather than an error. Rows coming back here would be a real leak.
  const anon = error ? `refused (${error.code || error.message.slice(0, 40)})`
    : data.length === 0 ? 'no rows (correct)' : `LEAK — ${data.length} row(s)`;
  console.log(`  ${t.padEnd(14)} ${exists.padEnd(8)} anon-read: ${anon}`);
}

const { data: buckets, error: be } = await sb.storage.listBuckets();
console.log('\nbuckets      :', be ? `refused (${be.message.slice(0, 60)})`
  : JSON.stringify(buckets.map((b) => b.id + (b.public ? ' [PUBLIC]' : ' [private]'))));

// Whether signUp returns a session tells us if email confirmation is on.
const email = `probe.${Date.now()}@example.com`;
const { data: su, error: se } = await sb.auth.signUp({
  email, password: 'ProbePass!2026', options: { data: { name: 'Probe', os: 'Linux' } },
});
if (se) {
  console.log('signup       : FAILED —', se.message);
} else {
  console.log('signup       : ok · session =', su.session ? 'YES → email confirmation is OFF' : 'NO → email confirmation is ON');
  if (su.session) {
    const { data: prof, error: pe } = await sb.from('profiles').select('id,name,os,role').eq('id', su.user.id).maybeSingle();
    console.log('signup trigger:', pe ? 'ERROR ' + pe.message : JSON.stringify(prof));
  }
}
console.log('\nthrowaway account created:', email);
