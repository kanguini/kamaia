/**
 * Motor "Precisa da tua atenção" — o diferenciador central do Kamaia
 * face a CLMs reactivos como o Contracko.
 *
 * Filosofia: em vez de mostrar metadata e esperar que o utilizador
 * descubra o que fazer, CRUZAMOS todas as fontes de urgência de um
 * contrato e apresentamos, no topo, as 3-5 coisas que precisam de
 * acção AGORA — cada uma com botões de resolução in-line.
 *
 * Fontes cruzadas:
 *   1. Actos regulatórios pendentes (TGIS, registos, BNA, AGT,
 *      notário) — o moat angolano. Cada um com prazo legal.
 *   2. Datas-chave a vencer (termo, renovação, janela de denúncia)
 *   3. Obrigações periódicas em atraso ou iminentes
 *
 * Pure function — sem side effects, sem fetch. Recebe os dados já
 * carregados e devolve items ordenados por urgência. Testável.
 */

export type AtencaoSeveridade = 'critico' | 'aviso' | 'info'

export type AtencaoCategoria =
  | 'compliance'
  | 'vigencia'
  | 'obrigacao'

/** Acção resolvível associada a um item de atenção. */
export interface AtencaoAccao {
  /** Label do botão. */
  label: string
  /** Identificador semântico da acção (o componente decide o handler). */
  kind:
    | 'acto.concluir'
    | 'acto.em-curso'
    | 'acto.inaplicavel'
    | 'vigencia.renovar'
    | 'vigencia.bloquear-renovacao'
    | 'vigencia.adenda'
    | 'obrigacao.cumprir'
    | 'navegar'
  /** Estilo do botão. */
  variant: 'primary' | 'secondary' | 'ghost'
}

export interface AtencaoItem {
  id: string
  severidade: AtencaoSeveridade
  categoria: AtencaoCategoria
  titulo: string
  /** Linha de contexto: prazo, valor, referência legal. */
  detalhe: string
  /** Acções in-line. Vazio = informativo sem resolução directa. */
  accoes: AtencaoAccao[]
  /**
   * Score interno de urgência para ordenação (maior = mais urgente).
   * Não exposto no UI.
   */
  score: number
  /** Payload para o handler (actoId, etc.). */
  ref?: { actoId?: string; dataChaveId?: string; obrigacaoId?: string }
}

// ─── Inputs ──────────────────────────────────────────────────────

export interface ActoInput {
  id: string
  tipo: string
  estado: string // PENDENTE | EM_CURSO | CONCLUIDO | NAO_APLICAVEL | BLOQUEADO
  tgisVerbaNumero: string | null
  valorLiquidar: string | null
  baseMoeda: string | null
  prazoLimite: string | null
  referenciaLegal: string | null
  detectadoAutomaticamente: boolean
}

export interface DataChaveInput {
  id: string
  tipo: string // TERMO | RENOVACAO_AUTOMATICA | JANELA_DENUNCIA_FIM | ...
  data: string
  cumprida: boolean
  descricao: string | null
}

export interface ObrigacaoInput {
  id: string
  tipo: string
  descricao: string
  proximaData: string | null
}

export interface ContratoAtencaoInput {
  estado: string
  dataTermo: string | null
  renovacaoAutomatica: boolean
  prazoRenovacaoMeses: number | null
  janelaDenunciaDias: number | null
  denunciaEm: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────

function diasAte(iso: string, now: Date): number {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return Number.POSITIVE_INFINITY
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function prettyTipoActo(t: string): string {
  const map: Record<string, string> = {
    IMPOSTO_DE_SELO: 'Imposto de Selo',
    REGISTO_PREDIAL: 'Registo Predial',
    REGISTO_COMERCIAL: 'Registo Comercial',
    REGISTO_AUTOMOVEL: 'Registo Automóvel',
    REGISTO_IAPI: 'Registo IAPI',
    BNA_LICENCIAMENTO: 'Licenciamento BNA',
    BNA_RJOC: 'BNA — RJOC',
    AGT_RETENCAO_IRT: 'Retenção IRT (AGT)',
    RECONHECIMENTO_NOTARIAL: 'Reconhecimento notarial',
    OUTRO: 'Acto regulatório',
  }
  return map[t] ?? t
}

function fmtMoneyShort(centavosStr: string | null, moeda: string | null): string {
  if (!centavosStr) return ''
  const n = Number(centavosStr)
  if (!Number.isFinite(n)) return ''
  const unidades = n / 100
  return `${new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 }).format(
    unidades,
  )} ${moeda ?? 'AOA'}`
}

function prettyDias(dias: number): string {
  if (dias < 0) return `há ${Math.abs(dias)} dias`
  if (dias === 0) return 'hoje'
  if (dias === 1) return 'amanhã'
  return `em ${dias} dias`
}

// ─── Motor ───────────────────────────────────────────────────────

export function computarAtencao(opts: {
  contrato: ContratoAtencaoInput
  actos: ActoInput[]
  datas: DataChaveInput[]
  obrigacoes: ObrigacaoInput[]
  now?: Date
}): AtencaoItem[] {
  const now = opts.now ?? new Date()
  const items: AtencaoItem[] = []

  // ── 1. Actos regulatórios pendentes / em curso ──
  for (const acto of opts.actos) {
    if (acto.estado === 'CONCLUIDO' || acto.estado === 'NAO_APLICAVEL') continue

    const dias = acto.prazoLimite ? diasAte(acto.prazoLimite, now) : null
    const bloqueado = acto.estado === 'BLOQUEADO'
    // Severidade: bloqueado ou prazo passado/iminente = crítico
    const severidade: AtencaoSeveridade = bloqueado
      ? 'critico'
      : dias !== null && dias <= 7
        ? 'critico'
        : 'aviso'

    const valor = fmtMoneyShort(acto.valorLiquidar, acto.baseMoeda)
    const detalheParts = [
      acto.detectadoAutomaticamente ? 'Auto-detectado' : null,
      valor || null,
      dias !== null ? `prazo legal ${prettyDias(dias)}` : null,
      acto.referenciaLegal ? acto.referenciaLegal.slice(0, 60) : null,
    ].filter(Boolean)

    // Score: crítico=1000 base, + urgência do prazo (quanto menos
    // dias, maior). Bloqueado tem prioridade máxima.
    const score =
      (bloqueado ? 2000 : severidade === 'critico' ? 1000 : 500) +
      (dias !== null ? Math.max(0, 100 - dias) : 0)

    const titulo = bloqueado
      ? `${prettyTipoActo(acto.tipo)} — BLOQUEADO`
      : `${prettyTipoActo(acto.tipo)}${acto.tgisVerbaNumero ? ` Verba ${acto.tgisVerbaNumero}` : ''} pendente`

    items.push({
      id: `acto-${acto.id}`,
      severidade,
      categoria: 'compliance',
      titulo,
      detalhe: detalheParts.join(' · ') || 'Requer confirmação humana',
      accoes: [
        { label: 'Confirmar concluído', kind: 'acto.concluir', variant: 'primary' },
        { label: 'Em curso', kind: 'acto.em-curso', variant: 'secondary' },
        { label: 'Não aplicável', kind: 'acto.inaplicavel', variant: 'ghost' },
      ],
      score,
      ref: { actoId: acto.id },
    })
  }

  // ── 2. Vigência (termo + renovação + denúncia) ──
  if (opts.contrato.dataTermo) {
    const dias = diasAte(opts.contrato.dataTermo, now)
    const ativo =
      opts.contrato.estado === 'ACTIVO' ||
      opts.contrato.estado === 'REPOSITORIO' ||
      opts.contrato.estado === 'POS_ASSINATURA'

    if (ativo && dias <= 60) {
      const renova = opts.contrato.renovacaoAutomatica && !opts.contrato.denunciaEm
      const severidade: AtencaoSeveridade =
        dias < 0 ? 'critico' : dias <= 7 ? 'critico' : 'aviso'

      if (renova) {
        // Janela de denúncia: se há janelaDenunciaDias, o utilizador
        // tem de decidir ANTES de (termo - janela).
        const janela = opts.contrato.janelaDenunciaDias
        const janelaFechada =
          janela !== null && dias <= janela
        items.push({
          id: 'vigencia-renova',
          severidade,
          categoria: 'vigencia',
          titulo: `Renovação automática ${prettyDias(dias)}`,
          detalhe: janelaFechada
            ? `Janela de denúncia (${janela}d) já fechou — vai renovar por +${opts.contrato.prazoRenovacaoMeses ?? '?'} meses`
            : `Decide antes de ${janela ?? 0} dias do termo se queres bloquear a renovação`,
          accoes: [
            { label: 'Confirmar renovação', kind: 'vigencia.renovar', variant: 'primary' },
            { label: 'Bloquear renovação', kind: 'vigencia.bloquear-renovacao', variant: 'secondary' },
            { label: 'Criar adenda', kind: 'vigencia.adenda', variant: 'ghost' },
          ],
          score: (dias < 0 ? 1500 : 900) + Math.max(0, 90 - dias),
        })
      } else {
        items.push({
          id: 'vigencia-termina',
          severidade,
          categoria: 'vigencia',
          titulo: dias < 0 ? `Termo expirou ${prettyDias(dias)}` : `Termina ${prettyDias(dias)}`,
          detalhe: 'Sem renovação automática — o contrato encerra na data de termo',
          accoes: [
            { label: 'Criar adenda', kind: 'vigencia.adenda', variant: 'secondary' },
          ],
          score: (dias < 0 ? 1400 : 850) + Math.max(0, 90 - dias),
        })
      }
    }
  }

  // ── 3. Obrigações em atraso ou iminentes ──
  for (const o of opts.obrigacoes) {
    if (!o.proximaData) continue
    const dias = diasAte(o.proximaData, now)
    if (dias > 15) continue // só as iminentes (15d) ou atrasadas
    const atrasada = dias < 0
    items.push({
      id: `obrig-${o.id}`,
      severidade: atrasada ? 'critico' : 'aviso',
      categoria: 'obrigacao',
      titulo: `${o.descricao.slice(0, 50)}${atrasada ? ' — em atraso' : ''}`,
      detalhe: `${prettyTipoObr(o.tipo)} · ${prettyDias(dias)}`,
      accoes: [
        { label: 'Marcar cumprida', kind: 'obrigacao.cumprir', variant: 'primary' },
      ],
      score: (atrasada ? 800 : 400) + Math.max(0, 30 - dias),
      ref: { obrigacaoId: o.id },
    })
  }

  // Ordena por score desc (mais urgente primeiro)
  items.sort((a, b) => b.score - a.score)
  return items
}

function prettyTipoObr(t: string): string {
  const map: Record<string, string> = {
    PAGAMENTO_PERIODICO: 'Pagamento',
    REPORTE: 'Reporte',
    GARANTIA_VALIDADE: 'Garantia',
    SEGURO_VALIDADE: 'Seguro',
    SLA: 'SLA',
    ENTREGA_PERIODICA: 'Entrega',
    OUTRO: 'Obrigação',
  }
  return map[t] ?? t
}
