// Launch, onboarding, sign-up, sign-in, sign-out, session persistence and expiry.
import { test, expect, expectHealthy, apiSignup, seedSession, uniqueName, recordCreatedUser, greeting } from '../helpers/fixtures.js';

async function openOnboarding(page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('ns_splash_seen', '1');
    localStorage.setItem('northstar_location_asked', '1');
  });
  await page.goto('/');
  await expect(page.locator('#onboarding-step-1')).toBeVisible();
}

test.describe('Launch and onboarding', () => {
  test('first launch shows splash then the welcome screen', async ({ page, diagnostics }) => {
    await page.goto('/');
    await expect(page.locator('#ob-splash')).toBeAttached();
    await expect(page.getByRole('heading', { name: 'Help is closer than you think' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Create an account/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Explore without an account/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
    expectHealthy(diagnostics);
    expect(diagnostics.consoleErrors).toEqual([]);
  });

  test('legacy URLs resolve to the right pages', async ({ request }) => {
    for (const p of ['/login.html', '/signup.html', '/jobs.html', '/map.html', '/profile.html', '/volunteer-dashboard.html']) {
      const res = await request.get(p);
      expect(res.status(), p).toBe(200);
      expect(res.headers()['content-type'], p).toContain('text/html');
    }
  });

  test('explore as guest reaches the seeker home and gates account-only features', async ({ page, diagnostics }) => {
    await openOnboarding(page);
    await page.getByRole('button', { name: /Explore without an account/ }).click();
    await expect(page).toHaveURL(/seeker-dashboard\.html/);
    await expect(page.getByRole('heading', { name: greeting() })).toBeVisible();
    await page.goto('/resume-builder.html');
    await expect(page.getByText('Create a free account to use this')).toBeVisible();
    expectHealthy(diagnostics);
  });
});

test.describe('Sign-up form validation', () => {
  test('Continue stays disabled until a name and 4+ character password are entered', async ({ page }) => {
    await openOnboarding(page);
    await page.getByRole('button', { name: /Create an account/ }).click();
    const submit = page.locator('#simple-login-submit-btn');
    await expect(submit).toBeDisabled();
    await page.locator('#simple-login-name').fill('Someone');
    await page.locator('#simple-login-password').fill('abc');
    await expect(submit).toBeDisabled();
    await page.locator('#simple-login-password').fill('abcd');
    await expect(submit).toBeEnabled();
  });

  test('show/hide password toggles the field type', async ({ page }) => {
    await openOnboarding(page);
    await page.getByRole('button', { name: /Create an account/ }).click();
    const pw = page.locator('#simple-login-password');
    await expect(pw).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Show password' }).click();
    await expect(pw).toHaveAttribute('type', 'text');
  });
});

test.describe('Accounts', () => {
  test('create a seeker account through the UI lands on the seeker home', async ({ page, diagnostics }) => {
    const name = uniqueName('e2e_ui');
    await openOnboarding(page);
    await page.getByRole('button', { name: /Create an account/ }).click();
    await page.locator('#simple-login-name').fill(name);
    await page.locator('#simple-login-password').fill('e2e-pass-123');
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/auth/signup')),
      page.locator('#simple-login-submit-btn').click(),
    ]);
    const body = await resp.json();
    expect(resp.status()).toBe(200);
    recordCreatedUser(body.user);
    expect(body.user).not.toHaveProperty('pass_hash');
    await expect(page).toHaveURL(/seeker-dashboard\.html/);
    await expect(page.getByRole('heading', { name: greeting(name) })).toBeVisible();
    expectHealthy(diagnostics);
  });

  test('create a volunteer account through the UI lands on the helper home', async ({ page }) => {
    const name = uniqueName('e2e_uiv');
    await openOnboarding(page);
    await page.getByRole('button', { name: /Create an account/ }).click();
    await page.locator('#simple-login-name').fill(name);
    await page.locator('#simple-login-password').fill('e2e-pass-123');
    await page.getByRole('button', { name: 'Give help' }).click();
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/auth/signup')),
      page.locator('#simple-login-submit-btn').click(),
    ]);
    recordCreatedUser((await resp.json()).user);
    await expect(page).toHaveURL(/helper-dashboard\.html/);
    await expect(page.getByRole('heading', { name: `Hello, ${name}` })).toBeVisible();
  });

  test('duplicate username is rejected with a clear message', async ({ page, request }) => {
    const acc = await apiSignup(request);
    await openOnboarding(page);
    await page.getByRole('button', { name: /Create an account/ }).click();
    await page.locator('#simple-login-name').fill(acc.username);
    await page.locator('#simple-login-password').fill('whatever1');
    await page.locator('#simple-login-submit-btn').click();
    await expect(page.locator('#simple-login-error')).toContainText('already taken');
    await expect(page).toHaveURL(/\/(index\.html)?$/);
  });

  test('wrong password and unknown user show errors and do not log in', async ({ page, request }) => {
    const acc = await apiSignup(request);
    await openOnboarding(page);
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.locator('#simple-login-name').fill(acc.username);
    await page.locator('#simple-login-password').fill('not-the-password');
    await page.locator('#simple-login-submit-btn').click();
    await expect(page.locator('#simple-login-error')).toContainText('Wrong password');
    await page.locator('#simple-login-name').fill(uniqueName('e2e_nobody'));
    await page.locator('#simple-login-submit-btn').click();
    await expect(page.locator('#simple-login-error')).toContainText('No account found');
    expect(await page.evaluate(() => localStorage.getItem('northstar_session'))).toBeNull();
  });

  test('log in, refresh keeps the session, sign out clears it, back does not restore it', async ({ page, request, diagnostics }) => {
    const acc = await apiSignup(request);
    await openOnboarding(page);
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.locator('#simple-login-name').fill(acc.username);
    await page.locator('#simple-login-password').fill(acc.password);
    await page.locator('#simple-login-submit-btn').click();
    await expect(page).toHaveURL(/seeker-dashboard\.html/);
    await page.reload();
    await expect(page.getByRole('heading', { name: greeting(acc.username) })).toBeVisible();

    await page.goto('/progress.html');
    await page.getByRole('button', { name: /Sign out/ }).click();
    await expect(page).toHaveURL(/index\.html|\/$/);
    expect(await page.evaluate(() => localStorage.getItem('northstar_session'))).toBeNull();
    await page.goBack();
    await page.waitForLoadState('load');
    await expect(page).toHaveURL(/index\.html|\/$/);
    expectHealthy(diagnostics);
  });

  test('a session idle for more than 5 minutes is logged out', async ({ page, request }) => {
    const acc = await apiSignup(request);
    await page.addInitScript((a) => {
      sessionStorage.setItem('ns_session_active', '1');
      localStorage.setItem('northstar_session', JSON.stringify({ id: a.user.id, username: a.username, role: 'seeker', isGuest: false, token: a.token, loggedInAt: Date.now() - 6 * 60 * 1000 }));
    }, acc);
    await page.goto('/seeker-dashboard.html');
    await expect(page).toHaveURL(/index\.html|\/$/);
  });

  test('a logged-in user opening the login page is sent to their home', async ({ page, request }) => {
    const acc = await apiSignup(request, 'volunteer');
    await seedSession(page, acc);
    await page.goto('/index.html');
    await expect(page).toHaveURL(/helper-dashboard\.html/);
  });
});
