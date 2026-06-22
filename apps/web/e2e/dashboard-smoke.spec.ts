import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

/**
 * Dashboard smoke suite — CLM modules.
 *
 * Cobertura: cada módulo CLM principal carrega para um utilizador
 * autenticado, sem redireccionar para /login e com um marcador
 * visível na página. Substitui a suite antiga (legal practice
 * management) após o pivot para CLM em Junho/2026.
 *
 * Requer um seeded user (E2E_USER_EMAIL / E2E_USER_PASSWORD).
 */

type Module = {
  name: string
  path: string
  /** Regex aplicada a texto visível na página, case-insensitive. */
  marker: RegExp
}

const MODULES: Module[] = [
  { name: 'Dashboard',     path: '/',            marker: /bom (dia|tarde|noite)|contratos|kamaia/i },
  { name: 'Contratos',     path: '/contratos',   marker: /contratos/i },
  { name: 'Entidades',     path: '/entidades',   marker: /entidades/i },
  { name: 'Carteiras',     path: '/carteiras',   marker: /carteiras/i },
  { name: 'Templates',     path: '/templates',   marker: /templates|cláusulas|clausulas/i },
  { name: 'IA Assistente', path: '/ia',          marker: /ia|assistente|claude/i },
  { name: 'Configurações', path: '/configuracoes', marker: /configurações|configuracoes/i },
]

test.describe('Dashboard CLM — authenticated pages smoke', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  for (const mod of MODULES) {
    test(`${mod.name} (${mod.path}) renders for an authenticated user`, async ({ page }) => {
      const response = await page.goto(mod.path)
      expect(response?.status(), 'HTTP status').toBeLessThan(400)
      expect(page.url(), 'should stay on authenticated page').not.toMatch(/\/login/)
      await expect(page.getByText(mod.marker).first()).toBeVisible({ timeout: 10_000 })
    })
  }
})
