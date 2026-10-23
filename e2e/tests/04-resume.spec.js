// Resume builder and AI resume generation.
import { test, expect, expectHealthy, apiSignup, seedSession } from '../helpers/fixtures.js';

test.describe('Resume builder', () => {
  test('name is required before moving on', async ({ page, request, diagnostics }) => {
    await seedSession(page, await apiSignup(request));
    await page.goto('/resume-builder.html');
    await expect(page.getByRole('heading', { name: 'How can employers reach you?' })).toBeVisible();
    // Name starts filled with the account name; clearing it must block Next
    await expect(page.locator('#input-name')).not.toHaveValue('');
    await page.locator('#input-name').fill('');
    await page.locator('#btn-wizard-next').click();
    await expect(page.locator('#input-name')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#input-name-error')).toBeVisible();
    await page.locator('#input-name').fill('Test Person');
    await page.locator('#btn-wizard-next').click();
    await expect(page.locator('#input-name')).toBeHidden();
    await page.locator('#btn-wizard-back').click();
    await expect(page.locator('#input-name')).toHaveValue('Test Person');
    expectHealthy(diagnostics);
  });

  test('resume job API validates input and reports unknown jobs', async ({ request }) => {
    expect((await request.post('/api/resume-jobs', { data: {} })).status()).toBe(400);
    expect((await request.get('/api/resume-jobs/rj_doesnotexist')).status()).toBe(404);
  });

  test('full AI resume generation with fictional data (live AI service)', async ({ page, request }) => {
    test.setTimeout(420_000);
    await seedSession(page, await apiSignup(request));
    await page.goto('/resume-builder.html');
    await page.locator('#input-name').fill('Jordan Testcase');
    await page.locator('#input-location').fill('Seattle, WA');
    // Walk the wizard to the end, filling the free-text notes when they appear
    for (let i = 0; i < 10; i++) {
      if (await page.locator('#btn-generate-resume').isVisible()) break;
      const notes = page.locator('#input-informal-notes');
      if (await notes.isVisible()) await notes.fill('Unloaded trucks and kept the pantry organized at a food bank for six months.');
      await page.locator('#btn-wizard-next').click();
    }
    await expect(page.locator('#btn-generate-resume')).toBeVisible();
    const started = page.waitForResponse((r) => /\/api\/(resume-jobs|generate-resume)$/.test(r.url()) && r.request().method() === 'POST');
    await page.locator('#btn-generate-resume').click();
    const resp = await started;
    expect([200, 202]).toContain(resp.status());
    const { jobId } = await resp.json();
    // Poll the background job itself: it must finish with a real resume, not an error
    let job;
    await expect.poll(async () => {
      job = await (await request.get(`/api/resume-jobs/${jobId}`)).json();
      return job.status;
    }, { timeout: 400_000, intervals: [5000] }).not.toBe('running');
    expect(job.status, `resume job result: ${JSON.stringify(job.result).slice(0, 200)}`).toBe('done');
    expect(String(job.result.resume || '')).toMatch(/jordan testcase/i);
  });
});
