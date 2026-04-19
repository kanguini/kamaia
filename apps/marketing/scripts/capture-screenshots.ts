/* eslint-disable no-console */
/**
 * Captures real dashboard screenshots to embed in the marketing site.
 *
 * Uses Playwright with a Retina-ish viewport (1440 × 900 @ DPR 2). Saves to
 * `apps/marketing/public/screens/*.png`. Credentials come from env vars:
 *
 *   SCREENS_BASE_URL=https://kamaia.vercel.app
 *   SCREENS_USER_EMAIL=...
 *   SCREENS_USER_PASSWORD=...
 *
 * Usage:
 *   npm run capture-screens --workspace=@kamaia/marketing
 */
import { chromium, type Page } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'

const BASE_URL = process.env.SCREENS_BASE_URL || 'https://kamaia.vercel.app'
const EMAIL = process.env.SCREENS_USER_EMAIL
const PASSWORD = process.env.SCREENS_USER_PASSWORD

const OUT_DIR = path.resolve(__dirname, '..', 'public', 'screens')

interface ScreenTarget {
  name: string
  path: string
  /** Optional: wait for a specific selector before capturing. */
  waitFor?: string
  /** Optional: extra ms delay after navigation (for animations to settle). */
  delayMs?: number
}

const TARGETS: ScreenTarget[] = [
  { name: 'dashboard', path: '/', waitFor: 'h1' },
  { name: 'projectos', path: '/projectos', waitFor: 'h1' },
  { name: 'processos', path: '/processos', waitFor: 'h1' },
  { name: 'clientes', path: '/clientes', waitFor: 'h1' },
  { name: 'prazos', path: '/prazos', waitFor: 'h1' },
  { name: 'documentos', path: '/documentos', waitFor: 'h1' },
  { name: 'facturas', path: '/facturas', waitFor: 'h1' },
  { name: 'agenda', path: '/agenda', waitFor: 'h1' },
  { name: 'timesheets', path: '/timesheets', waitFor: 'h1' },
  { name: 'ia-assistente', path: '/ia-assistente', waitFor: 'h1' },
]

async function login(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/login`)
  await page.getByPlaceholder('tu@gabinete.ao').fill(EMAIL!)
  await page.locator('input[type="password"]').fill(PASSWORD!)
  await page.getByRole('button', { name: /^Entrar$/ }).click()
  await page.waitForURL(
    (url) =>
      !/\/(login|register|forgot-password|reset-password)/.test(url.pathname),
    { timeout: 20_000 },
  )
}

async function capture(page: Page, target: ScreenTarget): Promise<void> {
  await page.goto(`${BASE_URL}${target.path}`)
  if (target.waitFor) {
    try {
      await page.waitForSelector(target.waitFor, { timeout: 8000 })
    } catch {
      /* fall through — still take the shot */
    }
  }
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
  if (target.delayMs) await page.waitForTimeout(target.delayMs)

  const outPath = path.join(OUT_DIR, `${target.name}-dark.png`)
  await page.screenshot({ path: outPath, fullPage: false })
  console.log(`  ✓ ${target.name} → ${path.relative(process.cwd(), outPath)}`)
}

async function main(): Promise<void> {
  if (!EMAIL || !PASSWORD) {
    console.error(
      'Missing SCREENS_USER_EMAIL / SCREENS_USER_PASSWORD env vars. ' +
        'See apps/marketing/.env.example.',
    )
    process.exit(1)
  }

  fs.mkdirSync(OUT_DIR, { recursive: true })

  console.log(`Launching Chromium · target ${BASE_URL}`)
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2, // retina output
    colorScheme: 'dark',
    locale: 'pt-PT',
  })
  const page = await context.newPage()

  try {
    console.log('Logging in…')
    await login(page)
    console.log(`Capturing ${TARGETS.length} pages →`)
    for (const t of TARGETS) await capture(page, t)
    console.log('Done.')
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
