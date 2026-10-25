// Seeker workflows: home, search, map, resource details, gigs, companion, call for help.
import { test, expect, expectHealthy, apiSignup, seedSession, greeting } from '../helpers/fixtures.js';

test.describe('Seeker', () => {
  let acc;
  test.beforeEach(async ({ page, request }) => {
    acc = acc || await apiSignup(request, 'seeker');
    await seedSession(page, acc);
  });

  test('home dashboard shows nearby essentials, quick actions, progress and nearby places', async ({ page, diagnostics }) => {
    await page.goto('/seeker-dashboard.html');
    await expect(page.getByRole('heading', { name: greeting(acc.username) })).toBeVisible();
    await expect(page.getByText(/\d+ places? within \d+ mi/)).toBeVisible();
    for (const action of ['Build my resume', 'Find a job', 'Ask Companion', 'Call for help']) {
      await expect(page.getByText(action, { exact: true })).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: 'My progress' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Near you' })).toBeVisible();
    expectHealthy(diagnostics);
    expect(diagnostics.consoleErrors).toEqual([]);
  });

  test('home search opens the map filtered by the query', async ({ page }) => {
    await page.goto('/seeker-dashboard.html');
    await page.locator('#home-search-input').fill('food');
    await page.locator('#home-search-input').press('Enter');
    // The map reads ?q= then tidies the address bar, so check the search box instead of the URL
    await expect(page).toHaveURL(/resource-map\.html/);
    await expect(page.locator('#map-search-input')).toHaveValue('food');
  });

  test('map loads verified places, filters by category and by search', async ({ page, diagnostics }) => {
    await page.goto('/resource-map.html');
    await expect(page.locator('#map-loading-overlay')).toBeHidden({ timeout: 20_000 });
    const badge = page.locator('#drawer-count-badge');
    await expect(badge).not.toHaveText('0');
    const all = Number(await badge.textContent());
    expect(all).toBeGreaterThan(10);

    await page.getByRole('button', { name: /Beds/ }).click();
    await expect(page.getByRole('button', { name: /Beds/ })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => Number(await badge.textContent())).toBeLessThan(all);

    await page.getByRole('button', { name: /^check All$|All/ }).first().click();
    await page.locator('#map-search-input').fill('zzzz-no-such-place');
    await expect.poll(async () => Number(await badge.textContent())).toBe(0);
    // Empty state offers its own "Clear search" button
    await expect(page.getByText('No places match “zzzz-no-such-place”')).toBeVisible();
    await page.locator('#map-search-clear').click();
    await expect.poll(async () => Number(await badge.textContent())).toBeGreaterThan(0);
    expectHealthy(diagnostics);
  });

  test('resource details open from a deep link with name and address', async ({ page, request }) => {
    const { resources } = await (await request.get('/api/resources')).json();
    const place = resources.find((r) => typeof r.lat === 'number' && r.name && r.address);
    await page.goto(`/resource-map.html?resource=${encodeURIComponent(place.id)}`);
    const card = page.locator('#place-focus-card');
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card).toContainText(place.name.slice(0, 20));
  });

  test('gigs page lists opportunities and the filter tabs work', async ({ page, diagnostics }) => {
    await page.goto('/opportunities.html');
    await expect(page.getByRole('heading', { name: 'Gigs' })).toBeVisible();
    await page.getByRole('button', { name: 'Day gigs' }).click();
    await page.getByRole('button', { name: 'Posted here' }).click();
    await page.getByRole('button', { name: 'All' }).click();
    expectHealthy(diagnostics);
  });

  test('call for help page offers a working 211 link', async ({ page }) => {
    await page.goto('/call-shelter.html');
    await expect(page.getByRole('heading', { name: 'Call for help' })).toBeVisible();
    await expect(page.locator('a[href^="tel:211"]').first()).toBeVisible();
  });

  test('companion answers a question (live AI) or shows a graceful error', async ({ page, diagnostics }) => {
    test.setTimeout(120_000);
    await page.goto('/companion.html');
    await expect(page.getByRole('heading', { name: 'How can I help today?' })).toBeVisible();
    await page.locator('#chatbot-input-field').fill('Where can I get a free meal today?');
    const chatResp = page.waitForResponse((r) => r.url().endsWith('/api/chat'), { timeout: 100_000 });
    await page.getByRole('button', { name: 'Send' }).click();
    // First use asks before anything goes to the AI services
    await page.getByRole('button', { name: 'Allow and continue' }).click();
    const resp = await chatResp;
    expect(JSON.parse(resp.request().postData()).aiConsent).toBe(true);
    const body = await resp.json();
    if (body.success) {
      expect(body.reply.length).toBeGreaterThan(10);
      await expect(page.getByText(body.reply.slice(0, 25), { exact: false })).toBeVisible();
    } else {
      expect(resp.status()).toBe(503);
    }
    expectHealthy(diagnostics);
  });

  test('companion rejects an empty message at the API', async ({ request }) => {
    const res = await request.post('/api/chat', { data: { message: '   ', aiConsent: true } });
    expect(res.status()).toBe(400);
  });

  test('seeker cannot open volunteer-only pages', async ({ page }) => {
    await page.goto('/donate.html');
    await expect(page).toHaveURL(/seeker-dashboard\.html/);
  });
});
