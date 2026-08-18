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

export const PROOF_BUCKET = 'proofs';
