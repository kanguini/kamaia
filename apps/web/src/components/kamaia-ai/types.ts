/**
 * Tipos partilhados do Kamaia AI side panel.
 *
 * O panel é instanciado uma vez no dashboard layout e qualquer página
 * pode declarar o seu `PageContext` via `useKamaiaPageContext()`. O
 * backend recebe esse contexto para enriquecer o system prompt.
 */

export type PageContext =
  | { type: 'home' }
  | { type: 'dashboard' }
  | { type: 'contratos.list'; search?: string; estado?: string }
  | { type: 'contratos.detail'; contratoId: string; numeroInterno?: string }
  | { type: 'contratos.novo' }
  | { type: 'entidades.list' }
  | { type: 'entidades.detail'; entidadeId: string }
  | { type: 'carteiras' }
  | { type: 'alertas' }
  | { type: 'compliance' }
  | { type: 'biblioteca'; section: 'templates' | 'clausulas' | 'tipos' }
  | { type: 'configuracoes' }
  | { type: 'ia.full' } // a página /ia full-page
  | { type: 'other'; pathname: string }

export interface Citation {
  documentCodigo: string
  titulo: string
  artigo: string | null
  trecho: string
}

export interface Conversation {
  id: string
  title: string
  updatedAt: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  /** Estado UI: streaming (resposta a chegar), settled (gravada) */
  streaming?: boolean
  citacoes?: Citation[]
  /** Se houve erro durante streaming, fica registado para retry. */
  errored?: boolean
}
