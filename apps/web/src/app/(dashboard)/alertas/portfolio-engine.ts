/**
 * Motor de agregação da carteira — o "command center" que responde
 * "o que a minha carteira inteira precisa de mim agora?".
 *
 * Onde o Contracko oferece "Review today's priorities" como um prompt
 * de chat (tu pedes, ele responde), o Kamaia constrói a fila de acção
 * real: funde TODOS os sinais de urgência da carteira — actos
 * regulatórios pendentes, contratos a expirar, datas-chave — numa
 * única lista priorizada e agrupada por janela temporal.
 *
 * É a vista matinal: abres e sabes o teu dia, por ordem de urgência,
 * sem perguntar nada.
 *
 * Pure function — recebe os dados já carregados, devolve buckets
 * temporais com items ordenados.
 */

import { ACTO_REGULATORIO_LABELS, ActoRegulatorioTipo } from '@kamaia/shared-types'

export type Bucket = 'atrasado' | 'hoje' | 'semana' | 'mes'

export interface PortfolioItem {
  id: string
  bucket: Bucket
  categoria: 'compliance' | 'vigencia'
  titulo: string
  /** Contrato a que pertence (para navegação). */
  contratoId: string
  contratoNumero: string
  contratoTitulo: string
  /** Linha de contexto: prazo, valor, ref legal. */
  detalhe: string
  /** Dias até ao prazo (negativo = atrasado). */
  dias: number
  /** Se é um acto resolvível in-line, o seu id. */
  actoId?: string
  severidade: 'critico' | 'aviso'
}

// ─── Inputs ──────────────────────────────────────────────────────

export interface PortfolioActo {
  id: string
  tipo: string
  estado: string
  prazoLimite: string | null
  valorLiquidar: string | null
  tgisVerbaNumero: string | null
  referenciaLegal: string | null
  contrato?: { id: string; numeroInterno: string; titulo: string }
}

export interface PortfolioContrato {
  id: string
  numeroInterno: string
  titulo: string
  dataTermo: string | null
  renovacaoAutomatica: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────

function diasAte(iso: string, now: Date): number {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return Number.POSITIVE_INFINITY
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function bucketDe(dias: number): Bucket {
  if (dias < 0) return 'atrasado'
  if (dias === 0) return 'hoje'
  if (dias <= 7) return 'semana'
  return 'mes'
}

function prettyTipoActo(t: string): string {
  // Usa o catálogo canónico de shared-types (single source of truth)
  // em vez de hardcode — evita drift de enum (os valores reais são
  // IMPOSTO_SELO, REGISTO_IP_IAPI, BNA_AUTORIZACAO, etc.).
  return ACTO_REGULATORIO_LABELS[t as ActoRegulatorioTipo] ?? t
}

function fmtMoneyShort(centavosStr: string | null): string | null {
  if (!centavosStr) return null
  const n = Number(centavosStr)
  if (!Number.isFinite(n)) return null
  return `${new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 }).format(
    n / 100,
  )} AOA`
}

function prettyDias(dias: number): string {
  if (dias < 0) return `há ${Math.abs(dias)} dias`
  if (dias === 0) return 'hoje'
  if (dias === 1) return 'amanhã'
  return `em ${dias} dias`
}

// ─── Motor ───────────────────────────────────────────────────────

export interface PortfolioResultado {
  buckets: Record<Bucket, PortfolioItem[]>
  total: number
}

export function computarPortfolio(opts: {
  actos: PortfolioActo[]
  contratos: PortfolioContrato[]
  now?: Date
}): PortfolioResultado {
  const now = opts.now ?? new Date()
  const items: PortfolioItem[] = []

  // ── Actos regulatórios pendentes (toda a carteira) ──
  for (const a of opts.actos) {
    if (
      a.estado === 'CONCLUIDO' ||
      a.estado === 'NAO_APLICAVEL' ||
      a.estado === 'DISPENSADO'
    )
      continue
    if (!a.contrato) continue

    const dias = a.prazoLimite ? diasAte(a.prazoLimite, now) : 999
    const valor = fmtMoneyShort(a.valorLiquidar)
    const detalhe = [
      valor,
      a.prazoLimite ? `prazo ${prettyDias(dias)}` : 'sem prazo definido',
      a.referenciaLegal ? a.referenciaLegal.slice(0, 50) : null,
    ]
      .filter(Boolean)
      .join(' · ')

    items.push({
      id: `acto-${a.id}`,
      bucket: bucketDe(dias),
      categoria: 'compliance',
      titulo: `${prettyTipoActo(a.tipo)}${a.tgisVerbaNumero ? ` Verba ${a.tgisVerbaNumero}` : ''}`,
      contratoId: a.contrato.id,
      contratoNumero: a.contrato.numeroInterno,
      contratoTitulo: a.contrato.titulo,
      detalhe,
      dias,
      actoId: a.id,
      severidade:
        dias <= 7 || a.estado === 'FALHOU' || a.estado === 'EXPIRADO'
          ? 'critico'
          : 'aviso',
    })
  }

  // ── Contratos a expirar ──
  for (const c of opts.contratos) {
    if (!c.dataTermo) continue
    const dias = diasAte(c.dataTermo, now)
    if (dias > 30) continue // só os a expirar em 30d ou já expirados

    const renova = c.renovacaoAutomatica
    items.push({
      id: `vig-${c.id}`,
      bucket: bucketDe(dias),
      categoria: 'vigencia',
      titulo: renova
        ? `Renovação automática ${prettyDias(dias)}`
        : `Termina ${prettyDias(dias)}`,
      contratoId: c.id,
      contratoNumero: c.numeroInterno,
      contratoTitulo: c.titulo,
      detalhe: renova
        ? 'Renova automaticamente se não for denunciado'
        : 'Encerra na data de termo (sem renovação)',
      dias,
      severidade: dias <= 7 ? 'critico' : 'aviso',
    })
  }

  // Ordena dentro de cada item por dias asc (mais urgente primeiro)
  items.sort((a, b) => a.dias - b.dias)

  const buckets: Record<Bucket, PortfolioItem[]> = {
    atrasado: [],
    hoje: [],
    semana: [],
    mes: [],
  }
  for (const item of items) {
    buckets[item.bucket].push(item)
  }

  return { buckets, total: items.length }
}

export const BUCKET_LABELS: Record<Bucket, string> = {
  atrasado: 'Em atraso',
  hoje: 'Hoje',
  semana: 'Esta semana',
  mes: 'Este mês',
}
