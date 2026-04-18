'use client'

import { useSession } from 'next-auth/react'
import { useCallback, useEffect, useState, useRef } from 'react'
import { api } from '@/lib/api'

/**
 * Generic API fetch hook. Returns the raw JSON from the API.
 * Most endpoints return { data: T } — the unwrap is done here automatically.
 * For paginated endpoints that return { data: { data: T[], total, nextCursor } },
 * use useApi<PaginatedResponse<T>> and access result.data for the array.
 */
export function useApi<T>(endpoint: string | null, deps: unknown[] = []) {
  const { data: session, status } = useSession()
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const depsRef = useRef(deps)
  depsRef.current = deps

  const fetchData = useCallback(async () => {
    if (!endpoint || status !== 'authenticated' || !session?.accessToken) {
      if (status === 'unauthenticated') setLoading(false)
      return
    }
    setLoading(true)
    try {
      const result = await api<Record<string, unknown>>(endpoint, { token: session.accessToken })
      if (result && typeof result === 'object' && 'data' in result) {
        setData(result.data as T)
      } else {
        setData(result as unknown as T)
      }
      setError(null)
    } catch (err: unknown) {
      // Log to console for diagnostics (browser DevTools)
      console.error(`[useApi] Failed to fetch ${endpoint}:`, err)
      const errorObj = err as { error?: string; code?: string; message?: string; status?: number }
      // If session expired (401), trigger re-login instead of showing error
      if (errorObj?.status === 401 || errorObj?.code === 'UNAUTHORIZED') {
        if (typeof window !== 'undefined') {
          const { signIn } = await import('next-auth/react')
          signIn()
          return
        }
      }
      const backendMsg = errorObj?.error || errorObj?.message
      // Include endpoint name to help identify which data failed
      const shortEndpoint = endpoint.split('?')[0]
      setError(backendMsg ? `${backendMsg} (${shortEndpoint})` : `Erro ao carregar ${shortEndpoint}`)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, session?.accessToken, status])

  useEffect(() => {
    fetchData()
  }, [fetchData, ...deps])

  return { data, loading, error, refetch: fetchData }
}

export interface MutationError {
  error: string
  code?: string
  status?: number
}

export function useMutation<TInput, TResult = unknown>(
  endpoint: string,
  method: string = 'POST',
) {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Executes the mutation. Returns the result on success, or null on failure.
   * IMPORTANT: also calls `onError` (if provided) with the full backend error
   * object so callers can branch on `code` without relying on stale state.
   */
  const mutate = async (
    body?: TInput,
    opts?: { onError?: (err: MutationError) => void },
  ): Promise<TResult | null> => {
    if (!session?.accessToken) return null
    setLoading(true)
    setError(null)
    try {
      const result = await api<Record<string, unknown>>(endpoint, {
        method,
        body: body ? JSON.stringify(body) : undefined,
        token: session.accessToken,
      })
      if (result && typeof result === 'object' && 'data' in result) {
        return result.data as TResult
      }
      return result as unknown as TResult
    } catch (err: unknown) {
      const errorObj = (err && typeof err === 'object' ? err : {}) as MutationError & {
        message?: string
      }
      const msg = errorObj.error || errorObj.message || 'Erro na operação'
      setError(msg)
      opts?.onError?.({ error: msg, code: errorObj.code, status: errorObj.status })
      return null
    } finally {
      setLoading(false)
    }
  }

  return { mutate, loading, error }
}
