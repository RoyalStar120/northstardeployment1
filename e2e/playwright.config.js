// Playwright config for the NorthStar web app.
// Docs: https://playwright.dev/docs/test-configuration
import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.E2E_PORT || 3100);
const BASE_URL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  // Tests share one real backend and real Supabase project; keep runs serial and predictable.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: './playwright-report' }], ['json', { outputFile: './reports/results.json' }]],
  globalTeardown: './global-teardown.js',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    // The app is mobile-first.
    ...devices['Pixel 7'],
    // Never grant real location; tests use a fixed Seattle coordinate when needed.
    geolocation: { latitude: 47.6062, longitude: -122.3321 },
    permissions: [],
  },
  projects: [
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'node server.js',
    cwd: path.resolve(__dirname, '..'),
    url: `${BASE_URL}/api/config`,
    reuseExistingServer: true,
    timeout: 60_000,
    env: { PORT: String(PORT) },
  },
});
