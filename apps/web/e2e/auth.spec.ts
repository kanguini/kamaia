import { test, expect } from '@playwright/test'

/**
 * Auth flow — unauthenticated pages only.
 * Covers login / register / forgot-password / reset-password: rendering,
 * client-side validation, and the password show/hide toggle introduced in
 * the Kamaia 2.0 redesign.
 */

test.describe('Auth pages render', () => {
  test('login page shows heading, form, and brand slogan', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
    await expect(page.getByPlaceholder('tu@gabinete.ao')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.getByText('Gestão jurídica inteligente,')).toBeVisible()
    await expect(page.getByText('Pessoas, Processos e Tecnologia')).toBeVisible()
    // Social login has been removed — neither Google nor Microsoft button
    // should be rendered on the login page.
    await expect(page.getByRole('button', { name: /Google/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Microsoft/i })).toHaveCount(0)
  })

  test('register page shows all required fields', async ({ page }) => {
    await page.goto('/register')
    await expect(page.getByRole('heading', { name: 'Criar conta' })).toBeVisible()
    await expect(page.locator('input[placeholder="Helder"]')).toBeVisible()
    await expect(page.locator('input[placeholder="Maiato"]')).toBeVisible()
    await expect(page.locator('input[autocomplete="email"]')).toBeVisible()
    // Two password fields (new + confirm)
    await expect(page.locator('input[autocomplete="new-password"]')).toHaveCount(2)
  })

  test('forgot-password page shows email field + submit', async ({ page }) => {
    await page.goto('/forgot-password')
    await expect(page.getByRole('heading', { name: 'Redefinir palavra-passe' })).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /Enviar link/i })).toBeVisible()
  })
})

test.describe('Auth validation', () => {
  test('login rejects invalid email format client-side', async ({ page }) => {
    // HTML5 type="email" blocks submit natively before Zod runs. We assert
    // that the browser flags the field as invalid — independent of how the
    // validation UI is surfaced (native popup vs Zod error).
    await page.goto('/login')
    const email = page.getByPlaceholder('tu@gabinete.ao')
    await email.fill('not-an-email')
    await page.locator('input[type="password"]').fill('short')
    await page.getByRole('button', { name: /^Entrar$/ }).click()
    const isInvalid = await email.evaluate((el: HTMLInputElement) => !el.validity.valid)
    expect(isInvalid).toBe(true)
  })

  test('login shows error for wrong credentials', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('tu@gabinete.ao').fill('nobody@kamaia.test')
    await page.locator('input[type="password"]').fill('wrongpassword123')
    await page.getByRole('button', { name: /^Entrar$/ }).click()
    await expect(page.getByText(/palavra-passe incorrectos|Erro ao iniciar/i)).toBeVisible({
      timeout: 15_000,
    })
  })

  test('register blocks mismatched passwords', async ({ page }) => {
    await page.goto('/register')
    await page.locator('input[placeholder="Helder"]').fill('Tester')
    await page.locator('input[placeholder="Maiato"]').fill('Kamaia')
    await page.locator('input[autocomplete="email"]').fill('tester@kamaia.test')
    const pw = page.locator('input[autocomplete="new-password"]')
    await pw.nth(0).fill('SecurePass1')
    await pw.nth(1).fill('Different99')
    await page.locator('input[placeholder*="Associados"]').fill('Gabinete Teste')
    await page.getByRole('button', { name: /Criar conta/i }).click()
    await expect(page.getByText(/As palavras-passe não coincidem/i)).toBeVisible()
  })
})

test.describe('Password show/hide toggle', () => {
  test('toggle switches input type on login', async ({ page }) => {
    await page.goto('/login')
    const pw = page.locator('input[autocomplete="current-password"]')
    await pw.fill('Test1234!')
    await expect(pw).toHaveAttribute('type', 'password')

    await page.getByRole('button', { name: 'Mostrar palavra-passe' }).click()
    await expect(pw).toHaveAttribute('type', 'text')

    await page.getByRole('button', { name: 'Ocultar palavra-passe' }).click()
    await expect(pw).toHaveAttribute('type', 'password')
  })

  test('register has independent toggles for password + confirm', async ({ page }) => {
    await page.goto('/register')
    const pws = page.locator('input[autocomplete="new-password"]')
    await pws.nth(0).fill('AAAaaa111')
    await pws.nth(1).fill('AAAaaa111')

    const toggles = page.getByRole('button', { name: /palavra-passe$/i })
    await toggles.first().click()
    await expect(pws.nth(0)).toHaveAttribute('type', 'text')
    await expect(pws.nth(1)).toHaveAttribute('type', 'password')
  })
})
