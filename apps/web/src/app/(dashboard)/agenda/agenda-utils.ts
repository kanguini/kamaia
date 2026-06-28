/**
 * Utilitários puros da Agenda — matemática de datas e mapeamento de
 * cores. Sem dependências de React. A semana começa à segunda-feira
 * (convenção PT/AO).
 */

export type AgendaOrigem = 'evento' | 'data-chave' | 'acto' | 'obrigacao' | 'tarefa'

export interface AgendaItem {
  id: string
  origem: AgendaOrigem
  titulo: string
  inicio: string // ISO
  fim: string | null
  diaInteiro: boolean
  tipo: string
  cor: string | null
  contratoId: string | null
  contratoNumero: string | null
  editavel: boolean
}

export type AgendaVista = 'semana' | 'mes' | 'ano'

// ─── Cores por origem/tipo ──────────────────────────────────────
// Eventos próprios usam cor por tipo; itens derivados de contratos
// têm cor fixa por origem (read-only) para se distinguirem.
export function corDoItem(item: AgendaItem): string {
  if (item.cor) return item.cor
  if (item.origem === 'acto') return '#b45309' // âmbar — compliance
  if (item.origem === 'data-chave') return '#0e7490' // ciano — datas
  if (item.origem === 'obrigacao') return '#7c3aed' // roxo — obrigações
  if (item.origem === 'tarefa') return '#15803d' // verde — tarefas
  // Eventos próprios por tipo:
  switch (item.tipo) {
    case 'REUNIAO':
      return '#2563eb'
    case 'PRAZO':
      return '#dc2626'
    case 'AUDIENCIA':
      return '#9333ea'
    case 'LEMBRETE':
      return '#0891b2'
    case 'ASSINATURA':
      return '#16a34a'
    default:
      return '#475569'
  }
}

// ─── Datas ───────────────────────────────────────────────────────

export function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export function addMonths(d: Date, n: number): Date {
  const x = new Date(d)
  x.setMonth(x.getMonth() + n)
  return x
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
}

/** Segunda-feira da semana que contém `d`. */
export function startOfWeek(d: Date): Date {
  const x = startOfDay(d)
  const dow = (x.getDay() + 6) % 7 // 0 = segunda
  return addDays(x, -dow)
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function isToday(d: Date): boolean {
  return sameDay(d, new Date())
}

/**
 * Matriz de 6 semanas × 7 dias que cobre o mês de `d` (inclui dias
 * de transbordo dos meses adjacentes).
 */
export function monthMatrix(d: Date): Date[][] {
  const first = startOfWeek(startOfMonth(d))
  const weeks: Date[][] = []
  for (let w = 0; w < 6; w++) {
    const row: Date[] = []
    for (let i = 0; i < 7; i++) row.push(addDays(first, w * 7 + i))
    weeks.push(row)
  }
  return weeks
}

/** Os 7 dias (segunda→domingo) da semana que contém `d`. */
export function weekDays(d: Date): Date[] {
  const start = startOfWeek(d)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
export const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

export function fmtHora(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** YYYY-MM-DD em hora local (para inputs type=date). */
export function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** HH:MM em hora local (para inputs type=time). */
export function toHm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Constrói um Date local a partir de YYYY-MM-DD + HH:MM. */
export function fromYmdHm(ymd: string, hm: string): Date {
  const [y, m, dd] = ymd.split('-').map(Number)
  const [h, mi] = hm.split(':').map(Number)
  return new Date(y, m - 1, dd, h || 0, mi || 0, 0, 0)
}
