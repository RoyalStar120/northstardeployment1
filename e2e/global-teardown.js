// Deletes ONLY the throwaway accounts this suite created (ids recorded at signup, username
// must start with "e2e_"), plus their per-user storage file. Uses the server-side key from
// the project .env; never prints key values.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(__dirname, '.auth', 'created-users.json');

export default async function globalTeardown() {
  let users = [];
  try { users = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { return; }
  users = users.filter((u) => u && u.id && String(u.username || '').startsWith('e2e_'));
  if (!users.length) return;

  dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.warn('[teardown] Supabase server key not available; test accounts left in place:', users.map((u) => u.id)); return; }

  const { createClient } = await import('../node_modules/@supabase/supabase-js/dist/index.mjs');
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const ids = users.map((u) => u.id);
  const { error } = await sb.from('profiles').delete().in('id', ids).like('username', 'e2e\\_%');
  await sb.storage.from('northstar-user-data').remove(ids.map((id) => `users/${id}.json`));
  // Jobs the suite posted (titles are prefixed "E2E TEST")
  await sb.from('jobs').delete().like('title', 'E2E TEST%');
  if (error) console.warn('[teardown] profile cleanup notice:', error.message);
  else console.log(`[teardown] removed ${ids.length} e2e test account(s)`);
  fs.rmSync(FILE, { force: true });
}
