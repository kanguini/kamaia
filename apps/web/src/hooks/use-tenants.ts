'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { api, ACTIVE_TENANT_KEY, getActiveTenantId, setActiveTenantId } from '@/lib/api'
import type { Role, TenantPlan } from '@kamaia/shared-types'

/**
 * Shape devolvido por `GET /tenants` no API CLM:
 *
 *   [
 *     { id, slug, nome, plan, status, parentTenantId, logoUrl, role, isDefault },
 *     ...
 *   ]
 *
 * Não está embrulhado em `{ data: [...] }` — é array directo.
 */
export interface TenantMembership {
  id: string
  slug: string
  nome: string
  plan: TenantPlan
  status: string
  parentTenantId: string | null
  logoUrl: string | null
  role: Role
  isDefault: boolean
}

export function useTenants() {
  const { data: session, status } = useSession()
  const [tenants, setTenants] = useState<TenantMembership[]>([])
  const [activeTenantId, setActiveTenantIdState] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setActiveTenantIdState(getActiveTenantId())
  }, [])

  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    api<TenantMembership[]>('/tenants', {
      token: session.accessToken,
      noTenant: true,
    })
      .then((list) => {
        if (cancelled) return
        const safe = Array.isArray(list) ? list : []
        setTenants(safe)
        // First-login bootstrap: se não há tenant activo, escolhe default ou primeiro.
        // Também recovers se o tenant guardado já não estiver na lista actual.
        const stored = getActiveTenantId()
        const validStored = stored && safe.some((t) => t.id === stored)
        if (!validStored && safe.length > 0) {
          const def = safe.find((t) => t.isDefault) ?? safe[0]
          setActiveTenantId(def.id)
          setActiveTenantIdState(def.id)
        }
      })
      .catch((err) => {
        console.error('[useTenants] failed to load tenants', err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [session?.accessToken, status])

  const switchTenant = useCallback((tenantId: string) => {
    setActiveTenantId(tenantId)
    setActiveTenantIdState(tenantId)
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }, [])

  // Cross-tab sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === ACTIVE_TENANT_KEY) {
        setActiveTenantIdState(e.newValue)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const active = tenants.find((t) => t.id === activeTenantId) ?? null

  return { tenants, active, activeTenantId, loading, switchTenant }
}
