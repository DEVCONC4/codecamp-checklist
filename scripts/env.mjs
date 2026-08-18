// Reads VITE_SUPABASE_* the same way Vite does: .env.local wins over .env.
// Node scripts only — the app itself uses import.meta.env.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function loadEnv() {
  const vars = {};
  for (const f of ['.env', '.env.local']) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      if (!line.includes('=') || line.trim().startsWith('#')) continue;
      const i = line.indexOf('=');
      vars[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    }
  }
  const url = process.env.VITE_SUPABASE_URL || vars.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY || vars.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.\nCopy .env.example to .env.local and fill both in.');
    process.exit(1);
  }
  return { url, key, root: ROOT };
}
