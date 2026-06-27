// ────────────────────────────────────────────────────────────────────────
// CLM formatting helpers — money, dates, contract state.
// Backend stores money in BigInt centavos and dates in UTC ISO strings.
// ────────────────────────────────────────────────────────────────────────

import { ContratoEstado, CONTRATO_ESTADO_LABELS } from '@kamaia/shared-types'

/**
 * Format centavos (string|number|bigint) → "1.234.567,89 AOA".
 *
 * Aritmética inteira em BigInt — nunca `Number(bigint)/100` (perderia
 * precisão acima de 2^53 centavos e reintroduz erro de float no produto
 * fiscal). A parte inteira é agrupada via BigInt.toLocaleString; os
 * centavos são os 2 últimos dígitos, exatos.
 */
export function fmtMoney(
  value: string | number | bigint | null | undefined,
  moeda: string | null | undefined = 'AOA',
): string {
  if (value == null) return '—'
  let centavos: bigint
  try {
    centavos =
      typeof value === 'bigint'
        ? value
        : typeof value === 'number'
          ? BigInt(Math.round(value))
          : BigInt(value.trim())
  } catch {
    return '—'
  }
  const HUNDRED = BigInt(100)
  const neg = centavos < BigInt(0)
  const abs = neg ? -centavos : centavos
  const inteiro = (abs / HUNDRED).toLocaleString('pt-AO')
  const frac = (abs % HUNDRED).toString().padStart(2, '0')
  return `${neg ? '-' : ''}${inteiro},${frac} ${moeda ?? 'AOA'}`
}

/** Format ISO UTC date → "23/06/2026" in WAT (UTC+1). */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('pt-AO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Africa/Luanda',
    })
  } catch {
    return '—'
  }
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('pt-AO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Luanda',
    })
  } catch {
    return '—'
  }
}

/** Buckets for the estado badge variant used in the listings. */
export function estadoBadgeVariant(estado: ContratoEstado): string {
  switch (estado) {
    case ContratoEstado.ACTIVO:
    case ContratoEstado.ASSINADO:
    case ContratoEstado.POS_ASSINATURA:
      return 'success'
    case ContratoEstado.EM_NEGOCIACAO:
    case ContratoEstado.REV_INTERNA:
    case ContratoEstado.REV_CLIENTE:
    case ContratoEstado.APROVACAO:
    case ContratoEstado.PRONTO_ASSINATURA:
    case ContratoEstado.EM_ADENDA:
      return 'info'
    case ContratoEstado.EM_DISPUTA:
    case ContratoEstado.EM_TERMINACAO:
      return 'warning'
    case ContratoEstado.TERMINADO:
    case ContratoEstado.CANCELADO:
    case ContratoEstado.ARQUIVADO:
      return 'default'
    case ContratoEstado.INTAKE:
    case ContratoEstado.DRAFTING:
    case ContratoEstado.REPOSITORIO:
    default:
      return 'default'
  }
}

export function estadoLabel(estado: ContratoEstado): string {
  return CONTRATO_ESTADO_LABELS[estado] ?? estado
}

/** Days until ISO date (positive = future, negative = past). */
export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null
  const target = new Date(iso).getTime()
  if (!Number.isFinite(target)) return null
  const now = Date.now()
  return Math.floor((target - now) / (1000 * 60 * 60 * 24))
}
