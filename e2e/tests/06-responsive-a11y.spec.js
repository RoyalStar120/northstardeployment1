// Responsive layout and basic accessibility checks across the main pages.
import { test, expect, apiSignup, seedSession } from '../helpers/fixtures.js';

const SEEKER_PAGES = ['seeker-dashboard.html', 'resource-map.html', 'opportunities.html', 'resume-builder.html', 'progress.html', 'companion.html', 'call-shelter.html'];
const VOLUNTEER_PAGES = ['helper-dashboard.html', 'donate.html', 'opportunities.html'];

async function audit(page) {
  return page.evaluate(() => {
    const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length) && getComputedStyle(el).visibility !== 'hidden';
    const nameOf = (el) => (el.getAttribute('aria-label') || el.getAttribute('title') || (el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby'))?.textContent) || el.textContent || '').trim();
    const unnamedButtons = [...document.querySelectorAll('button, [role=button], a[href]')]
      .filter(visible).filter((el) => !nameOf(el)).map((el) => el.outerHTML.slice(0, 120));
    const unlabeledInputs = [...document.querySelectorAll('input:not([type=hidden]):not([type=file]), textarea, select')]
      .filter(visible).filter((el) => !(el.labels && el.labels.length) && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby'))
      .map((el) => el.id || el.name || el.outerHTML.slice(0, 80));
    const imgsNoAlt = [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).map((i) => i.src.slice(-60));
    const overflowX = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    return { unnamedButtons, unlabeledInputs, imgsNoAlt, overflowX, lang: document.documentElement.lang, title: document.title };
  });
}

for (const [role, pages] of [['seeker', SEEKER_PAGES], ['volunteer', VOLUNTEER_PAGES]]) {
  for (const vp of [{ name: 'phone', width: 412, height: 915 }, { name: 'desktop', width: 1366, height: 900 }]) {
    test(`${role} pages on ${vp.name}: no horizontal overflow, named controls, labeled inputs`, async ({ page, request }, testInfo) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await seedSession(page, await apiSignup(request, role));
      const report = {};
      for (const p of pages) {
        await page.goto('/' + p);
        await page.waitForTimeout(1500);
        report[p] = await audit(page);
      }
      await testInfo.attach('a11y-report.json', { body: JSON.stringify(report, null, 2), contentType: 'application/json' });
      for (const [p, r] of Object.entries(report)) {
        expect.soft(r.overflowX, `${p} horizontal overflow (px)`).toBeLessThanOrEqual(1);
        expect.soft(r.lang, `${p} <html lang>`).toBeTruthy();
        expect.soft(r.title, `${p} <title>`).toBeTruthy();
        expect.soft(r.unnamedButtons, `${p} controls without an accessible name`).toEqual([]);
        expect.soft(r.unlabeledInputs, `${p} inputs without a label`).toEqual([]);
        expect.soft(r.imgsNoAlt, `${p} images without alt`).toEqual([]);
      }
    });
  }
}

test('pages load within a reasonable time on a fast connection', async ({ page, request }) => {
  await seedSession(page, await apiSignup(request));
  for (const p of ['seeker-dashboard.html', 'resource-map.html', 'opportunities.html']) {
    const t0 = Date.now();
    await page.goto('/' + p, { waitUntil: 'load' });
    const ms = Date.now() - t0;
    expect.soft(ms, `${p} load ms`).toBeLessThan(8000);
  }
});
