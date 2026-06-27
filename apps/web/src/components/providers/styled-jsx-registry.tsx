'use client'

/**
 * Registry de styled-jsx para o App Router.
 *
 * Sem isto, os estilos `<style jsx>` NÃO são emitidos no HTML do
 * servidor — só aplicam depois de o JS hidratar no cliente, causando
 * um flash de conteúdo sem estilo (FOUC) em todas as páginas que usam
 * styled-jsx (que são quase todas). Em páginas com bundle pesado a
 * hidratação demora e a FOUC fica visível/persistente.
 *
 * Este provider recolhe os estilos gerados durante o SSR e injecta-os
 * no <head> via useServerInsertedHTML, garantindo que o HTML inicial
 * já vem estilizado. Padrão oficial:
 * https://nextjs.org/docs/app/building-your-application/styling/css-in-js#styled-jsx
 */

import React, { useState } from 'react'
import { useServerInsertedHTML } from 'next/navigation'
import { StyleRegistry, createStyleRegistry } from 'styled-jsx'

export function StyledJsxRegistry({ children }: { children: React.ReactNode }) {
  const [registry] = useState(() => createStyleRegistry())

  useServerInsertedHTML(() => {
    const styles = registry.styles()
    registry.flush()
    return <>{styles}</>
  })

  return <StyleRegistry registry={registry}>{children}</StyleRegistry>
}
