// App Store compliance fixes: account deletion (5.1.1(v)), privacy policy (5.1.1(i)),
// third-party AI consent (5.1.2(i)), user-generated content safeguards (1.2).
// These run against the web app the iOS shell displays; they are not iOS-device evidence.
import { test, expect, apiSignup, seedSession, uniqueName } from '../helpers/fixtures.js';

const auth = (acc) => ({ Authorization: `Bearer ${acc.token}` });
async function postJob(request, acc, extra = {}) {
  const res = await request.post('/api/jobs', {
    headers: auth(acc),
    data: { title: `E2E TEST ${uniqueName('job')}`, contact: 'e2e@example.com', description: 'Test listing', ...extra },
  });
  return { res, job: (await res.json()).job };
}

test.describe('Account deletion', () => {
  test('a signed-in person can delete their account from Settings, and it is gone', async ({ page, request }) => {
    const acc = await apiSignup(request, 'seeker');
    await request.put(`/api/user-data/${acc.user.id}`, { headers: auth(acc), data: { data: { northstar_user_saved_places: '["sh01"]' } } });
    await seedSession(page, acc);
    await page.goto('/seeker-dashboard.html');
    // Signing in pulls the account's saved data first; wait for that before opening Settings
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Open settings' }).click();
    await page.getByRole('button', { name: 'Delete account' }).click();
    await expect(page.getByText('Delete your account?')).toBeVisible();
    const del = page.waitForResponse((r) => r.url().endsWith('/api/account') && r.request().method() === 'DELETE');
    await page.getByRole('button', { name: 'Delete my account' }).click();
    expect((await del).status()).toBe(200);
    await expect(page).toHaveURL(/index\.html\?deleted=1/);
    // (The test harness re-seeds a session on each page load, so the proof is on the server.)

    const login = await request.post('/api/auth/login', { data: { username: acc.username, password: acc.password } });
    expect(login.status()).toBe(404);
    const data = await request.get(`/api/user-data/${acc.user.id}`, { headers: auth(acc) });
    expect((await data.json()).data || {}).toEqual({});
  });

  test('deleting an account removes the jobs it posted', async ({ request }) => {
    const acc = await apiSignup(request, 'volunteer');
    const { job } = await postJob(request, acc);
    expect((await request.delete('/api/account', { headers: auth(acc) })).status()).toBe(200);
    const { jobs } = await (await request.get('/api/jobs?role=seeker&userId=')).json();
    expect(jobs.some((j) => j.id === job.id)).toBe(false);
  });

  test('deletion requires the account owner to be signed in', async ({ request }) => {
    expect((await request.delete('/api/account')).status()).toBe(401);
  });
});

test.describe('Privacy policy', () => {
  test('the policy opens signed out and names every data recipient', async ({ page }) => {
    await page.goto('/privacy.html');
    await expect(page.getByRole('heading', { name: 'Privacy policy' })).toBeVisible();
    for (const name of ['Supabase', 'Gemini', 'ElevenLabs', 'Stripe', 'Google Maps', 'Delete account']) {
      await expect(page.locator('main')).toContainText(name);
    }
  });

  test('the policy is linked from sign-up and from Settings', async ({ page, request }) => {
    await page.addInitScript(() => sessionStorage.setItem('ns_splash_seen', '1'));
    await page.goto('/index.html');
    await expect(page.locator('a[href="privacy.html"]').first()).toBeAttached();
    await seedSession(page, await apiSignup(request, 'seeker'));
    await page.goto('/seeker-dashboard.html');
    await page.getByRole('button', { name: 'Open settings' }).click();
    await expect(page.getByRole('link', { name: /Privacy policy/ })).toBeVisible();
  });
});

test.describe('Companion AI consent', () => {
  test('declining sends nothing to the AI; allowing sends with consent; Settings can turn it off', async ({ page, request }) => {
    await seedSession(page, await apiSignup(request, 'seeker'));
    const chatCalls = [];
    page.on('request', (r) => { if (/\/api\/(chat|voice\/)/.test(r.url())) chatCalls.push(r.url()); });
    await page.goto('/companion.html');
    await page.locator('#chatbot-input-field').fill('Where can I sleep tonight?');
    await page.getByRole('button', { name: 'Send' }).click();
    const sheet = page.getByRole('dialog', { name: 'Before you talk to Companion' });
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText('Gemini');
    await expect(sheet).toContainText('ElevenLabs');
    await sheet.getByRole('button', { name: 'Not now' }).click();
    await expect(page.getByText('nothing was sent', { exact: false })).toBeVisible();
    await page.waitForTimeout(800);
    expect(chatCalls).toEqual([]);

    await page.locator('#chatbot-input-field').fill('Where can I sleep tonight?');
    const sent = page.waitForRequest((r) => r.url().endsWith('/api/chat'));
    await page.getByRole('button', { name: 'Send' }).click();
    await page.getByRole('button', { name: 'Allow and continue' }).click();
    expect(JSON.parse((await sent).postData()).aiConsent).toBe(true);

    await page.goto('/seeker-dashboard.html');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Open settings' }).click();
    const sw = page.locator('#settings-ai-consent');
    await expect(sw).toBeChecked();
    await sw.uncheck({ force: true });
    expect(await page.evaluate(() => localStorage.getItem('northstar_ai_consent'))).toBe('no');
  });

  test('the server refuses AI requests that carry no consent', async ({ request }) => {
    expect((await request.post('/api/chat', { data: { message: 'hello' } })).status()).toBe(403);
    expect((await request.post('/api/voice/speak', { data: { text: 'hello' } })).status()).toBe(403);
    expect((await request.post('/api/voice/listen', { headers: { 'Content-Type': 'audio/webm' }, data: Buffer.from('x') })).status()).toBe(403);
  });
});

test.describe('Posts people share: filter, report, block', () => {
  test('posts with offensive words are refused', async ({ request }) => {
    const acc = await apiSignup(request, 'volunteer');
    const { res } = await postJob(request, acc, { description: 'no bitch work here' });
    expect(res.status()).toBe(400);
    const d = await request.post('/api/deliveries', { headers: auth(acc), data: { items: ['shit'], bags: 1, donorArea: 'E2E' } });
    expect(d.status()).toBe(400);
  });

  test('other people see an opaque poster key, never the author account id', async ({ request }) => {
    const author = await apiSignup(request, 'volunteer');
    const { job } = await postJob(request, author);
    const seen = (await (await request.get('/api/jobs?role=seeker&userId=')).json()).jobs.find((j) => j.id === job.id);
    expect(seen.authorId).toBeUndefined();
    expect(seen.poster_key).toMatch(/^[0-9a-f]{16}$/);
    const own = (await (await request.get('/api/jobs?role=seeker&userId=', { headers: auth(author) })).json()).jobs.find((j) => j.id === job.id);
    expect(own.authorId).toBe(author.user.id);
  });

  test('reporting hides the post for the reporter; blocking hides that poster’s other posts', async ({ page, request }) => {
    const poster = await apiSignup(request, 'volunteer');
    const seeker = await apiSignup(request, 'seeker');
    const { job } = await postJob(request, poster);
    const { job: second } = await postJob(request, poster);
    await seedSession(page, seeker);
    await page.goto('/opportunities.html');
    const card = page.locator(`[data-job-id="${job.id}"]`);
    await expect(card).toBeVisible({ timeout: 20_000 });
    await card.getByRole('button', { name: 'Report or block this post' }).click();
    const dialog = page.getByRole('dialog', { name: /Report this job post/ });
    await dialog.getByText('Spam or fake').click();
    await dialog.locator('#report-block').check({ force: true });
    const sent = page.waitForResponse((r) => r.url().endsWith('/api/reports'));
    await dialog.getByRole('button', { name: 'Send report' }).click();
    expect((await sent).status()).toBe(200);
    await expect(dialog).toContainText('Your report was sent');
    await page.reload();
    await expect(page.locator('[data-job-id]').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(`[data-job-id="${job.id}"]`)).toHaveCount(0);
    await expect(page.locator(`[data-job-id="${second.id}"]`)).toHaveCount(0);
  });

  test('three different reporters hide a post for everyone', async ({ request }) => {
    const poster = await apiSignup(request, 'volunteer');
    const { job } = await postJob(request, poster);
    for (let i = 0; i < 3; i++) {
      const r = await apiSignup(request, 'seeker');
      expect((await request.post('/api/reports', { headers: auth(r), data: { kind: 'job', id: job.id, reason: 'spam' } })).status()).toBe(200);
    }
    const { jobs } = await (await request.get('/api/jobs?role=seeker&userId=')).json();
    expect(jobs.some((j) => j.id === job.id)).toBe(false);
  });

  test('reporting needs an account', async ({ request }) => {
    expect((await request.post('/api/reports', { data: { kind: 'job', id: 'x' } })).status()).toBe(401);
  });
});

test.describe('iOS configuration (source level)', () => {
  test('the Expo config no longer ships placeholder or unused iOS settings', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const app = JSON.parse(fs.readFileSync(path.resolve('..', 'expo-app', 'app.json'), 'utf8')).expo;
    expect(app.ios.infoPlist.NSAppTransportSecurity.NSAllowsArbitraryLoads).toBe(false);
    const loc = app.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-location')[1];
    expect(loc.locationAlwaysPermission).toBe(false);
    expect(loc.motionUsagePermission).toBe(false);
    const audio = app.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-audio')[1];
    expect(audio.enableBackgroundPlayback).toBe(false);
    const src = fs.readFileSync(path.resolve('..', 'expo-app', 'App.js'), 'utf8');
    expect(src).not.toMatch(/useEffect\(\(\) => \{\s*Location\.requestForegroundPermissionsAsync/);
    expect(src).not.toMatch(/checkout\.stripe\.com'\)\) return true/);
  });
});
