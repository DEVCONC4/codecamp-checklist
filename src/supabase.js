import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const configured = Boolean(url && key && !url.includes('YOUR-PROJECT'));

// Fail loudly and legibly rather than throwing an opaque error deep in a
// request: a camp laptop with a half-copied .env should say so on the page.
export function bootFailure() {
  document.body.innerHTML = `
    <div class="bootfail">
      <h2>Supabase isn't configured</h2>
      <p>Copy <code>.env.example</code> to <code>.env</code> and fill in your project URL and anon key, then restart <code>npm run dev</code>.</p>
      <p style="margin-bottom:0">Both values are in your Supabase dashboard under <strong>Project settings → API</strong>.</p>
    </div>`;
}

export const supabase = configured
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

// Two switches on Authentication → Sign In / Providers → Email decide whether
// anyone can sign up at all, and getting either wrong fails in a way the error
// text doesn't explain (README §4):
//
//   Enable email provider  must be ON   — off ⇒ "Email signups are disabled"
//   Confirm email          must be OFF  — on  ⇒ 429 after ~2 signups, because
//                                         the built-in SMTP caps sends at a
//                                         couple an hour and confirmation mails
//                                         every new account
//
// /auth/v1/settings is public and needs no session, so the gate can ask before
// anyone types. Each field is null when it can't be read — never guess on a bad
// link, and never warn about a project we failed to reach.
export async function authPreflight() {
  const unknown = { emailProviderOff: null, confirmEmailOn: null };
  try {
    const r = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
    if (!r.ok) return unknown;
    const s = await r.json();
    const flip = (v) => (typeof v === 'boolean' ? !v : null);
    return {
      emailProviderOff: flip(s.external?.email),
      confirmEmailOn: flip(s.mailer_autoconfirm),
    };
  } catch {
    return unknown;
  }
}

export const PROOF_BUCKET = 'proofs';
