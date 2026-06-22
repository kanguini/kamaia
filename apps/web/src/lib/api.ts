// ────────────────────────────────────────────────────────────────────────
// Kamaia CLM — Centralised API URL + fetch wrapper.
//
// All authenticated requests carry:
//   - Authorization: Bearer <jwt>   (from NextAuth session, passed in)
//   - X-Tenant-Id:  <tenantId>      (from localStorage `kamaia.activeTenantId`)
//
// `tenantId` is intentionally read from localStorage rather than the session
// because a user can have memberships in multiple tenants and we want the
// tenant switcher to take effect without a server round-trip.
// ────────────────────────────────────────────────────────────────────────

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

export const ACTIVE_TENANT_KEY = 'kamaia.activeTenantId'

export function getActiveTenantId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(ACTIVE_TENANT_KEY)
  } catch {
    return null
  }
}

export function setActiveTenantId(tenantId: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(ACTIVE_TENANT_KEY, tenantId)
  } catch {
    /* ignore */
  }
}

export function apiUrl(path: string): string {
  if (!path) return API_URL
  return path.startsWith('/') ? `${API_URL}${path}` : `${API_URL}/${path}`
}

export interface ApiOptions extends RequestInit {
  token?: string
  tenantId?: string | null
  /** Omit the X-Tenant-Id header (used for endpoints like /auth/* and /tenants). */
  noTenant?: boolean
}

export async function api<T>(
  endpoint: string,
  options: ApiOptions = {},
): Promise<T> {
  const { token, headers, tenantId, noTenant, ...rest } = options

  const resolvedTenant = noTenant ? null : tenantId ?? getActiveTenantId()

  const res = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(resolvedTenant ? { 'X-Tenant-Id': resolvedTenant } : {}),
      ...headers,
    },
    ...rest,
  })
  if (res.status === 204) return undefined as T

  if (res.status === 401 && typeof window !== 'undefined') {
    try {
      await fetch('/api/auth/session?update', { credentials: 'include' })
    } catch {
      /* ignore */
    }
  }

  let json: unknown
  try {
    json = await res.json()
  } catch {
    json = { error: `HTTP ${res.status}`, code: 'HTTP_ERROR' }
  }
  if (!res.ok) {
    if (res.status === 401) {
      const e = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>
      throw {
        ...e,
        code: e.code || 'UNAUTHORIZED',
        status: 401,
        error: e.error || 'Sessão expirada. Por favor reinicie sessão.',
      }
    }
    throw json
  }
  return json as T
}
