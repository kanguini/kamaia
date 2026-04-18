const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

export async function api<T>(
  endpoint: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, headers, ...rest } = options
  const res = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...rest,
  })
  if (res.status === 204) return undefined as T

  // Handle 401: token expired / invalid — signal NextAuth to reauth.
  // We don't force a hard redirect here (lets component handle gracefully),
  // but we attach a flag so the UI can trigger signOut if needed.
  if (res.status === 401 && typeof window !== 'undefined') {
    // Fire-and-forget: trigger a silent session refresh by reloading the session
    // The next /api/auth/session call in NextAuth will re-run the jwt callback
    // and attempt refresh automatically. If that fails, the user stays logged out.
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
    // Normalize auth errors with a stable code so callers can react
    if (res.status === 401) {
      const e = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>
      throw { ...e, code: e.code || 'UNAUTHORIZED', status: 401, error: e.error || 'Sessão expirada. Por favor reinicie sessão.' }
    }
    throw json
  }
  return json as T
}
