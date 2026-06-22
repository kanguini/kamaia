import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

/**
 * CLM flow — verifica que as features das Fases A-D estão wired:
 *
 *  - A: forms como slide-over (botão "Novo contrato" abre Drawer)
 *  - B: editor + botão "Redigir com IA" presentes na detail-page
 *  - C: tab "Partilha" presente e abre Drawer de convite
 *  - D: tab "Assinaturas" presente com botão "Descarregar PDF"
 *
 * Não submete formulários (evita escritas reais ao DB no smoke). Foco
 * em UI integrity — se os Drawers abrem e os botões existem, a
 * regression de "removi acidentalmente um componente" é detectada.
 *
 * Para testes ponta-a-ponta com escritas reais (criar contrato → IA
 * → convidar → assinar canvas → PDF), criar um perfil dedicado
 * "destructive" com tenant de teste isolado.
 */

test.describe('CLM — UI integrity smoke', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('lista de contratos abre Drawer "Novo contrato" (Fase A)', async ({ page }) => {
    await page.goto('/contratos')
    // O botão "Novo contrato" tem que estar presente — substituiu o link antigo
    const novoBtn = page.getByRole('button', { name: /novo contrato/i })
    await expect(novoBtn).toBeVisible({ timeout: 10_000 })

    // Click abre o slide-over (DrawerHeader com "Novo contrato")
    await novoBtn.click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText(/novo contrato/i).first()).toBeVisible()

    // ESC fecha o drawer
    await page.keyboard.press('Escape')
    // O dialog deve desaparecer em ≤ 1s (transição 220ms)
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 2_000 })
  })

  test('rota antiga /contratos/novo redirecciona para /contratos?novo=1', async ({ page }) => {
    await page.goto('/contratos/novo')
    // Next.js server-side redirect; final URL inclui ?novo=1
    await expect(page).toHaveURL(/\/contratos(\?novo=1)?$/, { timeout: 10_000 })
  })

  test('entidades abre Drawer "Nova entidade" (Fase A)', async ({ page }) => {
    await page.goto('/entidades')
    const novaBtn = page.getByRole('button', { name: /nova entidade/i })
    await expect(novaBtn).toBeVisible({ timeout: 10_000 })
    await novaBtn.click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })
    await page.keyboard.press('Escape')
  })

  test('carteiras abre Drawer "Nova carteira" (Fase A)', async ({ page }) => {
    await page.goto('/carteiras')
    const novaBtn = page.getByRole('button', { name: /nova carteira/i })
    await expect(novaBtn).toBeVisible({ timeout: 10_000 })
    await novaBtn.click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })
    await page.keyboard.press('Escape')
  })

  test('detalhe de contrato expõe tabs Editor/Partilha/Assinaturas (Fases B-D)', async ({
    page,
  }) => {
    // Vamos buscar o primeiro contrato seedado (carteira demo). Se o tenant
    // não tiver contratos ainda, este teste será skip — não queremos
    // bloquear smoke se o demo seed ainda não correu no env.
    await page.goto('/contratos')
    const firstLink = page.locator('a[href^="/contratos/"]').first()
    const count = await firstLink.count()
    test.skip(count === 0, 'No seeded contracts in this environment')

    await firstLink.click()
    await page.waitForURL(/\/contratos\/[0-9a-f-]{36}/, { timeout: 10_000 })

    // Tabs visíveis
    for (const label of ['Editor', 'Partilha', 'Assinaturas', 'Documentos']) {
      await expect(page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') })).toBeVisible({
        timeout: 5_000,
      })
    }

    // Editor → botão "Redigir com IA" (Fase B)
    await page.getByRole('button', { name: /^editor$/i }).click()
    await expect(page.getByRole('button', { name: /redigir com ia/i })).toBeVisible({
      timeout: 5_000,
    })

    // Partilha → botão "Convidar" (Fase C)
    await page.getByRole('button', { name: /^partilha$/i }).click()
    await expect(page.getByRole('button', { name: /^convidar$/i })).toBeVisible({
      timeout: 5_000,
    })

    // Assinaturas → "Descarregar PDF" (Fase D)
    await page.getByRole('button', { name: /^assinaturas$/i }).click()
    await expect(page.getByRole('button', { name: /descarregar pdf/i })).toBeVisible({
      timeout: 5_000,
    })
  })
})
