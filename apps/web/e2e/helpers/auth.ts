import { Page, expect } from '@playwright/test'

/**
 * Shared test user credentials, read from env so CI can inject seeded values.
 * Falls back to the local demo account for dev machines.
 */
export const testUser = {
  email: process.env.E2E_USER_EMAIL || 'heldermaiato@outlook.com',
  password: process.env.E2E_USER_PASSWORD || 'test1234',
}

/**
 * Submit the credentials form and wait for the dashboard to render.
 * Use at the start of any authenticated spec.
 */
export async function login(page: Page): Promise<void> {
  await page.goto('/login')
  await page.getByPlaceholder('tu@gabinete.ao').fill(testUser.email)
  await page.locator('input[type="password"]').fill(testUser.password)
  await page.getByRole('button', { name: /^Entrar$/ }).click()
  // Dashboard root should become reachable.
  await page.waitForURL((url) => !/\/(login|register|forgot-password|reset-password)/.test(url.pathname), {
    timeout: 15_000,
  })
}

/**
 * Basic assertion that a dashboard page rendered without a Next.js error
 * boundary — check for the error heading emitted by Next's dev overlay.
 */
export async function expectNoFatalError(page: Page): Promise<void> {
  const errorHeading = page.getByRole('heading', { name: /Application error|Unhandled Runtime Error/i })
  await expect(errorHeading).toHaveCount(0)
}
