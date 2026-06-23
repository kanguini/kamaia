'use client'

import { useState, useEffect, useCallback } from 'react'

type Theme = 'light' | 'dark'

export function useTheme() {
  // Default = 'light' alinhado com o redesign Monolith Enterprise.
  const [theme, setThemeState] = useState<Theme>('light')

  useEffect(() => {
    const stored = localStorage.getItem('kamaia-theme') as Theme | null
    const initial = stored || 'light'
    setThemeState(initial)
    document.documentElement.classList.toggle('dark', initial === 'dark')
  }, [])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    localStorage.setItem('kamaia-theme', t)
    document.documentElement.classList.toggle('dark', t === 'dark')
  }, [])

  const toggle = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setTheme])

  return { theme, setTheme, toggle }
}
