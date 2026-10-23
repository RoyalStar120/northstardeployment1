// Shared fixtures: console/network error capture and safe throwaway test accounts.
import { test as base, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CREATED_USERS_FILE = path.resolve(__dirname, '..', '.auth', 'created-users.json');

// Third-party noise that is not an app defect (CDN warnings, tile servers, fonts).
const IGNORED_CONSOLE = [
  /cdn\.tailwindcss\.com should not be used in production/i,
  /Download the React DevTools/i,
];
const IGNORED_REQUEST_HOSTS = [/tile\.openstreetmap|basemaps|cartocdn|arcgisonline|fonts\.g(static|oogleapis)/i];

export function recordCreatedUser(user) {
  fs.mkdirSync(path.dirname(CREATED_USERS_FILE), { recursive: true });
  let list = [];
  try { list = JSON.parse(fs.readFileSync(CREATED_USERS_FILE, 'utf8')); } catch (e) {}
  list.push({ id: user.id, username: user.username });
  fs.writeFileSync(CREATED_USERS_FILE, JSON.stringify(list, null, 2));
}

export function uniqueName(prefix = 'e2e') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

// Create a throwaway account through the real API. Usernames start with "e2e_" and are
// deleted by global-teardown.js.
export async function apiSignup(request, role = 'seeker') {
  const username = uniqueName(`e2e_${role}`);
  const password = 'e2e-Pass-' + Math.random().toString(36).slice(2, 8);
  const res = await request.post('/api/auth/signup', { data: { username, password, role } });
  const body = await res.json();
  expect(res.status(), JSON.stringify(body)).toBe(200);
  recordCreatedUser(body.user);
  return { username, password, role, user: body.user, token: body.token };
}

// Put a logged-in session in localStorage the same way index.html does after login.
export async function seedSession(page, account) {
  await page.addInitScript((acc) => {
    if (sessionStorage.getItem('__e2e_seeded')) return;
    sessionStorage.setItem('__e2e_seeded', '1');
    sessionStorage.setItem('ns_session_active', '1');
    sessionStorage.setItem('ns_splash_seen', '1');
    localStorage.setItem('northstar_location_asked', '1');
    localStorage.setItem('northstar_session', JSON.stringify({
      id: acc.user.id, username: acc.user.username, full_name: acc.user.username,
      role: acc.user.role, isGuest: false, token: acc.token, loggedInAt: Date.now(),
    }));
    localStorage.setItem('northstar_user_role', acc.user.role);
  }, account);
}

export async function seedGuest(page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('__e2e_seeded')) return;
    sessionStorage.setItem('__e2e_seeded', '1');
    sessionStorage.setItem('ns_session_active', '1');
    sessionStorage.setItem('ns_splash_seen', '1');
    localStorage.setItem('northstar_location_asked', '1');
    localStorage.setItem('northstar_session', JSON.stringify({ id: 'guest', username: 'Guest', role: 'seeker', isGuest: true, loggedInAt: Date.now() }));
    localStorage.setItem('northstar_user_role', 'seeker');
  });
}

export const test = base.extend({
  // Collects page errors, console errors and failed same-origin requests for every test.
  diagnostics: [async ({ page, baseURL }, use, testInfo) => {
    const diag = { pageErrors: [], consoleErrors: [], failedRequests: [], serverErrors: [] };
    page.on('pageerror', (err) => diag.pageErrors.push(`${err.name}: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      if (IGNORED_CONSOLE.some((re) => re.test(text))) return;
      diag.consoleErrors.push(text.slice(0, 300));
    });
    page.on('requestfailed', (req) => {
      const url = req.url();
      if (IGNORED_REQUEST_HOSTS.some((re) => re.test(url))) return;
      const reason = req.failure()?.errorText || '';
      if (/ERR_ABORTED/.test(reason)) return; // navigation away / cancelled fetches
      diag.failedRequests.push(`${req.method()} ${url} -> ${reason}`);
    });
    page.on('response', (res) => {
      if (res.url().startsWith(baseURL) && res.status() >= 500) diag.serverErrors.push(`${res.status()} ${res.url()}`);
    });
    await use(diag);
    const summary = JSON.stringify(diag, null, 2);
    await testInfo.attach('diagnostics.json', { body: summary, contentType: 'application/json' });
  }, { auto: true }],
});

export { expect };

// Assert there were no uncaught JS exceptions or 5xx responses from our server.
export function expectHealthy(diag) {
  expect.soft(diag.pageErrors, 'uncaught page errors').toEqual([]);
  expect.soft(diag.serverErrors, 'server 5xx responses').toEqual([]);
}
