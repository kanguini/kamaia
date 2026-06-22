/**
 * Kamaia CLM — `/contratos/novo` agora redirecciona.
 *
 * A criação de contrato é um slide-over modal disparado a partir da lista
 * (`/contratos`). Esta rota existe só para preservar bookmarks/atalhos
 * antigos — redirecciona com `?novo=1` para auto-abrir o modal.
 */

import { redirect } from 'next/navigation'

export default function NovoContratoRedirect() {
  redirect('/contratos?novo=1')
}
