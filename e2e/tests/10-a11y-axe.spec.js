// Automated WCAG 2 A/AA scan (axe-core) of the main pages, in light and dark mode.
import { test, expect, apiSignup, seedSession } from '../helpers/fixtures.js';
import AxeBuilder from '@axe-core/playwright';

const PAGES = {
  seeker: ['seeker-dashboard.html', 'resource-map.html', 'opportunities.html', 'resume-builder.html', 'progress.html', 'companion.html', 'call-shelter.html'],
  volunteer: ['helper-dashboard.html', 'donate.html', 'opportunities.html'],
};

for (const theme of ['light', 'dark']) {
  for (const [role, pages] of Object.entries(PAGES)) {
    test(`${role} pages pass axe WCAG A/AA checks (${theme} mode)`, async ({ page, request }) => {
      test.setTimeout(180_000);
      await seedSession(page, await apiSignup(request, role));
      await page.goto('/' + pages[0]);
      if (theme === 'dark') await page.getByRole('button', { name: 'Switch to dark mode' }).click();
      const problems = [];
      for (const p of pages) {
        await page.goto('/' + p);
        await page.waitForLoadState('networkidle');
        expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(theme === 'dark');
        // Map tiles are third-party images
        const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).exclude('.leaflet-tile-pane').analyze();
        for (const v of result.violations) problems.push(`${p}: ${v.id} (${v.impact}) x${v.nodes.length} e.g. ${v.nodes[0].target.join(' ')}`);
      }
      expect(problems).toEqual([]);
    });
  }
}
