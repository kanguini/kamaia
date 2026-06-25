'use client'

/**
 * Wizard sequencial de assinatura — 4 steps.
 *
 * Sprint 3.3: UX prototype. O backend de "envio de pedido de
 * assinatura externa" ainda não existe (só temos GET de assinaturas
 * recebidas). Esta UI deixa a fundação visual pronta para quando
 * integrarmos um provider (DocuSign, Sign Now, ou o nosso próprio).
 *
 * Steps:
 *   1. Documento — escolhe versão a assinar (auto-pick mais recente)
 *   2. Signatários — selecciona partes + adiciona signers externos
 *   3. Posicionar campos — método por signer (email, SMS, presencial)
 *   4. Rever — confirma e "envia" (banner explicativo)
 *
 * Progress indicator no rodapé, navegação Voltar/Continuar.
 */

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import {
  FileText,
  Users,
  Settings as Cog,
  Check,
  AlertCircle,
} from 'lucide-react'
import { api } from '@/lib/api'
import { Drawer } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'

interface Versao {
  id: string
  versao: string
  direccao: string
  documentId: string | null
}
interface VersoesResponse {
  data: Versao[]
}

interface Parte {
  id: string
  papel: string
  entidade: { id: string; nome: string }
}
interface PartesResponse {
  data: Parte[]
}

type Metodo = 'EMAIL' | 'SMS' | 'PRESENCIAL'

interface Signer {
  id: string // local id (uuid-ish)
  parteId?: string
  nome: string
  email?: string
  telefone?: string
  metodo: Metodo
  ordem: number
}

const STEPS = [
  { key: 1, label: 'Documento', icon: FileText },
  { key: 2, label: 'Signatários', icon: Users },
  { key: 3, label: 'Configurar', icon: Cog },
  { key: 4, label: 'Rever', icon: Check },
] as const

export function AssinarWizard({
  open,
  onClose,
  contratoId,
}: {
  open: boolean
  onClose: () => void
  contratoId: string
}) {
  const { data: session } = useSession()
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [versoes, setVersoes] = useState<Versao[]>([])
  const [versaoId, setVersaoId] = useState<string | null>(null)
  const [partes, setPartes] = useState<Parte[]>([])
  const [signers, setSigners] = useState<Signer[]>([])

  // Carrega versões e partes ao abrir
  useEffect(() => {
    if (!open || !session?.accessToken) return
    setStep(1)
    Promise.all([
      api<VersoesResponse>(`/contratos/${contratoId}/versoes`, {
        token: session.accessToken,
      }).catch(() => ({ data: [] })),
      api<PartesResponse>(`/contratos/${contratoId}/partes`, {
        token: session.accessToken,
      }).catch(() => ({ data: [] })),
    ]).then(([v, p]) => {
      setVersoes(v.data ?? [])
      // Auto-pick a versão mais recente com documento
      const withDoc = (v.data ?? []).find((x) => x.documentId)
      if (withDoc) setVersaoId(withDoc.id)
      setPartes(p.data ?? [])
      // Pré-popula signers com as partes existentes
      setSigners(
        (p.data ?? []).map((part, i) => ({
          id: `s-${part.id}`,
          parteId: part.id,
          nome: part.entidade.nome,
          metodo: 'EMAIL' as Metodo,
          ordem: i + 1,
        })),
      )
    })
  }, [open, contratoId, session?.accessToken])

  const next = () => setStep((s) => (s < 4 ? ((s + 1) as 1 | 2 | 3 | 4) : s))
  const back = () => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4) : s))

  const canProceed = () => {
    if (step === 1) return !!versaoId
    if (step === 2) {
      // Onda B.COST.18: validar nome.trim() — addCustomSigner cria
      // entrada com nome vazio que antes passava o step.
      return (
        signers.length >= 1 && signers.every((s) => s.nome.trim().length > 0)
      )
    }
    if (step === 3)
      return signers.every((s) => {
        if (s.metodo === 'EMAIL') return !!s.email
        if (s.metodo === 'SMS') return !!s.telefone
        return true
      })
    return true
  }

  const updateSigner = (id: string, patch: Partial<Signer>) =>
    setSigners((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    )
  const removeSigner = (id: string) =>
    setSigners((prev) => prev.filter((s) => s.id !== id))
  const addCustomSigner = () =>
    setSigners((prev) => [
      ...prev,
      {
        // Onda B.COST.18: usar UUID em vez de length-based id.
        // Antes: `s-custom-${prev.length}-${prev.length+1}` colidia
        // após cycles de add/remove (add@2 → "s-custom-2-3", remove,
        // add@2 → mesmo id). React keys colidiam, valores dos
        // inputs bleed entre rows.
        id:
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? `s-custom-${crypto.randomUUID()}`
            : `s-custom-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        nome: '',
        metodo: 'EMAIL',
        ordem: prev.length + 1,
      },
    ])

  return (
    <Drawer open={open} onClose={onClose} width={720}>
      <div className="aw">
        <header className="aw-head">
          <h2 className="aw-title">Pedir assinatura</h2>
          <button
            type="button"
            onClick={onClose}
            className="aw-close"
            aria-label="Fechar"
          >
            ×
          </button>
        </header>

        <div className="aw-body">
          {step === 1 && (
            <StepDocumento
              versoes={versoes}
              versaoId={versaoId}
              onSelect={setVersaoId}
            />
          )}
          {step === 2 && (
            <StepSignatarios
              signers={signers}
              partes={partes}
              onAddCustom={addCustomSigner}
              onRemove={removeSigner}
              onUpdate={updateSigner}
            />
          )}
          {step === 3 && (
            <StepConfigurar signers={signers} onUpdate={updateSigner} />
          )}
          {step === 4 && (
            <StepRever
              signers={signers}
              versao={versoes.find((v) => v.id === versaoId) ?? null}
            />
          )}
        </div>

        <footer className="aw-foot">
          <ProgressBar current={step} />
          <div className="aw-foot-actions">
            <Button
              variant="secondary"
              type="button"
              onClick={step === 1 ? onClose : back}
            >
              {step === 1 ? 'Cancelar' : 'Voltar'}
            </Button>
            {step < 4 ? (
              <Button type="button" onClick={next} disabled={!canProceed()}>
                Continuar
              </Button>
            ) : (
              <Button type="button" disabled title="Backend de envio pendente">
                Enviar pedidos
              </Button>
            )}
          </div>
        </footer>
      </div>

      <style jsx>{`
        .aw {
          display: flex;
          flex-direction: column;
          height: 100%;
        }
        .aw-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid var(--k2-border);
        }
        .aw-title {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: var(--k2-text);
        }
        .aw-close {
          background: transparent;
          border: none;
          color: var(--k2-text-mute);
          font-size: 18px;
          cursor: pointer;
          padding: 4px 8px;
          line-height: 1;
        }
        .aw-close:hover {
          color: var(--k2-text);
        }
        .aw-body {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
        }
        .aw-foot {
          border-top: 1px solid var(--k2-border);
          padding: 12px 20px 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .aw-foot-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }
      `}</style>
    </Drawer>
  )
}

// ─── Steps ───────────────────────────────────────────────────────

function StepDocumento({
  versoes,
  versaoId,
  onSelect,
}: {
  versoes: Versao[]
  versaoId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div className="step">
      <h3 className="step-h3">Que versão vais enviar para assinatura?</h3>
      <p className="step-sub">
        Escolhe a versão final do contrato. Os signatários receberão um link
        para o documento desta versão.
      </p>
      <div className="versoes">
        {versoes.length === 0 && (
          <Empty hint="Este contrato ainda não tem versões com documento. Anexa um PDF/Word primeiro na tab Documentos." />
        )}
        {versoes.map((v) => {
          const selected = v.id === versaoId
          const usable = !!v.documentId
          return (
            <button
              key={v.id}
              type="button"
              disabled={!usable}
              onClick={() => onSelect(v.id)}
              className={`versao ${selected ? 'selected' : ''} ${!usable ? 'disabled' : ''}`}
            >
              <FileText size={16} />
              <div className="versao-text">
                <div className="versao-versao">{v.versao}</div>
                <div className="versao-direccao">
                  {v.direccao}
                  {!usable && ' · sem documento anexo'}
                </div>
              </div>
              {selected && <Check size={14} className="versao-check" />}
            </button>
          )
        })}
      </div>
      <style jsx>{`
        .step { display: flex; flex-direction: column; gap: 14px; }
        .step-h3 { margin: 0; font-size: 15px; font-weight: 500; color: var(--k2-text); }
        .step-sub { margin: 0; font-size: 12px; color: var(--k2-text-mute); line-height: 1.5; }
        .versoes { display: flex; flex-direction: column; gap: 6px; }
        .versao { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: var(--k2-bg-elev); border: 1px solid var(--k2-border); border-radius: var(--k2-radius-sm); color: var(--k2-text); font-family: inherit; font-size: 13px; cursor: pointer; text-align: left; transition: border-color 120ms ease, background 120ms ease; }
        .versao:hover:not(.disabled) { background: var(--k2-bg-hover); border-color: var(--k2-border-strong); }
        .versao.selected { border-color: var(--k2-text); background: var(--k2-bg-elev-2); }
        .versao.disabled { opacity: 0.5; cursor: not-allowed; }
        .versao-text { flex: 1; }
        .versao-versao { font-weight: 500; }
        .versao-direccao { font-size: 11px; color: var(--k2-text-mute); margin-top: 1px; }
        .versao-check { color: var(--k2-text); }
      `}</style>
    </div>
  )
}

function StepSignatarios({
  signers,
  partes,
  onAddCustom,
  onRemove,
  onUpdate,
}: {
  signers: Signer[]
  partes: Parte[]
  onAddCustom: () => void
  onRemove: (id: string) => void
  onUpdate: (id: string, patch: Partial<Signer>) => void
}) {
  return (
    <div className="step">
      <h3 className="step-h3">Quem precisa de assinar?</h3>
      <p className="step-sub">
        Pré-carregámos as partes do contrato. Adiciona signers extra
        (testemunhas, representantes legais) com o botão abaixo.
      </p>
      <div className="signers">
        {signers.map((s, i) => (
          <div key={s.id} className="signer">
            <div className="signer-ord">{i + 1}</div>
            <Input
              value={s.nome}
              onChange={(e) => onUpdate(s.id, { nome: e.target.value })}
              placeholder="Nome do signatário"
              style={{ flex: 1 }}
            />
            <button
              type="button"
              onClick={() => onRemove(s.id)}
              className="signer-del"
              aria-label="Remover"
            >
              ×
            </button>
          </div>
        ))}
        {partes.length === 0 && signers.length === 0 && (
          <Empty hint="Este contrato não tem partes. Adiciona partes na tab Resumo primeiro." />
        )}
      </div>
      <Button
        type="button"
        variant="secondary"
        onClick={onAddCustom}
        style={{ alignSelf: 'flex-start' }}
      >
        + Adicionar signer
      </Button>
      <style jsx>{`
        .step { display: flex; flex-direction: column; gap: 14px; }
        .step-h3 { margin: 0; font-size: 15px; font-weight: 500; color: var(--k2-text); }
        .step-sub { margin: 0; font-size: 12px; color: var(--k2-text-mute); line-height: 1.5; }
        .signers { display: flex; flex-direction: column; gap: 6px; }
        .signer { display: flex; align-items: center; gap: 8px; }
        .signer-ord { display: inline-grid; place-items: center; width: 24px; height: 24px; background: var(--k2-bg-elev-2); border-radius: 50%; font-size: 11px; color: var(--k2-text-dim); flex-shrink: 0; }
        .signer-del { background: transparent; border: none; color: var(--k2-text-mute); font-size: 16px; cursor: pointer; padding: 4px 8px; }
        .signer-del:hover { color: var(--k2-bad); }
      `}</style>
    </div>
  )
}

function StepConfigurar({
  signers,
  onUpdate,
}: {
  signers: Signer[]
  onUpdate: (id: string, patch: Partial<Signer>) => void
}) {
  return (
    <div className="step">
      <h3 className="step-h3">Como vais notificar cada signer?</h3>
      <p className="step-sub">
        Email é o método mais comum. Para signers offline, escolhe SMS ou
        presencial (assinatura no escritório).
      </p>
      <div className="signers">
        {signers.map((s, i) => (
          <div key={s.id} className="signer-config">
            <div className="signer-row">
              <div className="signer-ord">{i + 1}</div>
              <div className="signer-name">{s.nome || '(sem nome)'}</div>
              <Select
                value={s.metodo}
                onChange={(e) => onUpdate(s.id, { metodo: e.target.value as Metodo })}
                style={{ width: 130 }}
              >
                <option value="EMAIL">Email</option>
                <option value="SMS">SMS</option>
                <option value="PRESENCIAL">Presencial</option>
              </Select>
            </div>
            {s.metodo === 'EMAIL' && (
              <Input
                type="email"
                value={s.email ?? ''}
                onChange={(e) => onUpdate(s.id, { email: e.target.value })}
                placeholder="email@exemplo.com"
              />
            )}
            {s.metodo === 'SMS' && (
              <Input
                type="tel"
                value={s.telefone ?? ''}
                onChange={(e) => onUpdate(s.id, { telefone: e.target.value })}
                placeholder="+244 9XX XXX XXX"
              />
            )}
            {s.metodo === 'PRESENCIAL' && (
              <div className="signer-presencial">
                Signer assinará presencialmente. Não é enviada notificação.
              </div>
            )}
          </div>
        ))}
      </div>
      <style jsx>{`
        .step { display: flex; flex-direction: column; gap: 14px; }
        .step-h3 { margin: 0; font-size: 15px; font-weight: 500; color: var(--k2-text); }
        .step-sub { margin: 0; font-size: 12px; color: var(--k2-text-mute); line-height: 1.5; }
        .signers { display: flex; flex-direction: column; gap: 14px; }
        .signer-config { display: flex; flex-direction: column; gap: 6px; padding: 12px; background: var(--k2-bg-elev); border: 1px solid var(--k2-border); border-radius: var(--k2-radius-sm); }
        .signer-row { display: flex; align-items: center; gap: 8px; }
        .signer-ord { display: inline-grid; place-items: center; width: 24px; height: 24px; background: var(--k2-bg-elev-2); border-radius: 50%; font-size: 11px; color: var(--k2-text-dim); flex-shrink: 0; }
        .signer-name { flex: 1; font-size: 13px; font-weight: 500; color: var(--k2-text); }
        .signer-presencial { font-size: 11px; color: var(--k2-text-mute); padding: 6px 10px; background: var(--k2-bg); border-radius: var(--k2-radius-sm); font-style: italic; }
      `}</style>
    </div>
  )
}

function StepRever({
  signers,
  versao,
}: {
  signers: Signer[]
  versao: Versao | null
}) {
  return (
    <div className="step">
      <h3 className="step-h3">Confirma e envia</h3>
      <p className="step-sub">Verifica os detalhes antes de enviar.</p>

      <div className="banner">
        <AlertCircle size={14} />
        <div>
          <strong>UX prototype.</strong> O envio real depende da integração
          com provider de eSign. O botão Enviar está desactivado por agora.
        </div>
      </div>

      <div className="summary">
        <div className="summary-row">
          <span className="summary-label">Documento</span>
          <span className="summary-value">{versao?.versao ?? '—'}</span>
        </div>
        <div className="summary-row">
          <span className="summary-label">Signers</span>
          <span className="summary-value">{signers.length}</span>
        </div>
        <div className="summary-list">
          {signers.map((s, i) => (
            <div key={s.id} className="summary-signer">
              <span className="summary-signer-ord">{i + 1}.</span>
              <span className="summary-signer-name">{s.nome}</span>
              <span className="summary-signer-method">
                via {prettyMetodo(s.metodo)}
                {s.email && ` · ${s.email}`}
                {s.telefone && ` · ${s.telefone}`}
              </span>
            </div>
          ))}
        </div>
      </div>
      <style jsx>{`
        .step { display: flex; flex-direction: column; gap: 14px; }
        .step-h3 { margin: 0; font-size: 15px; font-weight: 500; color: var(--k2-text); }
        .step-sub { margin: 0; font-size: 12px; color: var(--k2-text-mute); line-height: 1.5; }
        .banner { display: flex; gap: 8px; padding: 10px 12px; background: var(--k2-bg-elev); border: 1px dashed var(--k2-warn); border-radius: var(--k2-radius-sm); font-size: 12px; color: var(--k2-text-dim); line-height: 1.5; }
        .banner :global(svg) { color: var(--k2-warn); margin-top: 2px; flex-shrink: 0; }
        .summary { display: flex; flex-direction: column; gap: 8px; padding: 14px; background: var(--k2-bg-elev); border: 1px solid var(--k2-border); border-radius: var(--k2-radius-sm); }
        .summary-row { display: flex; justify-content: space-between; font-size: 12px; }
        .summary-label { color: var(--k2-text-mute); }
        .summary-value { color: var(--k2-text); font-weight: 500; }
        .summary-list { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--k2-border); }
        .summary-signer { display: flex; gap: 6px; font-size: 12px; align-items: baseline; }
        .summary-signer-ord { color: var(--k2-text-mute); }
        .summary-signer-name { color: var(--k2-text); font-weight: 500; }
        .summary-signer-method { color: var(--k2-text-mute); font-size: 11px; }
      `}</style>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────

function ProgressBar({ current }: { current: number }) {
  return (
    <div className="pb">
      {STEPS.map((s) => {
        const done = s.key < current
        const active = s.key === current
        return (
          <div
            key={s.key}
            className={`pb-step ${done ? 'done' : ''} ${active ? 'active' : ''}`}
          >
            <div className="pb-dot">
              {done ? <Check size={10} /> : <s.icon size={10} />}
            </div>
            <span className="pb-label">{s.label}</span>
          </div>
        )
      })}
      <style jsx>{`
        .pb {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .pb-step {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: var(--k2-text-mute);
          font-size: 10px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          font-weight: 500;
        }
        .pb-step.done,
        .pb-step.active {
          color: var(--k2-text);
        }
        .pb-dot {
          display: inline-grid;
          place-items: center;
          width: 18px;
          height: 18px;
          background: var(--k2-bg-elev-2);
          border: 1px solid var(--k2-border);
          border-radius: 50%;
        }
        .pb-step.done .pb-dot,
        .pb-step.active .pb-dot {
          background: var(--k2-text);
          color: var(--k2-accent-fg);
          border-color: var(--k2-text);
        }
      `}</style>
    </div>
  )
}

function Empty({ hint }: { hint: string }) {
  return <div className="emp">{hint}<style jsx>{`.emp { font-size: 12px; color: var(--k2-text-mute); padding: 16px; background: var(--k2-bg-elev); border: 1px dashed var(--k2-border); border-radius: var(--k2-radius-sm); line-height: 1.5; }`}</style></div>
}

function prettyMetodo(m: Metodo): string {
  if (m === 'EMAIL') return 'email'
  if (m === 'SMS') return 'SMS'
  return 'presencial'
}

