import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config for Kamaia web E2E.
 *
 * Environment variables:
 * - E2E_BASE_URL — defaults to http://localhost:3000 (local dev)
 * - E2E_USER_EMAIL / E2E_USER_PASSWORD — credentials for an existing seeded
 *   user. Required for tests that hit authenticated pages.
 *
 * Runs only Chromium by default (keeps CI quick). Add more devices as the
 * suite matures.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // If a dev server isn't already running, Playwright starts `next dev` on 3000.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        port: 3000,
        reuseExistingServer: true,
        timeout: 120_000,
      },
})
