'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'kamaia-sidebar-collapsed'

/**
 * Hook to manage sidebar collapsed state with localStorage persistence.
 * Desktop only — mobile uses hamburger menu instead.
 */
export function useSidebarState() {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'true') setIsCollapsed(true)
    } catch {
      // localStorage unavailable
    }
    setIsHydrated(true)
  }, [])

  const toggle = () => {
    setIsCollapsed((prev) => {
      const next = !prev
      try { localStorage.setItem(STORAGE_KEY, String(next)) } catch {}
      return next
    })
  }

  return { isCollapsed, toggle, isHydrated }
}
