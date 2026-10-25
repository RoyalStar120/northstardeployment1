// Security and authorization checks against the real server and Supabase project.
import { test, expect, apiSignup } from '../helpers/fixtures.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });
const auth = (acc) => ({ Authorization: `Bearer ${acc.token}` });

test.describe('Static file exposure', () => {
  const blocked = ['/.env', '/.git/config', '/.git/HEAD', '/data/users.json', '/server.js', '/package.json',
    '/server.before-resume-ai-backup.js', '/resume-builder.before-parser-fix.html', '/northstar-ai/requirements.txt',
    '/docs/style_guide.md', '/node_modules/express/package.json', '/%2egit/config', '/src/data/resources.json'];
  for (const p of blocked) {
    test(`not served: ${p}`, async ({ request }) => {
      expect((await request.get(p)).status()).toBe(404);
    });
  }
  test('public assets still served', async ({ request }) => {
    for (const p of ['/', '/js/northstar.js', '/css/northstar.css', '/favicon.png', '/sw.js', '/js/resources-data.js']) {
      expect((await request.get(p)).status(), p).toBe(200);
    }
  });
  test('config endpoint exposes no server secrets', async ({ request }) => {
    const cfg = await (await request.get('/api/config')).json();
    // supportEmail is the published contact address (App Review Guideline 1.2), not a secret
    expect(Object.keys(cfg).sort()).toEqual(['googleMapsApiKey', 'supabaseAnonKey', 'supabaseUrl', 'supportEmail', 'vapidPublicKey']);
    const all = JSON.stringify(cfg);
    for (const k of ['SUPABASE_SECRET_KEY', 'GEMINI_API_KEY', 'APIFY_TOKEN', 'VAPID_PRIVATE_KEY', 'HF_TOKEN', 'NORTHSTAR_AI_KEY']) {
      if (process.env[k]) expect(all.includes(process.env[k]), k).toBe(false);
    }
  });
});

test.describe('Profiles API', () => {
  test('reading a profile requires the owner token and never returns pass_hash', async ({ request }) => {
    const a = await apiSignup(request); const b = await apiSignup(request);
    expect((await request.get(`/api/profiles/${a.user.id}`)).status()).toBe(401);
    expect((await request.get(`/api/profiles/${a.user.id}`, { headers: auth(b) })).status()).toBe(401);
    const own = await request.get(`/api/profiles/${a.user.id}`, { headers: auth(a) });
    expect(own.status()).toBe(200);
    const body = await own.json();
    expect(JSON.stringify(body)).not.toContain('pass_hash');
    expect(body.profile.id).toBe(a.user.id);
  });
  test('updating a profile requires the owner token', async ({ request }) => {
    const a = await apiSignup(request); const b = await apiSignup(request);
    expect((await request.post('/api/profiles', { data: { id: a.user.id, role: 'volunteer' } })).status()).toBe(401);
    expect((await request.post('/api/profiles', { data: { id: a.user.id, role: 'volunteer' }, headers: auth(b) })).status()).toBe(401);
    const ok = await request.post('/api/profiles', { data: { id: a.user.id, role: 'volunteer', username: 'hijack' }, headers: auth(a) });
    expect(ok.status()).toBe(200);
    const p = (await ok.json()).profile;
    expect(p.role).toBe('volunteer');
    expect(p.username).toBe(a.username); // username cannot be changed here
  });
});

test.describe('Per-user data', () => {
  test('saved data round-trips for the owner and is private to other accounts', async ({ request }) => {
    const a = await apiSignup(request); const b = await apiSignup(request);
    const put = await request.put(`/api/user-data/${a.user.id}`, { headers: auth(a), data: { data: { northstar_resume_saved: 'yes' } } });
    expect(put.status()).toBe(200);
    const get = await (await request.get(`/api/user-data/${a.user.id}`, { headers: auth(a) })).json();
    expect(get.data.northstar_resume_saved).toBe('yes');
    expect((await request.get(`/api/user-data/${a.user.id}`, { headers: auth(b) })).status()).toBe(401);
    expect((await request.get(`/api/user-data/${a.user.id}`)).status()).toBe(401);
    expect((await request.put(`/api/user-data/${a.user.id}`, { headers: auth(b), data: { data: { x: 'y' } } })).status()).toBe(401);
  });
  test('forged and tampered tokens are rejected', async ({ request }) => {
    const a = await apiSignup(request);
    const [payload, sig] = a.token.split('.');
    const forged = Buffer.from(JSON.stringify({ id: a.user.id, iat: Date.now(), exp: Date.now() + 1e9 })).toString('base64url');
    expect((await request.get(`/api/user-data/${a.user.id}`, { headers: { Authorization: `Bearer ${forged}.${sig}` } })).status()).toBe(401);
    expect((await request.post('/api/auth/refresh', { headers: { Authorization: 'Bearer garbage' } })).status()).toBe(401);
    expect((await request.post('/api/auth/refresh', { headers: auth(a) })).status()).toBe(200);
  });
});

test.describe('Jobs and deliveries authorization', () => {
  test('job author comes from the token; only the author can delete', async ({ request }) => {
    const a = await apiSignup(request, 'volunteer'); const b = await apiSignup(request, 'volunteer');
    const res = await request.post('/api/jobs', { headers: auth(a), data: { title: `E2E TEST authz ${Date.now()}`, contact: 'x@example.invalid', authorId: b.user.id } });
    const job = (await res.json()).job;
    expect(job.authorId).toBe(a.user.id);
    expect((await request.delete(`/api/jobs/${job.id}`)).status()).toBe(401);
    expect((await request.delete(`/api/jobs/${job.id}`, { headers: auth(b) })).status()).toBe(403);
    expect((await request.delete(`/api/jobs/${job.id}`, { headers: auth(a) })).status()).toBe(200);
    expect((await request.delete(`/api/jobs/${job.id}`, { headers: auth(a) })).status()).toBe(404);
  });
  test('job posting requires title and contact', async ({ request }) => {
    expect((await request.post('/api/jobs', { data: { title: 'no contact' } })).status()).toBe(400);
  });
  test('delivery claim and status changes require a signed-in volunteer', async ({ request }) => {
    const a = await apiSignup(request, 'volunteer');
    const id = 'del-does-not-exist-e2e';
    expect((await request.post(`/api/deliveries/${id}/claim`, { data: { driver_id: 'someone' } })).status()).toBe(401);
    expect((await request.post(`/api/deliveries/${id}/status`, { data: { status: 'delivered' } })).status()).toBe(401);
    expect((await request.post(`/api/deliveries/${id}/status`, { headers: auth(a), data: { status: 'bogus' } })).status()).toBe(400);
    expect((await request.post(`/api/deliveries/${id}/status`, { headers: auth(a), data: { status: 'delivered' } })).status()).toBe(404);
    expect((await request.post(`/api/deliveries/${id}/claim`, { headers: auth(a) })).status()).toBe(404);
  });
  test('cannot change the status of a pickup claimed by someone else', async ({ request }) => {
    const a = await apiSignup(request, 'volunteer');
    const { deliveries } = await (await request.get('/api/deliveries')).json();
    const target = deliveries.find((d) => d.driver_id && d.driver_id !== a.user.id);
    test.skip(!target, 'no claimed delivery exists to test against (no data is created for safety)');
    expect((await request.post(`/api/deliveries/${target.id}/status`, { headers: auth(a), data: { status: target.status } })).status()).toBe(403);
  });
});

test.describe('Supabase Row Level Security (direct browser access with the public key)', () => {
  test('anon key cannot read password hashes from profiles', async ({ request }) => {
    const cfg = await (await request.get('/api/config')).json();
    const r = await request.get(`${cfg.supabaseUrl.replace(/\/$/, '')}/rest/v1/profiles?select=id,pass_hash&limit=5`, {
      headers: { apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${cfg.supabaseAnonKey}` },
    });
    const rows = r.ok() ? await r.json() : [];
    expect(rows.filter((x) => x.pass_hash).length, 'pass_hash values readable with the public key').toBe(0);
  });
  test('anon key cannot update profiles', async ({ request }) => {
    const cfg = await (await request.get('/api/config')).json();
    // Filter matches no row, so even if allowed nothing changes; we only check whether the policy permits it.
    const r = await request.patch(`${cfg.supabaseUrl.replace(/\/$/, '')}/rest/v1/profiles?id=eq.__e2e_no_such_row__`, {
      headers: { apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${cfg.supabaseAnonKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      data: { theme: 'x' },
    });
    expect([401, 403], `anon PATCH profiles returned ${r.status()}`).toContain(r.status());
  });
});
