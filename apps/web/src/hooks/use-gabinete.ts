'use client'

import { useSession } from 'next-auth/react'

export function useGabinete() {
  const { data: session, status } = useSession()

  return {
    gabineteId: session?.gabineteId,
    role: session?.role,
    user: session?.user,
    isLoading: status === 'loading',
    isAuthenticated: status === 'authenticated',
  }
}
