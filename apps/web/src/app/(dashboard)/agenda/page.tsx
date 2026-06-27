'use client'

/**
 * Agenda — calendário da organização com vistas Semana / Mês / Ano e
 * criação de eventos com data e hora.
 *
 * Diferenciador: a agenda não nasce vazia. Além dos eventos próprios
 * (reuniões, prazos, lembretes), preenche-se automaticamente com as
 * datas que importam na carteira — datas-chave de contratos, prazos de
 * actos regulatórios e obrigações periódicas. Tudo num só calendário.
 * Os itens derivados de contratos são read-only e levam ao contrato;
 * os eventos próprios são editáveis.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react'
import { api } from '@/lib/api'
import { EventoModal } from './evento-modal'
import { WeekView } from './week-view'
import {
  MESES,
  DIAS_SEMANA,
  addDays,
  addMonths,
  corDoItem,
  fmtHora,
  isToday,
  monthMatrix,
  sameDay,
  startOfMonth,
  startOfWeek,
  weekDays,
  type AgendaItem,
  type AgendaVista,
} from './agenda-utils'

export default function AgendaPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [vista, setVista] = useState<AgendaVista>('mes')
  const [cursor, setCursor] = useState(() => new Date())
  const [items, setItems] = useState<AgendaItem[]>([])
  const [loading, setLoading] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [modalData, setModalData] = useState<Date | undefined>(undefined)
  const [modalEditar, setModalEditar] = useState<AgendaItem | undefined>(undefined)

  // Janela [from, to] a pedir ao backend conforme a vista.
  const [from, to] = useMemo<[Date, Date]>(() => {
    if (vista === 'semana') {
      const ini = startOfWeek(cursor)
      return [ini, addDays(ini, 7)]
    }
    if (vista === 'ano') {
      return [
        new Date(cursor.getFullYear(), 0, 1),
        new Date(cursor.getFullYear(), 11, 31, 23, 59, 59),
      ]
    }
    // mês — cobre a matriz de 6 semanas
    const ini = startOfWeek(startOfMonth(cursor))
    return [ini, addDays(ini, 42)]
  }, [vista, cursor])

  const token = session?.accessToken

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await api<{ items: AgendaItem[] }>(
        `/agenda?from=${from.toISOString()}&to=${to.toISOString()}`,
        { token },
      )
      setItems(res.items ?? [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [token, from, to])

  useEffect(() => {
    void load()
  }, [load])

  const navegar = (dir: -1 | 1) => {
    if (vista === 'semana') setCursor((c) => addDays(c, dir * 7))
    else if (vista === 'ano')
      setCursor((c) => new Date(c.getFullYear() + dir, c.getMonth(), 1))
    else setCursor((c) => addMonths(c, dir))
  }

  const abrirNovo = (data?: Date) => {
    setModalEditar(undefined)
    setModalData(data)
    setModalOpen(true)
  }

  const abrirEvento = (item: AgendaItem) => {
    if (item.editavel) {
      setModalEditar(item)
      setModalData(undefined)
      setModalOpen(true)
    } else if (item.contratoId) {
      router.push(`/contratos/${item.contratoId}`)
    }
  }

  const titulo =
    vista === 'ano'
      ? String(cursor.getFullYear())
      : vista === 'semana'
        ? rotuloSemana(cursor)
        : `${MESES[cursor.getMonth()]} ${cursor.getFullYear()}`

  // Coluna lateral: próximos eventos/tarefas (de hoje em diante),
  // ordenados por data. Independente da vista do calendário.
  const proximos = useMemo(() => {
    const inicioHoje = new Date()
    inicioHoje.setHours(0, 0, 0, 0)
    const t0 = inicioHoje.getTime()
    return items
      .filter((it) => new Date(it.inicio).getTime() >= t0)
      .sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime())
      .slice(0, 12)
  }, [items])

  const fmtDataCurta = (iso: string) => {
    const d = new Date(iso)
    return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1200 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 500, margin: 0 }}>Agenda</h1>
        </div>
        <button className="ag-novo" onClick={() => abrirNovo()}>
          <Plus size={15} /> Novo evento
        </button>
      </header>

      {/* Barra de controlo */}
      <div className="ag-toolbar">
        <div className="ag-nav">
          <button className="ag-iconbtn" onClick={() => navegar(-1)} aria-label="Anterior">
            <ChevronLeft size={16} />
          </button>
          <button className="ag-today" onClick={() => setCursor(new Date())}>
            Hoje
          </button>
          <button className="ag-iconbtn" onClick={() => navegar(1)} aria-label="Seguinte">
            <ChevronRight size={16} />
          </button>
          <span className="ag-titulo">{titulo}</span>
          {loading && <span className="ag-loading">a carregar…</span>}
        </div>
        <div className="ag-vistas">
          {(['semana', 'mes', 'ano'] as AgendaVista[]).map((v) => (
            <button
              key={v}
              className={`ag-vista ${vista === v ? 'active' : ''}`}
              onClick={() => setVista(v)}
            >
              {v === 'semana' ? 'Semana' : v === 'mes' ? 'Mês' : 'Ano'}
            </button>
          ))}
        </div>
      </div>

      {/* Legenda */}
      <div className="ag-legenda">
        <Leg cor="#2563eb" txt="Eventos próprios" />
        <Leg cor="#0e7490" txt="Datas-chave" />
        <Leg cor="#b45309" txt="Actos / compliance" />
        <Leg cor="#7c3aed" txt="Obrigações" />
      </div>

      <div className="ag-layout">
        <div className="ag-cal">
          {vista === 'mes' && (
            <MonthView
              cursor={cursor}
              items={items}
              onClickDia={(d) => abrirNovo(d)}
              onClickEvento={abrirEvento}
            />
          )}
          {vista === 'semana' && (
            <WeekView
              dias={weekDays(cursor)}
              items={items}
              onClickEvento={abrirEvento}
              onClickSlot={(d) => abrirNovo(d)}
            />
          )}
          {vista === 'ano' && (
            <YearView
              ano={cursor.getFullYear()}
              items={items}
              onClickDia={(d) => {
                setCursor(d)
                setVista('mes')
              }}
            />
          )}
        </div>

        {/* Coluna de próximos eventos/tarefas */}
        <aside className="ag-side">
          <div className="ag-side-h">Próximos</div>
          {proximos.length === 0 && (
            <div className="ag-side-empty">Sem eventos futuros.</div>
          )}
          {proximos.map((it) => (
            <button
              key={`${it.id}-${it.inicio}`}
              className="ag-side-item"
              onClick={() => abrirEvento(it)}
            >
              <span className="ag-side-dot" style={{ background: corDoItem(it) }} />
              <span className="ag-side-body">
                <span className="ag-side-when">
                  {fmtDataCurta(it.inicio)}
                  {!it.diaInteiro && ` · ${fmtHora(it.inicio)}`}
                </span>
                <span className="ag-side-title">{it.titulo}</span>
              </span>
            </button>
          ))}
        </aside>
      </div>

      <EventoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => void load()}
        dataInicial={modalData}
        editar={modalEditar}
      />

      <style jsx>{`
        .ag-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 300px;
          gap: 16px;
          align-items: start;
        }
        .ag-cal {
          min-width: 0;
        }
        .ag-side {
          display: flex;
          flex-direction: column;
          border: 1px solid var(--k2-border);
          border-radius: var(--k2-radius);
          background: var(--k2-bg-elev);
          overflow: hidden;
        }
        .ag-side-h {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--k2-text-dim);
          padding: 14px 14px 8px;
        }
        .ag-side-empty {
          padding: 4px 14px 16px;
          font-size: 13px;
          color: var(--k2-text-mute);
        }
        .ag-side-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          width: 100%;
          text-align: left;
          padding: 10px 14px;
          background: transparent;
          border: none;
          border-top: 1px solid var(--k2-border);
          cursor: pointer;
          font-family: inherit;
          color: var(--k2-text);
        }
        .ag-side-item:hover {
          background: var(--k2-bg-hover);
        }
        .ag-side-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-top: 5px;
          flex-shrink: 0;
        }
        .ag-side-body {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }
        .ag-side-when {
          font-size: 11px;
          color: var(--k2-text-mute);
        }
        .ag-side-title {
          font-size: 13px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        @media (max-width: 900px) {
          .ag-layout {
            grid-template-columns: 1fr;
          }
        }
        .ag-novo {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 500;
          padding: 9px 14px;
          background: var(--k2-accent);
          color: var(--k2-accent-fg);
          border: none;
          border-radius: var(--k2-radius-sm);
          cursor: pointer;
        }
        .ag-novo:hover {
          opacity: 0.9;
        }
        .ag-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .ag-nav {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .ag-iconbtn {
          display: inline-grid;
          place-items: center;
          width: 30px;
          height: 30px;
          background: var(--k2-bg-elev);
          border: 1px solid var(--k2-border);
          border-radius: var(--k2-radius-sm);
          color: var(--k2-text);
          cursor: pointer;
        }
        .ag-iconbtn:hover {
          background: var(--k2-bg-elev-2);
        }
        .ag-today {
          font-family: inherit;
          font-size: 12px;
          padding: 7px 12px;
          background: var(--k2-bg-elev);
          border: 1px solid var(--k2-border);
          border-radius: var(--k2-radius-sm);
          color: var(--k2-text);
          cursor: pointer;
        }
        .ag-titulo {
          font-size: 16px;
          font-weight: 600;
          color: var(--k2-text);
          margin-left: 8px;
          text-transform: capitalize;
        }
        .ag-loading {
          font-size: 11px;
          color: var(--k2-text-mute);
          margin-left: 4px;
        }
        .ag-vistas {
          display: inline-flex;
          background: var(--k2-bg-elev);
          border: 1px solid var(--k2-border);
          border-radius: var(--k2-radius-sm);
          overflow: hidden;
        }
        .ag-vista {
          font-family: inherit;
          font-size: 12.5px;
          padding: 7px 14px;
          background: transparent;
          border: none;
          color: var(--k2-text-mute);
          cursor: pointer;
        }
        .ag-vista.active {
          background: var(--k2-accent);
          color: var(--k2-accent-fg);
        }
        .ag-legenda {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
        }
      `}</style>
    </div>
  )
}

function Leg({ cor, txt }: { cor: string; txt: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--k2-text-mute)' }}>
      <span style={{ width: 9, height: 9, borderRadius: 2, background: cor }} />
      {txt}
    </span>
  )
}

function rotuloSemana(cursor: Date): string {
  const dias = weekDays(cursor)
  const ini = dias[0]
  const fim = dias[6]
  if (ini.getMonth() === fim.getMonth())
    return `${ini.getDate()}–${fim.getDate()} ${MESES[ini.getMonth()]}`
  return `${ini.getDate()} ${MESES[ini.getMonth()].slice(0, 3)} – ${fim.getDate()} ${MESES[fim.getMonth()].slice(0, 3)}`
}

// ─── Vista de mês ────────────────────────────────────────────────

function MonthView({
  cursor,
  items,
  onClickDia,
  onClickEvento,
}: {
  cursor: Date
  items: AgendaItem[]
  onClickDia: (d: Date) => void
  onClickEvento: (item: AgendaItem) => void
}) {
  const matriz = monthMatrix(cursor)
  const mesActual = cursor.getMonth()

  const doDia = (d: Date) =>
    items
      .filter((i) => sameDay(new Date(i.inicio), d))
      .sort((a, b) => a.inicio.localeCompare(b.inicio))

  return (
    <div className="mv">
      <div className="mv-dows">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="mv-dow">
            {d}
          </div>
        ))}
      </div>
      <div className="mv-grid">
        {matriz.map((semana, wi) =>
          semana.map((dia, di) => {
            const eventos = doDia(dia)
            const visiveis = eventos.slice(0, 3)
            const extra = eventos.length - visiveis.length
            const foraDoMes = dia.getMonth() !== mesActual
            return (
              <div
                key={`${wi}-${di}`}
                className={`mv-cell ${foraDoMes ? 'fora' : ''}`}
                onClick={() => onClickDia(dia)}
              >
                <div className={`mv-num ${isToday(dia) ? 'today' : ''}`}>
                  {dia.getDate()}
                </div>
                <div className="mv-events">
                  {visiveis.map((it) => (
                    <button
                      key={it.id}
                      type="button"
                      className="mv-event"
                      style={{ borderLeft: `3px solid ${corDoItem(it)}` }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onClickEvento(it)
                      }}
                      title={it.titulo}
                    >
                      {!it.diaInteiro && (
                        <span className="mv-event-time">{fmtHora(it.inicio)}</span>
                      )}
                      <span className="mv-event-title">{it.titulo}</span>
                    </button>
                  ))}
                  {extra > 0 && <div className="mv-more">+{extra} mais</div>}
                </div>
              </div>
            )
          }),
        )}
      </div>

      <style jsx>{`
        .mv {
          border: 1px solid var(--k2-border);
          border-radius: var(--k2-radius);
          overflow: hidden;
          background: var(--k2-bg-elev);
        }
        .mv-dows {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          border-bottom: 1px solid var(--k2-border);
        }
        .mv-dow {
          padding: 8px;
          text-align: center;
          font-size: 10.5px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--k2-text-mute);
        }
        .mv-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          grid-auto-rows: minmax(104px, 1fr);
        }
        .mv-cell {
          border-right: 1px solid var(--k2-border);
          border-bottom: 1px solid var(--k2-border);
          padding: 5px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          cursor: pointer;
          min-width: 0;
        }
        .mv-cell:hover {
          background: var(--k2-bg-elev-2);
        }
        .mv-cell.fora {
          background: var(--k2-bg);
        }
        .mv-cell.fora .mv-num {
          color: var(--k2-text-mute);
        }
        .mv-num {
          font-size: 12.5px;
          font-weight: 500;
          color: var(--k2-text);
          width: 22px;
          height: 22px;
          display: grid;
          place-items: center;
        }
        .mv-num.today {
          background: var(--k2-accent);
          color: #fff;
          border-radius: 50%;
        }
        .mv-events {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }
        .mv-event {
          display: flex;
          align-items: baseline;
          gap: 4px;
          background: var(--k2-bg-elev-2);
          border: none;
          border-radius: 3px;
          padding: 2px 5px;
          cursor: pointer;
          text-align: left;
          font-family: inherit;
          min-width: 0;
        }
        .mv-event-time {
          font-size: 9.5px;
          color: var(--k2-text-mute);
          flex-shrink: 0;
        }
        .mv-event-title {
          font-size: 11px;
          color: var(--k2-text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .mv-more {
          font-size: 10px;
          color: var(--k2-text-mute);
          padding: 0 5px;
        }
      `}</style>
    </div>
  )
}

// ─── Vista de ano ────────────────────────────────────────────────

function YearView({
  ano,
  items,
  onClickDia,
}: {
  ano: number
  items: AgendaItem[]
  onClickDia: (d: Date) => void
}) {
  // Set de dias (YYYY-M-D) com pelo menos um item.
  const diasComItem = useMemo(() => {
    const s = new Set<string>()
    for (const it of items) {
      const d = new Date(it.inicio)
      s.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)
    }
    return s
  }, [items])

  return (
    <div className="yv">
      {MESES.map((nome, mes) => {
        const primeiro = new Date(ano, mes, 1)
        const offset = (primeiro.getDay() + 6) % 7 // 0 = segunda
        const diasNoMes = new Date(ano, mes + 1, 0).getDate()
        const celulas: (number | null)[] = []
        for (let i = 0; i < offset; i++) celulas.push(null)
        for (let d = 1; d <= diasNoMes; d++) celulas.push(d)
        return (
          <div key={mes} className="yv-month">
            <div className="yv-month-name">{nome}</div>
            <div className="yv-dows">
              {DIAS_SEMANA.map((d) => (
                <span key={d} className="yv-dow">
                  {d[0]}
                </span>
              ))}
            </div>
            <div className="yv-days">
              {celulas.map((d, i) => {
                if (d === null) return <span key={i} className="yv-empty" />
                const date = new Date(ano, mes, d)
                const tem = diasComItem.has(`${ano}-${mes}-${d}`)
                return (
                  <button
                    key={i}
                    type="button"
                    className={`yv-day ${isToday(date) ? 'today' : ''} ${tem ? 'tem' : ''}`}
                    onClick={() => onClickDia(date)}
                  >
                    {d}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      <style jsx>{`
        .yv {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 14px;
        }
        .yv-month {
          border: 1px solid var(--k2-border);
          border-radius: var(--k2-radius);
          padding: 12px;
          background: var(--k2-bg-elev);
        }
        .yv-month-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--k2-text);
          margin-bottom: 8px;
        }
        .yv-dows,
        .yv-days {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 1px;
        }
        .yv-dow {
          text-align: center;
          font-size: 9px;
          color: var(--k2-text-mute);
          padding-bottom: 3px;
        }
        .yv-empty {
          aspect-ratio: 1;
        }
        .yv-day {
          aspect-ratio: 1;
          display: grid;
          place-items: center;
          font-size: 10.5px;
          color: var(--k2-text-dim);
          background: transparent;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          position: relative;
        }
        .yv-day:hover {
          background: var(--k2-bg-elev-2);
        }
        .yv-day.tem {
          color: var(--k2-text);
          font-weight: 600;
        }
        .yv-day.tem::after {
          content: '';
          position: absolute;
          bottom: 2px;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: var(--k2-accent);
        }
        .yv-day.today {
          background: var(--k2-accent);
          color: #fff;
        }
        .yv-day.today.tem::after {
          background: #fff;
        }
      `}</style>
    </div>
  )
}
