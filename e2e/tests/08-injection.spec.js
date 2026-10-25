// Stored-XSS checks: text that volunteers type (jobs, pickup requests) is shown to other people.
// Every field carries a payload that sets window.__xss if it ever runs; nothing may run.
import { test, expect, apiSignup, seedSession } from '../helpers/fixtures.js';

const P = {
  tag: `<img src=x onerror="window.__xss=(window.__xss||0)+1">`,
  attr: `"><svg onload="window.__xss=(window.__xss||0)+1">`,
  js: `x');window.__xss=(window.__xss||0)+1;//`,
};
const auth = (acc) => ({ Authorization: `Bearer ${acc.token}` });

async function expectNoScriptRan(page) {
  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.__xss || 0), 'injected script ran').toBe(0);
  expect(dialogs).toEqual([]);
}

test.describe('Injection: user-entered text is shown as text', () => {
  test('job fields posted by a volunteer cannot run script for seekers or the author', async ({ page, browser, request }) => {
    const author = await apiSignup(request, 'volunteer');
    const seeker = await apiSignup(request, 'seeker');
    const res = await request.post('/api/jobs', {
      headers: auth(author),
      data: {
        title: `E2E TEST ${P.tag}`, company: P.attr, location: P.tag, pay: P.attr,
        description: `${P.tag} ${P.attr}`, requirements: [P.tag, P.js], contact: P.js,
      },
    });
    expect(res.status(), await res.text()).toBe(200);

    await seedSession(page, seeker);
    await page.goto('/opportunities.html');
    await expect(page.getByText(/E2E TEST/i).first()).toBeVisible({ timeout: 20_000 });
    await expectNoScriptRan(page);
    // Clicking Apply on the payload job must not run the contact payload either
    const card = page.locator('[data-job-id]').filter({ hasText: /E2E TEST/i }).first();
    const apply = card.getByRole('button', { name: /apply|contact|view/i }).first();
    if (await apply.count()) {
      await page.evaluate(() => { window.open = () => null; });
      await apply.click().catch(() => {});
      await expectNoScriptRan(page);
    }

    const authorCtx = await browser.newContext();
    const authorPage = await authorCtx.newPage();
    await seedSession(authorPage, author);
    await authorPage.goto('/opportunities.html');
    await expect(authorPage.getByText(/E2E TEST/i).first()).toBeVisible({ timeout: 20_000 });
    await expectNoScriptRan(authorPage);
    await authorCtx.close();
  });

  test('pickup request fields cannot run script on another volunteer\'s home or delivery list', async ({ page, request }) => {
    const donor = await apiSignup(request, 'volunteer');
    const driver = await apiSignup(request, 'volunteer');
    const res = await request.post('/api/deliveries', {
      headers: auth(donor),
      data: { items: [`E2E TEST ${P.tag}`, P.js], bags: 1, donorArea: P.attr, destination: P.tag, timeWindow: P.js, contactNotes: P.tag },
    });
    expect(res.status()).toBe(200);
    await seedSession(page, driver);
    await page.goto('/helper-dashboard.html');
    await expect(page.getByText(/E2E TEST/i).first()).toBeVisible({ timeout: 20_000 });
    await expectNoScriptRan(page);
    await page.goto('/donate.html');
    await page.locator('button[data-action="deliver"]').click();
    await expect(page.getByText(/E2E TEST/i).first()).toBeVisible({ timeout: 20_000 });
    await expectNoScriptRan(page);
  });

  test('map search text is not executed', async ({ page, request }) => {
    await seedSession(page, await apiSignup(request, 'seeker'));
    await page.goto('/resource-map.html');
    await page.locator('#map-search-input').fill(P.tag);
    await expect(page.getByText(/No places match/)).toBeVisible({ timeout: 15_000 });
    await expectNoScriptRan(page);
  });
});
