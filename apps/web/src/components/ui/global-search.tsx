'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Search, Scale, Users, Clock, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'

interface SearchResult {
  type: 'processo' | 'cliente' | 'prazo'
  id: string
  title: string
  subtitle?: string
  href: string
}

export function GlobalSearch() {
  const router = useRouter()
  const { data: session } = useSession()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Keyboard shortcut: Cmd/Ctrl+K to focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setFocused(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  // Debounced search
  const performSearch = useCallback(async (q: string) => {
    if (!q.trim() || !session?.accessToken) {
      setResults([])
      return
    }

    setLoading(true)
    try {
      const [processosRes, clientesRes, prazosRes] = await Promise.all([
        api<{ data: { data: any[] } }>(`/processos?search=${encodeURIComponent(q)}&limit=5`, {
          token: session.accessToken,
        }).catch(() => ({ data: { data: [] } })),
        api<{ data: { data: any[] } }>(`/clientes?search=${encodeURIComponent(q)}&limit=5`, {
          token: session.accessToken,
        }).catch(() => ({ data: { data: [] } })),
        api<{ data: any[] }>(`/prazos?search=${encodeURIComponent(q)}&limit=5`, {
          token: session.accessToken,
        }).catch(() => ({ data: [] })),
      ])

      const processos: SearchResult[] = (processosRes.data?.data || []).slice(0, 5).map((p: any) => ({
        type: 'processo' as const,
        id: p.id,
        title: p.title,
        subtitle: `${p.processoNumber} · ${p.cliente?.name || ''}`,
        href: `/processos/${p.id}`,
      }))

      const clientes: SearchResult[] = (clientesRes.data?.data || []).slice(0, 5).map((c: any) => ({
        type: 'cliente' as const,
        id: c.id,
        title: c.name,
        subtitle: c.nif || c.email || '',
        href: `/clientes/${c.id}`,
      }))

      const prazos: SearchResult[] = (Array.isArray(prazosRes.data) ? prazosRes.data : []).slice(0, 5).map((p: any) => ({
        type: 'prazo' as const,
        id: p.id,
        title: p.title,
        subtitle: p.processo?.title || p.type || '',
        href: `/prazos/${p.id}`,
      }))

      setResults([...processos, ...clientes, ...prazos])
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [session?.accessToken])

  // Debounce input changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setResults([])
      return
    }
    debounceRef.current = setTimeout(() => performSearch(query), 250)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, performSearch])

  // Open when query is present and focused
  useEffect(() => {
    setOpen(focused && query.length > 0)
    setHighlightedIndex(-1)
  }, [focused, query])

  const handleSelect = (result: SearchResult) => {
    router.push(result.href)
    setQuery('')
    setOpen(false)
    setFocused(false)
    inputRef.current?.blur()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
      return
    }
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev <= 0 ? results.length - 1 : prev - 1))
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault()
      handleSelect(results[highlightedIndex])
    }
  }

  const iconFor = (type: SearchResult['type']) => {
    if (type === 'processo') return Scale
    if (type === 'cliente') return Users
    return Clock
  }

  const labelFor = (type: SearchResult['type']) => {
    if (type === 'processo') return 'Processo'
    if (type === 'cliente') return 'Cliente'
    return 'Prazo'
  }

  return (
    <div ref={containerRef} className="relative flex-1 max-w-[480px]">
      <div className={cn(
        'flex items-center gap-2 rounded-lg border transition-colors',
        focused ? 'border-ink/30 bg-surface-raised' : 'border-border bg-transparent',
      )}>
        <Search className="w-4 h-4 text-ink-muted ml-3 flex-shrink-0" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder="Pesquisar processos, clientes, prazos..."
          className="flex-1 bg-transparent border-0 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none"
          style={{ borderRadius: 0 }}
        />
        {loading && <Loader2 className="w-4 h-4 text-ink-muted animate-spin mr-2" />}
        {query && !loading && (
          <button
            type="button"
            onClick={() => { setQuery(''); inputRef.current?.focus() }}
            aria-label="Limpar pesquisa"
            className="p-1 mr-1 rounded-md text-ink-muted hover:text-ink hover:bg-surface-hover"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        {!focused && !query && (
          <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 mr-2 text-[10px] font-mono text-ink-muted bg-surface-raised rounded border border-border">
            ⌘K
          </kbd>
        )}
      </div>

      {open && (
        <div
          role="listbox"
          className="absolute top-full mt-2 left-0 right-0 bg-surface-raised border border-border rounded-lg shadow-xl z-50 overflow-hidden max-h-[420px] overflow-y-auto"
        >
          {loading && results.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-ink-muted">A pesquisar...</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-ink-muted">Sem resultados para &quot;{query}&quot;</div>
          ) : (
            <>
              {results.map((r, i) => {
                const Icon = iconFor(r.type)
                return (
                  <button
                    key={`${r.type}-${r.id}`}
                    type="button"
                    role="option"
                    aria-selected={highlightedIndex === i}
                    onClick={() => handleSelect(r)}
                    onMouseEnter={() => setHighlightedIndex(i)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
                      highlightedIndex === i ? 'bg-surface-hover' : '',
                    )}
                  >
                    <div className="w-8 h-8 rounded-md bg-surface flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-ink-muted" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{r.title}</p>
                      {r.subtitle && (
                        <p className="text-xs text-ink-muted truncate">{r.subtitle}</p>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-ink-muted/60 uppercase tracking-wide flex-shrink-0">
                      {labelFor(r.type)}
                    </span>
                  </button>
                )
              })}
            </>
          )}
        </div>
      )}
    </div>
  )
}
