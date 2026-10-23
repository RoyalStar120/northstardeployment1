// Volunteer workflows: helper home, post/delete a job, donate options, role switching.
import { test, expect, expectHealthy, apiSignup, seedSession } from '../helpers/fixtures.js';

test.describe('Volunteer', () => {
  test('helper home shows impact and the food pickup queue', async ({ page, request, diagnostics }) => {
    const acc = await apiSignup(request, 'volunteer');
    await seedSession(page, acc);
    await page.goto('/helper-dashboard.html');
    await expect(page.getByRole('heading', { name: `Hello, ${acc.username}` })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Your impact' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Food pickups' })).toBeVisible();
    expectHealthy(diagnostics);
    expect(diagnostics.consoleErrors).toEqual([]);
  });

  test('post a job, see it under Your posts, then delete it', async ({ page, request, diagnostics }) => {
    const acc = await apiSignup(request, 'volunteer');
    await seedSession(page, acc);
    const title = `E2E TEST job ${Date.now()}`;
    await page.goto('/opportunities.html');
    await page.getByRole('button', { name: /Post a job/ }).click();
    await expect(page.locator('#post-job-modal')).toBeVisible();

    // Validation: contact is required
    await page.locator('#job-title-input').fill(title);
    await page.locator('#post-job-submit').click();
    await expect(page.locator('#post-job-error')).toContainText(/email or phone/i);

    await page.locator('#job-contact-input').fill('e2e-test@example.invalid');
    await page.locator('#job-pay-input').fill('$1 (test)');
    const [postResp] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/jobs') && r.request().method() === 'POST'),
      page.locator('#post-job-submit').click(),
    ]);
    const posted = await postResp.json();
    expect(postResp.status()).toBe(200);
    expect(posted.job.authorId, 'author is the signed-in account').toBe(acc.user.id);
    await expect(page.locator('#post-job-modal')).toBeHidden();
    const card = page.locator('article, .ns-card, li, div').filter({ hasText: title }).last();
    await expect(page.getByText(title)).toBeVisible();

    page.once('dialog', (d) => d.accept());
    const [delResp] = await Promise.all([
      page.waitForResponse((r) => /\/api\/jobs\//.test(r.url()) && r.request().method() === 'DELETE'),
      page.locator(`[onclick*="deleteVolunteerJob"]`).first().click(),
    ]);
    expect(delResp.status()).toBe(200);
    await expect(page.getByText(title)).toHaveCount(0);
    await page.reload();
    await expect(page.getByText(title)).toHaveCount(0);
    expectHealthy(diagnostics);
  });

  test('donate page offers money, food and delivery options', async ({ page, request }) => {
    await seedSession(page, await apiSignup(request, 'volunteer'));
    await page.goto('/donate.html');
    await expect(page.getByRole('heading', { name: 'Donate' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Donate money/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Donate food/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Deliver food/ })).toBeVisible();
  });

  test('card checkout is refused honestly when Stripe is not configured (nothing charged)', async ({ request }) => {
    const res = await request.post('/api/create-checkout-session', { data: { amount: 1 } });
    // 503 = Stripe not set up; 200 would mean a real checkout session — never completed by tests.
    expect([200, 503]).toContain(res.status());
  });

  test('switching role in settings persists to the account', async ({ page, request }) => {
    const acc = await apiSignup(request, 'volunteer');
    await seedSession(page, acc);
    await page.goto('/helper-dashboard.html');
    await page.locator('#profile-btn').first().click();
    await page.locator('#settings-role-seeker').click();
    await expect(page).toHaveURL(/seeker-dashboard\.html/, { timeout: 15_000 });
    await expect.poll(async () => {
      const r = await request.get(`/api/profiles/${acc.user.id}`, { headers: { Authorization: `Bearer ${acc.token}` } });
      return (await r.json()).profile?.role;
    }, { timeout: 10_000 }).toBe('seeker');
    await page.reload();
    await expect(page).toHaveURL(/seeker-dashboard\.html/);
  });

  test('volunteer cannot open the seeker-only resume builder', async ({ page, request }) => {
    await seedSession(page, await apiSignup(request, 'volunteer'));
    await page.goto('/resume-builder.html');
    await expect(page).toHaveURL(/helper-dashboard\.html/);
  });
});
