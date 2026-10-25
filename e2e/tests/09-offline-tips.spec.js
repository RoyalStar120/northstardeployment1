// Offline support and job tips: the service worker must be able to precache the app shell,
// and the Gigs page must load the per-job tip texts.
import { test, expect, apiSignup, seedSession } from '../helpers/fixtures.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SW = fs.readFileSync(path.resolve(__dirname, '..', '..', 'sw.js'), 'utf8');
const CORE_ASSETS = [...SW.match(/CORE_ASSETS\s*=\s*\[([\s\S]*?)\]/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
const CACHE_NAME = SW.match(/APP_CACHE_NAME\s*=\s*'([^']+)'/)[1];

test.describe('Offline and tips', () => {
  test('every precached app-shell file is served (one 404 makes the whole precache fail)', async ({ request }) => {
    const missing = [];
    for (const url of CORE_ASSETS) {
      const r = await request.get(url);
      if (r.status() !== 200) missing.push(`${r.status()} ${url}`);
    }
    expect(missing).toEqual([]);
  });

  test('the service worker installs and stores the app shell for offline use', async ({ page, request }) => {
    await seedSession(page, await apiSignup(request, 'seeker'));
    await page.goto('/seeker-dashboard.html');
    await page.evaluate(async () => {
      if (!navigator.serviceWorker.controller) await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
    });
    await expect.poll(async () => page.evaluate(async (name) => {
      const cache = await caches.open(name);
      return (await cache.keys()).length;
    }, CACHE_NAME), { timeout: 30_000 }).toBeGreaterThanOrEqual(CORE_ASSETS.length);
  });

  test('job tips load for the Gigs page with job-specific advice', async ({ page, request, diagnostics }) => {
    const tips = await (await request.get('/api/job-tips')).json();
    expect(tips.kinds.map((k) => k.id)).toEqual(expect.arrayContaining(['labor', 'kitchen', 'outdoor', 'general']));
    expect((await request.get('/src/data/job-tips.json')).status(), 'src/ stays private').toBe(404);

    await seedSession(page, await apiSignup(request, 'seeker'));
    const tipsResp = page.waitForResponse((r) => r.url().endsWith('/api/job-tips'));
    await page.goto('/opportunities.html');
    expect((await tipsResp).status()).toBe(200);
    await expect(page.locator('article').first()).toBeVisible({ timeout: 20_000 });
    expect(diagnostics.consoleErrors.filter((e) => /404/.test(e))).toEqual([]);
  });
});
