'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

type Theme = 'dark' | 'light'
const STORAGE_KEY = 'kamaia-site-theme'

/**
 * Dark (default) / light toggle. Persists in localStorage, hydrates without
 * a flash by reading the class before the first paint (done inline by
 * layout.tsx <script>).
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? 'dark'
    setTheme(saved)
    setMounted(true)
  }, [])

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem(STORAGE_KEY, next)
    const root = document.documentElement
    if (next === 'light') root.classList.add('light')
    else root.classList.remove('light')
  }

  if (!mounted) {
    return (
      <span
        className="inline-block h-8 w-8"
        aria-hidden="true"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Activar modo claro' : 'Activar modo escuro'}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-transparent text-white/70 transition-colors hover:border-white/20 hover:text-white"
    >
      {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
    </button>
  )
}
