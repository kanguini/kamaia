'use client'

/**
 * EvolucaoTimeline — passado → presente → futuro numa única vista.
 *
 * Onde o Contracko (e a v2 clone) têm uma "tab Eventos" com lista de
 * coisas passadas, o Kamaia mostra a EVOLUÇÃO do contrato: o que
 * aconteceu, onde está agora, e o que está previsto — tudo na mesma
 * linha temporal. O futuro previsto (termo, renovação, próximos
 * pagamentos) é tão importante como o histórico.
 *
 * Fontes:
 *   - Eventos (timeline append-only) → passado
 *   - Estado actual → presente (marcador "hoje")
 *   - Datas-chave futuras + obrigações → futuro previsto
 */

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { api } from '@/lib/api'
import { unwrapList } from '@/lib/list'

interface EventoRow {
  id: string
  tipo: string
  resumo: string | null
  createdAt: string
}
interface DataChaveRow {
  id: string
  tipo: string
  data: string
  cumprida: boolean
}
interface ObrigacaoRow {
  id: string
  descricao: string
  proximaData: string | null
}

interface TLPonto {
  id: string
  quando: Date
  label: string
  tempo: 'passado' | 'hoje' | 'futuro'
  tipo: 'evento' | 'data' | 'obrigacao' | 'agora'
}

function fmtDataCurta(d: Date): string {
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })
}

function prettyDataChave(t: string): string {
  const map: Record<string, string> = {
    TERMO: 'Termo do contrato',
    RENOVACAO_AUTOMATICA: 'Renovação automática',
    JANELA_DENUNCIA_INICIO: 'Abre janela de denúncia',
    JANELA_DENUNCIA_FIM: 'Fecha janela de denúncia',
    PAGAMENTO: 'Pagamento',
    ASSINATURA: 'Assinatura',
    INICIO_VIGENCIA: 'Início de vigência',
    REVISAO_PRECO: 'Revisão de preço',
    MILESTONE: 'Milestone',
    GARANTIA_VALIDADE: 'Validade de garantia',
    SEGURO_VALIDADE: 'Validade de seguro',
    ENTREGA: 'Entrega',
    OUTRO: 'Evento',
  }
  return map[t] ?? t
}

function prettyEvento(t: string): string {
  const map: Record<string, string> = {
    CRIADO: 'Contrato registado no sistema',
    ESTADO_ALTERADO: 'Mudança de estado',
    VERSAO_CRIADA: 'Nova versão',
    PARTE_ADICIONADA: 'Parte adicionada',
    ACTO_DETECTADO: 'Acto regulatório detectado',
    COMENTARIO: 'Comentário',
    ASSINATURA: 'Assinatura',
    RENOVADO: 'Renovado',
    DENUNCIADO: 'Denunciado',
  }
  return map[t] ?? t.replaceAll('_', ' ').toLowerCase()
}

export function EvolucaoTimeline({ contratoId }: { contratoId: string }) {
  const { data: session } = useSession()
  const [eventos, setEventos] = useState<EventoRow[] | null>(null)
  const [datas, setDatas] = useState<DataChaveRow[]>([])
  const [obrigacoes, setObrigacoes] = useState<ObrigacaoRow[]>([])

  useEffect(() => {
    if (!session?.accessToken) return
    let cancelled = false
    const token = session.accessToken
    // Estes 3 endpoints devolvem ARRAY directo (não { data: [] }).
    // unwrapList aceita ambas as formas defensivamente — evita o bug
    // silencioso de "tudo vazio" quando se assume a forma errada.
    Promise.all([
      api<unknown>(`/contratos/${contratoId}/eventos`, { token }).catch(() => []),
      api<unknown>(`/contratos/${contratoId}/datas-chave`, { token }).catch(() => []),
      api<unknown>(`/contratos/${contratoId}/obrigacoes`, { token }).catch(() => []),
    ]).then(([e, d, o]) => {
      if (cancelled) return
      setEventos(unwrapList<EventoRow>(e))
      setDatas(unwrapList<DataChaveRow>(d))
      setObrigacoes(unwrapList<ObrigacaoRow>(o))
    })
    return () => {
      cancelled = true
    }
  }, [contratoId, session?.accessToken])

  const pontos = useMemo<TLPonto[]>(() => {
    if (eventos === null) return []
    const now = new Date()
    const out: TLPonto[] = []

    for (const ev of eventos) {
      out.push({
        id: `e-${ev.id}`,
        quando: new Date(ev.createdAt),
        label: ev.resumo || prettyEvento(ev.tipo),
        tempo: 'passado',
        tipo: 'evento',
      })
    }
    for (const d of datas) {
      const when = new Date(d.data)
      out.push({
        id: `d-${d.id}`,
        quando: when,
        label: prettyDataChave(d.tipo),
        tempo: when > now ? 'futuro' : 'passado',
        tipo: 'data',
      })
    }
    for (const o of obrigacoes) {
      if (!o.proximaData) continue
      const when = new Date(o.proximaData)
      out.push({
        id: `o-${o.id}`,
        quando: when,
        label: o.descricao.slice(0, 50),
        tempo: when > now ? 'futuro' : 'passado',
        tipo: 'obrigacao',
      })
    }

    // marcador "agora"
    out.push({
      id: 'agora',
      quando: now,
      label: 'Estado actual',
      tempo: 'hoje',
      tipo: 'agora',
    })

    out.sort((a, b) => a.quando.getTime() - b.quando.getTime())
    return out
  }, [eventos, datas, obrigacoes])

  if (eventos === null) {
    return (
      <section className="ev">
        <div className="ev-title">Evolução</div>
        <div className="ev-skel" />
        <style jsx>{css}</style>
      </section>
    )
  }

  return (
    <section className="ev">
      <div className="ev-title">Evolução — passado, presente e futuro</div>
      <div className="ev-track">
        {pontos.map((p) => (
          <div key={p.id} className={`ev-ponto tempo-${p.tempo} tipo-${p.tipo}`}>
            <div className="ev-marca" />
            <div className="ev-conteudo">
              <div className="ev-data">{fmtDataCurta(p.quando)}</div>
              <div className="ev-label">{p.label}</div>
            </div>
          </div>
        ))}
      </div>
      <style jsx>{css}</style>
    </section>
  )
}

const css = `
  .ev {
    background: var(--k2-bg-elev);
    border: 1px solid var(--k2-border);
    border-radius: var(--k2-radius);
    padding: 14px 16px;
  }
  .ev-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--k2-text-mute);
    margin-bottom: 14px;
  }
  .ev-track {
    display: flex;
    flex-direction: column;
    position: relative;
    padding-left: 4px;
  }
  /* linha vertical contínua */
  .ev-track::before {
    content: '';
    position: absolute;
    left: 8px;
    top: 6px;
    bottom: 6px;
    width: 1px;
    background: var(--k2-border);
  }
  .ev-ponto {
    display: flex;
    gap: 12px;
    padding: 5px 0;
    position: relative;
  }
  .ev-marca {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    margin-top: 4px;
    flex-shrink: 0;
    z-index: 1;
    background: var(--k2-bg-elev);
    border: 2px solid var(--k2-border-strong);
  }
  .tempo-passado .ev-marca { border-color: var(--k2-text-mute); }
  .tempo-passado .ev-data,
  .tempo-passado .ev-label { color: var(--k2-text-mute); }
  .tempo-hoje .ev-marca {
    background: var(--k2-text);
    border-color: var(--k2-text);
    width: 11px;
    height: 11px;
    margin-top: 3px;
    margin-left: -1px;
  }
  .tempo-hoje .ev-label {
    font-weight: 700;
    color: var(--k2-text);
  }
  .tempo-futuro .ev-marca {
    border-color: var(--k2-warn);
    border-style: dashed;
  }
  .tipo-data.tempo-futuro .ev-label { color: var(--k2-text); }
  .ev-conteudo { display: flex; gap: 10px; align-items: baseline; flex: 1; min-width: 0; }
  .ev-data {
    font-size: 10px;
    color: var(--k2-text-mute);
    width: 48px;
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
  }
  .ev-label {
    font-size: 12px;
    color: var(--k2-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ev-skel {
    height: 120px;
    background: var(--k2-bg);
    border-radius: var(--k2-radius-sm);
    opacity: 0.5;
    animation: ev-pulse 1.4s ease-in-out infinite;
  }
  @keyframes ev-pulse { 0%,100%{opacity:0.3} 50%{opacity:0.6} }
`
