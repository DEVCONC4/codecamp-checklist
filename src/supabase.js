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

// Ask the project whether "Confirm email" is still on (README §4). It has to be
// off: login is by username, so the app registers <username>@codecamp.test —
// undeliverable by design — and with confirmation on, Supabase tries to mail
// every one of those. The built-in SMTP allows a couple of sends per hour, so
// the third signup of the day comes back 429 and every one after it, which
// reads like "too many attempts" when nothing will ever clear. /auth/v1/settings
// is public and needs no session, so this can run before anyone touches the
// form. Returns null when the answer can't be had — never guess on a bad link.
export async function confirmEmailIsOn() {
  try {
    const r = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
    if (!r.ok) return null;
    const { mailer_autoconfirm } = await r.json();
    return typeof mailer_autoconfirm === 'boolean' ? !mailer_autoconfirm : null;
  } catch {
    return null;
  }
}

export const PROOF_BUCKET = 'proofs';
