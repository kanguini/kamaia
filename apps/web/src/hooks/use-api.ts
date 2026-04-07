'use client'

import { useSession } from 'next-auth/react'
import { useCallback, useEffect, useState, useRef } from 'react'
import { api } from '@/lib/api'

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
      const result = await api<{ data: T } | T>(endpoint, { token: session.accessToken })
      const unwrapped = (result && typeof result === 'object' && 'data' in result)
        ? (result as { data: T }).data
        : result as T
      setData(unwrapped)
      setError(null)
    } catch (err: unknown) {
      const errorObj = err as { error?: string }
      setError(errorObj?.error || 'Erro ao carregar dados')
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

export function useMutation<TInput, TResult = unknown>(
  endpoint: string,
  method: string = 'POST',
) {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mutate = async (body?: TInput): Promise<TResult | null> => {
    if (!session?.accessToken) return null
    setLoading(true)
    setError(null)
    try {
      const result = await api<{ data: TResult } | TResult>(endpoint, {
        method,
        body: body ? JSON.stringify(body) : undefined,
        token: session.accessToken,
      })
      const unwrapped = (result && typeof result === 'object' && 'data' in result)
        ? (result as { data: TResult }).data
        : result as TResult
      return unwrapped
    } catch (err: unknown) {
      const errorObj = err as { error?: string }
      setError(errorObj?.error || 'Erro na operacao')
      return null
    } finally {
      setLoading(false)
    }
  }

  return { mutate, loading, error }
}
