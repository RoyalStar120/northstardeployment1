// Round-4 captures: map chip row → Wi-Fi filter, Filters → Offline panel → Download → Downloading... → Saved.
// Also records each tapped control's rect (390x844 CSS px) so the touch dot lands exactly on it.
// Usage: start the app (PORT=3456 node server.js), then `node scripts/capture-screens-v4.mjs`.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.NS_URL || 'http://localhost:3456';
const OUT = path.resolve('public/screens');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.createBrowserContext();
await ctx.overridePermissions(BASE, ['geolocation']);
const page = await ctx.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await page.setGeolocation({ latitude: 47.6062, longitude: -122.3321 });

// Guest session: signed-in sessions need a real Supabase token (js/user-data.js); we don't create accounts for a video.
await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  localStorage.clear();
  // Sessions now expire after 5 idle minutes (js/ns-boot.js), so stamp this one as just active.
  const now = Date.now();
  localStorage.setItem('northstar_session', JSON.stringify({ username: 'Guest', role: 'seeker', isGuest: true, loggedInAt: now, lastActiveAt: now }));
  sessionStorage.setItem('ns_session_active', '1');
  // Light theme to match the brief ("white, black and bright yellow") and the other captures.
  localStorage.setItem('northstar_theme_choice', 'light');
  localStorage.setItem('northstar_user_role', 'seeker');
  localStorage.setItem('northstar_location_asked', 'true');
  localStorage.setItem('northstar_last_location', JSON.stringify({ lat: 47.6062, lng: -122.3321 }));
});
await page.goto(`${BASE}/resource-map.html`, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
await wait(6000);

const clean = () => page.evaluate(() => document.querySelectorAll('[id^="nate-"],[class*="nate-"]').forEach((el) => el.remove()));
const rect = (sel) =>
  page.evaluate((s) => {
    const el = typeof s === 'string' ? document.querySelector(s) : null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  }, sel);
async function shot(name) {
  await clean();
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log('captured', name);
}

const rects = {};

// 1) Scroll the real chip row so Wi-Fi is on screen.
await page.evaluate(() => {
  const chip = document.querySelector('button[data-cat="wifi"]');
  chip?.scrollIntoView({ inline: 'center', block: 'nearest' });
});
await wait(800);
rects.wifiChip = await rect('button[data-cat="wifi"]');
await shot('map-chips');

// 2) Tap Wi-Fi.
await page.evaluate(() => document.querySelector('button[data-cat="wifi"]')?.click());
await wait(3500);
await shot('map-wifi');
rects.drawerCount = await page.evaluate(() => document.getElementById('drawer-count-badge')?.textContent?.trim());

// 3) Filters → Offline.
const filtersRect = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => /^\s*tune?\s*Filters/i.test(x.textContent) || /Filters/.test(x.textContent));
  if (!b) return null;
  const r = b.getBoundingClientRect();
  b.click();
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
});
rects.filters = filtersRect;
await wait(1200);
rects.offlineMode = await rect('#mode-btn-offline');
await page.evaluate(() => document.getElementById('mode-btn-offline')?.click());
await wait(1200);
await shot('map-offline');
rects.download = await rect('#download-offline-btn');
rects.offlineText = await page.evaluate(() => document.getElementById('offline-panel-status')?.textContent?.trim());

// 4) Download → Downloading... → Saved (real button states from js/offline-map.js).
await page.evaluate(() => document.getElementById('download-offline-btn')?.click());
await wait(60);
rects.downloadingText = await page.evaluate(() => document.getElementById('download-offline-btn')?.innerText);
await shot('map-downloading');
await wait(3500);
rects.savedText = await page.evaluate(() => document.getElementById('download-offline-btn')?.innerText);
await shot('map-saved');

// 5) Companion (current nav), light theme.
await page.goto(`${BASE}/companion.html`, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
await wait(4000);
rects.companionInput = await rect('textarea, input[placeholder*="Companion"]');
rects.companionSend = await rect('button[aria-label="Send"]');
await shot('companion-v4');

fs.writeFileSync(path.join(OUT, 'v4-rects.json'), JSON.stringify(rects, null, 2));
console.log(JSON.stringify(rects));
await browser.close();
