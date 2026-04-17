'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Scale, Users, Clock, CheckSquare, Calendar, FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ProcessoFormModal } from '@/components/forms/processo-form-modal'

interface NewItem {
  label: string
  description: string
  icon: React.ElementType
  onSelect: () => void
}

export function NewDropdownButton() {
  const [open, setOpen] = useState(false)
  const [showProcessoModal, setShowProcessoModal] = useState(false)
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  // Close on ESC
  useEffect(() => {
    if (!open) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [open])

  const items: NewItem[] = [
    {
      label: 'Processo',
      description: 'Novo processo jurídico',
      icon: Scale,
      onSelect: () => {
        setOpen(false)
        setShowProcessoModal(true)
      },
    },
    {
      label: 'Cliente',
      description: 'Novo cliente ou empresa',
      icon: Users,
      onSelect: () => {
        setOpen(false)
        router.push('/clientes/novo')
      },
    },
    {
      label: 'Prazo',
      description: 'Novo prazo processual',
      icon: Clock,
      onSelect: () => {
        setOpen(false)
        router.push('/prazos/novo')
      },
    },
    {
      label: 'Tarefa',
      description: 'Nova tarefa no Kanban',
      icon: CheckSquare,
      onSelect: () => {
        setOpen(false)
        router.push('/tarefas')
      },
    },
    {
      label: 'Evento',
      description: 'Novo evento na agenda',
      icon: Calendar,
      onSelect: () => {
        setOpen(false)
        router.push('/agenda/novo')
      },
    },
    {
      label: 'Documento',
      description: 'Upload de documento',
      icon: FileText,
      onSelect: () => {
        setOpen(false)
        router.push('/documentos')
      },
    },
  ]

  return (
    <>
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-label="Criar novo"
          aria-expanded={open}
          aria-haspopup="menu"
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
            '[background:var(--color-btn-primary-bg)] [color:var(--color-btn-primary-text)] hover:[background:var(--color-btn-primary-hover)]',
          )}
        >
          <Plus className="w-4 h-4" />
          <span>Novo</span>
        </button>

        {open && (
          <div
            role="menu"
            className="absolute right-0 mt-2 w-[280px] bg-surface-raised border border-border rounded-lg shadow-xl z-50 overflow-hidden py-1.5"
          >
            <div className="px-3 py-2 border-b border-border">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Criar novo</p>
            </div>
            {items.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  onClick={item.onSelect}
                  className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-surface-hover transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-md bg-surface flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-ink-muted" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink">{item.label}</p>
                    <p className="text-xs text-ink-muted truncate">{item.description}</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <ProcessoFormModal
        open={showProcessoModal}
        onClose={() => setShowProcessoModal(false)}
        onSuccess={(processo) => {
          router.push(`/processos/${processo.id}`)
        }}
      />
    </>
  )
}
