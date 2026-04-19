import { test, expect } from '@playwright/test'

/**
 * Marketing smoke — every route renders, key CTAs link to the app, the
 * contact form validates client-side. Backend (Resend) not exercised.
 */

const ROUTES = [
  { path: '/', heading: /Gestão jurídica inteligente/i },
  { path: '/funcionalidades', heading: /Tudo o que um gabinete precisa/i },
  { path: '/precos', heading: /Simples\. Por utilizador/i },
  { path: '/sobre', heading: /Tecnologia jurídica/i },
  { path: '/contacto', heading: /Fala connosco/i },
  { path: '/politica-privacidade', heading: /Política de privacidade/i },
  { path: '/termos', heading: /Termos de serviço/i },
]

test.describe('Marketing · pages render', () => {
  for (const r of ROUTES) {
    test(`${r.path}`, async ({ page }) => {
      const res = await page.goto(r.path)
      expect(res?.status(), `${r.path} HTTP status`).toBeLessThan(400)
      await expect(page.getByRole('heading', { name: r.heading }).first()).toBeVisible()
      // Footer present
      await expect(page.getByText(/© \d{4} Kamaia/)).toBeVisible()
    })
  }
})

test.describe('Marketing · CTAs point to app.kamaia.cc', () => {
  test('hero "Começar grátis" carries UTM', async ({ page }) => {
    await page.goto('/')
    const cta = page
      .getByRole('link', { name: /Começar grátis/ })
      .first()
    const href = await cta.getAttribute('href')
    expect(href).toMatch(/app\.kamaia\.cc\/register/)
    expect(href).toMatch(/utm_source=site/)
    expect(href).toMatch(/utm_medium=hero_cta/)
  })

  test('nav "Entrar" goes to app login', async ({ page }) => {
    await page.goto('/')
    const login = page.getByRole('link', { name: /^Entrar$/ }).first()
    const href = await login.getAttribute('href')
    expect(href).toMatch(/app\.kamaia\.cc\/login/)
  })
})

test.describe('Marketing · contact form', () => {
  test('rejects empty submission with field errors', async ({ page }) => {
    await page.goto('/contacto')
    // HTML5 required stops submission of empty form — check the input is invalid.
    const nameInput = page.locator('input[autocomplete="name"]').first()
    await nameInput.fill('')
    const isInvalid = await nameInput.evaluate(
      (el: HTMLInputElement) => !el.validity.valid,
    )
    expect(isInvalid).toBe(true)
  })

  test('accepts valid data and reaches server action (logs in dev)', async ({ page }) => {
    await page.goto('/contacto')
    await page.locator('input[autocomplete="name"]').fill('Teste E2E')
    await page.locator('input[autocomplete="email"]').fill('teste@kamaia.test')
    await page.locator('textarea').fill('Mensagem de teste com mais de 10 caracteres.')
    await page.getByRole('button', { name: /^Enviar mensagem$/ }).click()
    // Without RESEND_API_KEY the server action returns ok=true (dev mode).
    await expect(page.getByText('Mensagem enviada')).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Marketing · SEO', () => {
  test('robots and sitemap are served', async ({ request }) => {
    const robots = await request.get('/robots.txt')
    expect(robots.status()).toBe(200)
    expect(await robots.text()).toMatch(/Sitemap:/)

    const sitemap = await request.get('/sitemap.xml')
    expect(sitemap.status()).toBe(200)
    const xml = await sitemap.text()
    expect(xml).toContain('/funcionalidades')
    expect(xml).toContain('/precos')
  })

  test('json-ld is embedded in root document', async ({ page }) => {
    await page.goto('/')
    const ldJson = await page.locator('script[type="application/ld+json"]').innerText()
    expect(ldJson).toContain('Kamaia')
    expect(ldJson).toContain('SoftwareApplication')
  })
})
