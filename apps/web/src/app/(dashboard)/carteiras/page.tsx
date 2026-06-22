'use client'

/**
 * Kamaia CLM — Carteiras list.
 * Carteiras agrupam contratos por deal/projecto/imóvel.
 */

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { useApi, useMutation } from '@/hooks/use-api'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Drawer, DrawerHeader, DrawerBody, DrawerFooter } from '@/components/ui/drawer'
import type { PaginatedResponse } from '@kamaia/shared-types'

interface Carteira {
  id: string
  nome: string
  descricao: string | null
  contratosCount: number
}

export default function CarteirasPage() {
  const { data, loading, refetch } = useApi<PaginatedResponse<Carteira>>('/carteiras?limit=100')
  const [showCreate, setShowCreate] = useState(false)
  const carteiras = data?.data ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 500, margin: 0 }}>Carteiras</h1>
          <p style={{ marginTop: 4, color: 'var(--k2-text-dim)', fontSize: 13 }}>
            Containers opcionais para agrupar contratos relacionados.
          </p>
        </div>
        <Button leftIcon={<Plus size={14} />} onClick={() => setShowCreate(true)}>Nova carteira</Button>
      </header>

      {loading ? (
        <div style={{ color: 'var(--k2-text-mute)' }}>A carregar…</div>
      ) : carteiras.length === 0 ? (
        <div style={{ color: 'var(--k2-text-mute)' }}>Ainda não tens carteiras.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {carteiras.map((c) => (
            <Link
              key={c.id}
              href={`/contratos?carteiraId=${c.id}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                padding: 14,
                background: 'var(--k2-bg-elev)',
                border: '1px solid var(--k2-border)',
                borderRadius: 'var(--k2-radius)',
                textDecoration: 'none',
                color: 'var(--k2-text)',
              }}
            >
              <div style={{ fontWeight: 500 }}>{c.nome}</div>
              {c.descricao && <div style={{ fontSize: 12, color: 'var(--k2-text-dim)' }}>{c.descricao}</div>}
              <div style={{ fontSize: 11, color: 'var(--k2-text-mute)', marginTop: 6 }}>
                {c.contratosCount.toLocaleString('pt-AO')} contrato(s)
              </div>
            </Link>
          ))}
        </div>
      )}

      <CreateDrawer
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          setShowCreate(false)
          refetch()
        }}
      />
    </div>
  )
}

/**
 * Slide-over para criar carteira.
 * Padrão consistente com o resto da app (decisão UX: formulários slide-over).
 */
function CreateDrawer({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const { mutate, loading, error } = useMutation('/carteiras', 'POST')

  useEffect(() => {
    if (!open) {
      setNome('')
      setDescricao('')
    }
  }, [open])

  const submit = async () => {
    const r = await mutate({ nome, descricao: descricao || undefined })
    if (r) onCreated()
  }

  return (
    <Drawer open={open} onClose={onClose} width={520}>
      <DrawerHeader
        title="Nova carteira"
        subtitle="Container para agrupar contratos por deal, projecto ou imóvel."
        onClose={onClose}
      />
      <DrawerBody>
        {error && (
          <div style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', padding: '10px 14px', borderRadius: 'var(--k2-radius-sm)', fontSize: 13 }}>
            {error}
          </div>
        )}
        <form
          id="nova-carteira-form"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
          style={{ display: 'grid', gap: 14 }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--k2-text-dim)' }}>
            Nome
            <Input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus placeholder="Ex.: Projecto Talatona" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--k2-text-dim)' }}>
            Descrição
            <Textarea rows={4} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Resumo do âmbito da carteira (opcional)." />
          </label>
        </form>
      </DrawerBody>
      <DrawerFooter>
        <div style={{ flex: 1 }} />
        <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
        <Button type="submit" form="nova-carteira-form" loading={loading}>Criar</Button>
      </DrawerFooter>
    </Drawer>
  )
}
