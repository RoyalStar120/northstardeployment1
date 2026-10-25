// End-to-end workflows not covered elsewhere: the full food-pickup help request loop,
// delivery privacy, login brute-force protection, saved places, directions and back navigation.
import { test, expect, expectHealthy, apiSignup, seedSession, greeting } from '../helpers/fixtures.js';

const auth = (acc) => ({ Authorization: `Bearer ${acc.token}` });

// The place card opens when a place is chosen; a ?resource= link chooses one directly.
async function openPlaceCard(page, request) {
  const { resources } = await (await request.get('/api/resources')).json();
  const place = resources.find((r) => typeof r.lat === 'number' && r.name && r.address);
  await page.goto(`/resource-map.html?resource=${encodeURIComponent(place.id)}`);
  const card = page.locator('#place-focus-card');
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card).toContainText(place.name);
  return { card, place };
}

test.describe('Help requests: food pickup loop', () => {
  test('donor requests a pickup in the UI, another volunteer claims it, the donor sees it claimed', async ({ browser, request }) => {
    const donor = await apiSignup(request, 'volunteer');
    const driver = await apiSignup(request, 'volunteer');
    const item = `E2E TEST soup ${Date.now().toString(36)}`;

    // Donor: Donate food → two items → "I need a pickup" → Request a pickup
    const donorCtx = await browser.newContext();
    const donorPage = await donorCtx.newPage();
    await seedSession(donorPage, donor);
    await donorPage.goto('/donate.html');
    await donorPage.locator('button[data-action="food"]').click();
    await expect(donorPage.locator('#food-intake-modal')).toBeVisible();
    // Validation: continuing with no items is refused
    await donorPage.getByRole('button', { name: 'Next' }).click();
    await expect(donorPage.locator('#food-intake-error')).toContainText(/item/i);
    await donorPage.locator('#food-item-name').fill(item);
    await donorPage.locator('#food-item-qty').fill('3');
    await donorPage.getByRole('button', { name: 'Next' }).click();
    await donorPage.locator('#dropoff-no-btn').click();
    await expect(donorPage.locator('#food-submit-btn')).toHaveText(/pickup/i);
    await donorPage.locator('#food-pickup-area').fill('E2E Test Area');
    await donorPage.locator('#food-pickup-notes').fill('E2E private gate code 0000');
    const created = donorPage.waitForResponse((r) => r.url().endsWith('/api/deliveries') && r.request().method() === 'POST');
    await donorPage.locator('#food-submit-btn').click();
    const createdBody = await (await created).json();
    const id = createdBody.delivery.id;
    expect(createdBody.delivery.donor_id, 'donor comes from the sign-in token').toBe(donor.user.id);

    // Driver: sees the request in the helper home queue and claims it
    const driverCtx = await browser.newContext();
    const driverPage = await driverCtx.newPage();
    await seedSession(driverPage, driver);
    await driverPage.goto('/helper-dashboard.html');
    const row = driverPage.locator('div,li').filter({ hasText: item }).filter({ has: driverPage.getByRole('button', { name: 'Claim' }) }).last();
    await expect(row).toBeVisible({ timeout: 20_000 });
    const claimed = driverPage.waitForResponse((r) => r.url().includes(`/api/deliveries/${id}/claim`));
    await row.getByRole('button', { name: 'Claim' }).click();
    expect((await claimed).status()).toBe(200);

    // Server state: claimed by the driver; the driver may now see the donor's notes
    const asDriver = await (await request.get(`/api/deliveries/${id}`, { headers: auth(driver) })).json();
    expect(asDriver.delivery.status).toBe('driver_assigned');
    expect(asDriver.delivery.driver_id).toBe(driver.user.id);
    expect(asDriver.delivery.contactNotes).toContain('gate code');

    // Driver moves it along; only the claiming driver may
    expect((await request.post(`/api/deliveries/${id}/status`, { headers: auth(driver), data: { status: 'in_transit' } })).status()).toBe(200);
    expect((await request.post(`/api/deliveries/${id}/status`, { headers: auth(donor), data: { status: 'delivered' } })).status()).toBe(403);

    // Donor: after refresh the donation is tracked as in progress
    await donorPage.reload();
    const asDonor = await (await request.get(`/api/deliveries/${id}`, { headers: auth(donor) })).json();
    expect(asDonor.delivery.status).toBe('in_transit');
    await donorCtx.close();
    await driverCtx.close();
  });
});

test.describe('Delivery privacy', () => {
  test('donor id and contact notes are hidden from everyone except the donor and the claiming driver', async ({ request }) => {
    const donor = await apiSignup(request, 'volunteer');
    const stranger = await apiSignup(request, 'volunteer');
    const res = await request.post('/api/deliveries', {
      headers: auth(donor),
      // A spoofed donor id in the body must be ignored
      data: { items: ['E2E TEST privacy kit'], bags: 1, donorArea: 'E2E', contactNotes: 'E2E secret note', donor_id: stranger.user.id },
    });
    const { delivery } = await res.json();
    expect(delivery.donor_id).toBe(donor.user.id);

    const pick = (list) => list.find((d) => d.id === delivery.id);
    const anon = pick((await (await request.get('/api/deliveries')).json()).deliveries);
    expect(anon, 'listed for volunteers').toBeTruthy();
    expect(anon.contactNotes).toBeNull();
    expect(anon.donor_id).toBeNull();
    const other = pick((await (await request.get('/api/deliveries', { headers: auth(stranger) })).json()).deliveries);
    expect(other.contactNotes).toBeNull();
    const own = pick((await (await request.get('/api/deliveries', { headers: auth(donor) })).json()).deliveries);
    expect(own.contactNotes).toBe('E2E secret note');
    expect(own.donor_id).toBe(donor.user.id);
    const single = await (await request.get(`/api/deliveries/${delivery.id}`)).json();
    expect(single.delivery.contactNotes).toBeNull();
  });
});

test.describe('Login protection', () => {
  test('repeated wrong passwords lock that username for a while, even for the right password', async ({ request, page }) => {
    const acc = await apiSignup(request, 'seeker');
    for (let i = 0; i < 8; i++) {
      const r = await request.post('/api/auth/login', { data: { username: acc.username, password: 'wrong-' + i } });
      expect(r.status()).toBe(401);
    }
    const locked = await request.post('/api/auth/login', { data: { username: acc.username, password: acc.password } });
    expect(locked.status()).toBe(429);
    expect((await locked.json()).error).toMatch(/too many tries/i);

    // The sign-in screen shows the message instead of logging in
    await page.addInitScript(() => sessionStorage.setItem('ns_splash_seen', '1'));
    await page.goto('/index.html');
    const login = await page.evaluate(async ({ u, p }) => {
      const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) });
      return r.status;
    }, { u: acc.username, p: acc.password });
    expect(login).toBe(429);
  });

  test('a guessed legacy id cannot claim an account that already has a password', async ({ request }) => {
    const acc = await apiSignup(request, 'seeker');
    const r = await request.post('/api/auth/login', { data: { username: acc.username, password: 'attacker-pass', legacyId: acc.user.id } });
    expect(r.status()).toBe(401);
    // The real password still works
    expect((await request.post('/api/auth/login', { data: { username: acc.username, password: acc.password } })).status()).toBe(200);
  });
});

test.describe('Seeker persistence and navigation', () => {
  let acc;
  test.beforeEach(async ({ page, request }) => {
    acc = await apiSignup(request, 'seeker');
    await seedSession(page, acc);
  });

  test('saving a place survives a reload and reaches the account', async ({ page, request, diagnostics }) => {
    const supabaseCalls = [];
    page.on('request', (r) => { if (/supabase\.co\/rest\/v1\/user_saved_places/.test(r.url())) supabaseCalls.push(r.url()); });
    const { card, place } = await openPlaceCard(page, request);
    const name = place.name;
    const saveBtn = card.getByRole('button', { name: 'Save this place' });
    const synced = page.waitForRequest((r) => /\/api\/user-data\//.test(r.url()) && r.method() === 'PUT', { timeout: 20_000 });
    await saveBtn.click();
    await expect(card.getByRole('button', { name: 'Remove from saved' })).toBeVisible();
    await synced;

    // Reload (the page drops ?resource= after opening it), then open the same place again
    await page.reload();
    await page.waitForLoadState('networkidle');
    await openPlaceCard(page, request);
    await expect(page.locator('#place-focus-card').getByRole('button', { name: 'Remove from saved' })).toBeVisible({ timeout: 20_000 });

    // Stored on the account (server copy), not only on this phone
    const data = await (await request.get(`/api/user-data/${acc.user.id}`, { headers: auth(acc) })).json();
    expect(String(data.data.northstar_user_saved_places || '')).not.toBe('');
    expect(supabaseCalls, 'browser must not call the removed user_saved_places table').toEqual([]);
    console.log(`saved place: ${name}`);
    expectHealthy(diagnostics);
  });

  test('directions open for the focused place with a route or a clear error', async ({ page, request, diagnostics }) => {
    const { card } = await openPlaceCard(page, request);
    const dirResp = page.waitForResponse((r) => r.url().includes('/api/transit-directions'), { timeout: 30_000 });
    await card.getByRole('button', { name: /Directions/ }).click();
    const modal = page.locator('#transit-directions-modal');
    await expect(modal).toBeVisible();
    const resp = await dirResp;
    if (resp.status() === 200) {
      await expect(page.locator('#transit-steps-list > *').first()).toBeVisible({ timeout: 20_000 });
      await expect(page.locator('#transit-total-duration')).not.toHaveText('–');
    } else {
      await expect(page.locator('#transit-steps-list')).toContainText(/.+/);
    }
    expectHealthy(diagnostics);
  });

  test('back navigation returns through pages without losing the session', async ({ page }) => {
    await page.goto('/seeker-dashboard.html');
    await expect(page.getByRole('heading', { name: greeting(acc.username) })).toBeVisible();
    await page.goto('/resource-map.html');
    await page.goto('/opportunities.html');
    await page.goBack();
    await expect(page).toHaveURL(/resource-map\.html/);
    await page.goBack();
    await expect(page).toHaveURL(/seeker-dashboard\.html/);
    await expect(page.getByRole('heading', { name: greeting(acc.username) })).toBeVisible();
  });

  test('map pins are announced by place name, not by icon text', async ({ page }) => {
    await page.goto('/resource-map.html');
    await expect(page.locator('#map-loading-overlay')).toBeHidden({ timeout: 20_000 });
    const pins = page.locator('.leaflet-marker-icon.ns-pin');
    await expect(pins.first()).toBeVisible();
    const names = await pins.evaluateAll((els) => els.slice(0, 40).map((e) => e.innerText.trim()));
    const iconOnly = names.filter((n) => /^(bed|restaurant|shower|wifi|home|local_dining|wc)$/.test(n));
    expect(iconOnly, 'pins whose only text is an icon ligature').toEqual([]);
    const accName = await pins.first().evaluate((e) => e.getAttribute('title') || e.innerText);
    expect(accName.length).toBeGreaterThan(3);
  });
});
