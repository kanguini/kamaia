'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ProcessoFormModal } from '@/components/forms/processo-form-modal'

interface NewItem {
  label: string
  description: string
  onSelect: () => void
}

export function NewDropdownButton() {
  const [open, setOpen] = useState(false)
  const [showProcessoModal, setShowProcessoModal] = useState(false)
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)

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
      onSelect: () => {
        setOpen(false)
        setShowProcessoModal(true)
      },
    },
    {
      label: 'Cliente',
      description: 'Novo cliente ou empresa',
      onSelect: () => {
        setOpen(false)
        router.push('/clientes/novo')
      },
    },
    {
      label: 'Prazo',
      description: 'Novo prazo processual',
      onSelect: () => {
        setOpen(false)
        router.push('/prazos/novo')
      },
    },
    {
      label: 'Tarefa',
      description: 'Nova tarefa no Kanban',
      onSelect: () => {
        setOpen(false)
        router.push('/tarefas')
      },
    },
    {
      label: 'Evento',
      description: 'Novo evento na agenda',
      onSelect: () => {
        setOpen(false)
        router.push('/agenda/novo')
      },
    },
    {
      label: 'Documento',
      description: 'Upload de documento',
      onSelect: () => {
        setOpen(false)
        router.push('/documentos')
      },
    },
    {
      label: 'Factura',
      description: 'Emitir factura ao cliente',
      onSelect: () => {
        setOpen(false)
        router.push('/facturas/nova')
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
            'border border-border bg-transparent text-ink hover:bg-surface-raised',
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
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={item.onSelect}
                className="w-full flex flex-col px-3 py-2 hover:bg-surface-hover transition-colors text-left"
              >
                <p className="text-sm font-medium text-ink">{item.label}</p>
                <p className="text-xs text-ink-muted">{item.description}</p>
              </button>
            ))}
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
