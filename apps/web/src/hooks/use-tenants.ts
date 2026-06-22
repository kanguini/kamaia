'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { api, ACTIVE_TENANT_KEY, getActiveTenantId, setActiveTenantId } from '@/lib/api'
import type { Role, TenantPlan } from '@kamaia/shared-types'

export interface TenantMembership {
  tenantId: string
  tenantName: string
  role: Role
  plan: TenantPlan
  parentTenantId: string | null
  isDefault?: boolean
}

interface TenantsResponse {
  data: TenantMembership[]
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
    api<TenantsResponse>('/tenants', {
      token: session.accessToken,
      noTenant: true,
    })
      .then((res) => {
        if (cancelled) return
        const list = res.data ?? []
        setTenants(list)
        // First-login bootstrap: if no active tenant set, pick default or first.
        if (!getActiveTenantId() && list.length > 0) {
          const def = list.find((t) => t.isDefault) ?? list[0]
          setActiveTenantId(def.tenantId)
          setActiveTenantIdState(def.tenantId)
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
      // Force a reload so every cached fetch refreshes under the new tenant.
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

  const active = tenants.find((t) => t.tenantId === activeTenantId) ?? null

  return { tenants, active, activeTenantId, loading, switchTenant }
}
