'use client'

/**
 * Vista de semana — grelha temporal (07h–21h) com 7 colunas de dia.
 * Eventos com hora aparecem posicionados pela hora de início e altura
 * proporcional à duração; eventos de dia inteiro (e itens derivados de
 * contratos) ficam numa faixa no topo.
 */

import {
  DIAS_SEMANA,
  corDoItem,
  fmtHora,
  isToday,
  sameDay,
  type AgendaItem,
} from './agenda-utils'

const HORA_INICIO = 7
const HORA_FIM = 21
const ROW_H = 44 // px por hora

export function WeekView({
  dias,
  items,
  onClickEvento,
  onClickSlot,
}: {
  dias: Date[]
  items: AgendaItem[]
  onClickEvento: (item: AgendaItem) => void
  onClickSlot: (data: Date) => void
}) {
  const horas: number[] = []
  for (let h = HORA_INICIO; h <= HORA_FIM; h++) horas.push(h)

  const itemsDoDia = (dia: Date) =>
    items.filter((i) => sameDay(new Date(i.inicio), dia))

  return (
    <div className="wv">
      {/* Cabeçalho dos dias */}
      <div className="wv-head">
        <div className="wv-gutter" />
        {dias.map((d, i) => (
          <div key={i} className={`wv-day-head ${isToday(d) ? 'today' : ''}`}>
            <span className="wv-dow">{DIAS_SEMANA[i]}</span>
            <span className="wv-dom">{d.getDate()}</span>
          </div>
        ))}
      </div>

      {/* Faixa de dia inteiro / derivados */}
      <div className="wv-allday">
        <div className="wv-gutter wv-allday-label">dia todo</div>
        {dias.map((d, i) => {
          const allday = itemsDoDia(d).filter((it) => it.diaInteiro)
          return (
            <div key={i} className="wv-allday-col">
              {allday.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  className="wv-chip"
                  style={{ background: corDoItem(it) }}
                  onClick={() => onClickEvento(it)}
                  title={it.titulo}
                >
                  {it.titulo}
                </button>
              ))}
            </div>
          )
        })}
      </div>

      {/* Grelha horária */}
      <div className="wv-grid">
        <div className="wv-gutter">
          {horas.map((h) => (
            <div key={h} className="wv-hour-label" style={{ height: ROW_H }}>
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>
        {dias.map((d, i) => {
          const timed = itemsDoDia(d).filter((it) => !it.diaInteiro)
          return (
            <div key={i} className={`wv-col ${isToday(d) ? 'today' : ''}`}>
              {horas.map((h) => (
                <div
                  key={h}
                  className="wv-slot"
                  style={{ height: ROW_H }}
                  onClick={() => {
                    const slot = new Date(d)
                    slot.setHours(h, 0, 0, 0)
                    onClickSlot(slot)
                  }}
                />
              ))}
              {timed.map((it) => {
                const ini = new Date(it.inicio)
                const startH = ini.getHours() + ini.getMinutes() / 60
                const fim = it.fim ? new Date(it.fim) : null
                const endH = fim
                  ? fim.getHours() + fim.getMinutes() / 60
                  : startH + 1
                const top = (Math.max(HORA_INICIO, startH) - HORA_INICIO) * ROW_H
                const height = Math.max(
                  20,
                  (Math.min(HORA_FIM + 1, endH) - Math.max(HORA_INICIO, startH)) *
                    ROW_H -
                    2,
                )
                return (
                  <button
                    key={it.id}
                    type="button"
                    className="wv-event"
                    style={{
                      top,
                      height,
                      borderLeft: `3px solid ${corDoItem(it)}`,
                    }}
                    onClick={() => onClickEvento(it)}
                    title={it.titulo}
                  >
                    <span className="wv-event-time">{fmtHora(it.inicio)}</span>
                    <span className="wv-event-title">{it.titulo}</span>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>

      <style jsx>{`
        .wv {
          border: 1px solid var(--k2-border);
          border-radius: var(--k2-radius);
          overflow: hidden;
          background: var(--k2-bg-elev);
        }
        .wv-head,
        .wv-allday {
          display: grid;
          grid-template-columns: 56px repeat(7, 1fr);
          border-bottom: 1px solid var(--k2-border);
        }
        .wv-day-head {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1px;
          padding: 8px 4px;
          border-left: 1px solid var(--k2-border);
        }
        .wv-dow {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--k2-text-mute);
        }
        .wv-dom {
          font-size: 15px;
          font-weight: 600;
          color: var(--k2-text);
        }
        .wv-day-head.today .wv-dom {
          color: #fff;
          background: var(--k2-accent);
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: grid;
          place-items: center;
        }
        .wv-gutter {
          border-right: 1px solid var(--k2-border);
        }
        .wv-allday-label {
          font-size: 9px;
          color: var(--k2-text-mute);
          text-transform: uppercase;
          padding: 4px;
          text-align: right;
        }
        .wv-allday-col {
          border-left: 1px solid var(--k2-border);
          padding: 3px;
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-height: 24px;
        }
        .wv-chip {
          font-size: 10.5px;
          color: #fff;
          border: none;
          border-radius: 4px;
          padding: 2px 6px;
          text-align: left;
          cursor: pointer;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-family: inherit;
        }
        .wv-grid {
          display: grid;
          grid-template-columns: 56px repeat(7, 1fr);
          max-height: 560px;
          overflow-y: auto;
        }
        .wv-hour-label {
          font-size: 10px;
          color: var(--k2-text-mute);
          text-align: right;
          padding: 2px 6px 0 0;
          box-sizing: border-box;
        }
        .wv-col {
          position: relative;
          border-left: 1px solid var(--k2-border);
        }
        .wv-col.today {
          background: color-mix(in srgb, var(--k2-accent) 4%, transparent);
        }
        .wv-slot {
          border-bottom: 1px solid var(--k2-border);
          cursor: pointer;
          box-sizing: border-box;
        }
        .wv-slot:hover {
          background: var(--k2-bg-elev-2);
        }
        .wv-event {
          position: absolute;
          left: 2px;
          right: 2px;
          background: var(--k2-bg-elev-2);
          border: 1px solid var(--k2-border);
          border-radius: 5px;
          padding: 3px 6px;
          text-align: left;
          cursor: pointer;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          gap: 1px;
          font-family: inherit;
        }
        .wv-event-time {
          font-size: 9.5px;
          color: var(--k2-text-mute);
        }
        .wv-event-title {
          font-size: 11.5px;
          font-weight: 500;
          color: var(--k2-text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>
    </div>
  )
}
