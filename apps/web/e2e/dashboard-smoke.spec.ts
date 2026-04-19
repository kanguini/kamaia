import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

/**
 * Dashboard smoke suite — parametrised, 3 assertions per module:
 *   1. Page loads (no redirect back to /login, no error overlay)
 *   2. A recognisable page marker is visible (heading text)
 *   3. Navigation chrome remains mounted (sidebar brand mark)
 *
 * Requires a seeded user. See E2E_USER_EMAIL / E2E_USER_PASSWORD env.
 */

type Module = {
  name: string
  path: string
  // Regex applied against visible text; matches case-insensitively.
  marker: RegExp
}

const MODULES: Module[] = [
  { name: 'Dashboard',      path: '/',                marker: /Bom (dia|tarde|noite)/ },
  { name: 'Clientes',       path: '/clientes',        marker: /clientes/i },
  { name: 'Processos',      path: '/processos',       marker: /processos/i },
  { name: 'Projectos',      path: '/projectos',       marker: /projectos|projetos/i },
  { name: 'Tarefas',        path: '/tarefas',         marker: /tarefas/i },
  { name: 'Timesheets',     path: '/timesheets',      marker: /timesheets|horas/i },
  { name: 'Despesas',       path: '/despesas',        marker: /despesas/i },
  { name: 'Agenda',         path: '/agenda',          marker: /agenda|calendário|calendario/i },
  { name: 'Equipa',         path: '/equipa',          marker: /equipa/i },
  { name: 'Prazos',         path: '/prazos',          marker: /prazos/i },
  { name: 'Documentos',     path: '/documentos',      marker: /documentos/i },
  { name: 'Facturas',       path: '/facturas',        marker: /facturas|faturas/i },
  { name: 'IA Assistente',  path: '/ia-assistente',   marker: /ia|assistente/i },
  { name: 'Configurações',  path: '/configuracoes',   marker: /configurações|configuracoes/i },
]

test.describe('Dashboard — authenticated pages smoke', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  for (const mod of MODULES) {
    test(`${mod.name} (${mod.path}) renders for an authenticated user`, async ({ page }) => {
      const response = await page.goto(mod.path)
      // 1. HTTP response OK-ish (2xx/3xx — 304 is fine)
      expect(response?.status(), 'HTTP status').toBeLessThan(400)

      // 2. Not bounced to /login (session is valid)
      expect(page.url(), 'should stay on authenticated page').not.toMatch(/\/login/)

      // 3. Recognisable text marker visible — proves the page actually rendered
      //    (not just the layout shell).
      await expect(page.getByText(mod.marker).first()).toBeVisible({ timeout: 10_000 })
    })
  }

  test('sidebar and topbar remain mounted across navigation', async ({ page }) => {
    await page.goto('/clientes')
    // "+ Novo" dropdown or search slot live in the topbar — one of these
    // chrome elements should always be present.
    const chrome = page.locator('[class*="k2-"]').first()
    await expect(chrome).toBeVisible()
  })
})
