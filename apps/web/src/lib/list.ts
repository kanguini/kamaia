/**
 * Helpers defensivos para consumir endpoints de listagem.
 *
 * Problema histórico que motivou este ficheiro:
 *   Alguns serviços da API devolvem `T[]` (catálogos pequenos:
 *   templates, tipos-contrato, carteiras). Outros devolvem
 *   `{ data: T[], nextCursor, total }` (entidades dinâmicas:
 *   contratos, entidades, cláusulas).
 *
 *   O frontend tipava todos como `PaginatedResponse<T>` e fazia
 *   `res.data ?? []`. Quando a API devolvia array directo,
 *   `res.data` ficava `undefined` → lista vazia silenciosa.
 *   Era um bug class — não um caso isolado.
 *
 *   Resultado visível para o utilizador: "criei um tipo, não
 *   aparece no dropdown" (bug que ele reportou). Idem dropdown
 *   de carteiras, de templates, etc.
 *
 * Estes helpers aceitam *qualquer* uma das formas e devolvem
 * sempre algo consistente. Substituir gradualmente todos os
 * `res.data ?? []` por `unwrapList(res)`.
 */

export interface PaginatedShape<T> {
  data: T[]
  nextCursor: string | null
  total: number
}

/**
 * Devolve sempre um array de items, independentemente da forma
 * que o endpoint usou. Não consome `nextCursor` — usa
 * `unwrapPaginated` se precisares de pagination state.
 */
export function unwrapList<T>(response: unknown): T[] {
  if (Array.isArray(response)) return response as T[]
  if (response && typeof response === 'object' && 'data' in response) {
    const d = (response as { data?: unknown }).data
    if (Array.isArray(d)) return d as T[]
  }
  return []
}

/**
 * Devolve sempre uma forma paginada. Para endpoints que não
 * paginam (devolveram array directo), `nextCursor=null` e
 * `total=data.length`.
 *
 * Usar quando o componente precisa de "Carregar mais" ou exibe
 * contagem total.
 */
export function unwrapPaginated<T>(response: unknown): PaginatedShape<T> {
  if (Array.isArray(response)) {
    return { data: response as T[], nextCursor: null, total: response.length }
  }
  if (response && typeof response === 'object') {
    const r = response as Partial<PaginatedShape<T>>
    const data = Array.isArray(r.data) ? (r.data as T[]) : []
    return {
      data,
      nextCursor: r.nextCursor ?? null,
      total: typeof r.total === 'number' ? r.total : data.length,
    }
  }
  return { data: [], nextCursor: null, total: 0 }
}
