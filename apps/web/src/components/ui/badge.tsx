'use client'

/**
 * Badge — chips monocromáticas com alto contraste.
 *
 * Decisões de design (corrigindo audit UX):
 *  - Paleta mono-first: maioria das chips usa preto/branco/gray
 *  - Fills sólidos (sem transparências 12% que matavam contraste)
 *  - Sem borders quando há fill (regra "shapes filled não têm contorno")
 *  - Outline-only só usado quando a chip *exige* "outline" semantic
 *    (warning de atenção que não é estado terminal)
 *  - Variantes categoriais (civel, laboral, etc.) caem em `default`
 *    porque o texto já é discriminador suficiente — color-coding
 *    arco-íris violava a estética mono.
 */

import { cn } from '@/lib/utils'

type BadgeVariant =
  | 'default'
  | 'activo' | 'suspenso' | 'encerrado' | 'arquivado'
  | 'pendente' | 'cumprido' | 'expirado' | 'cancelado'
  | 'alta' | 'media' | 'baixa'
  | 'civel' | 'laboral' | 'criminal' | 'comercial' | 'administrativo' | 'familia' | 'arbitragem'
  | 'success' | 'warning' | 'danger' | 'info'

/**
 * Quatro classes funcionais:
 *  - SOFT     → bg gray-100 + dark text (chip neutra)
 *  - SOLID    → bg preto + white text (positivo/info forte/destaque)
 *  - OUTLINE  → bg transparente + border preto (warning/atenção)
 *  - DANGER   → bg vermelho-800 + white (perigo crítico)
 */
const SOFT = 'bg-[var(--k2-bg-elev-2)] text-[var(--k2-text-dim)]'
const SOLID = 'bg-[var(--k2-text)] text-[var(--k2-accent-fg)]'
const OUTLINE = 'bg-transparent text-[var(--k2-text)] border border-[var(--k2-text)]'
const DANGER = 'bg-[var(--k2-bad)] text-white'

const variantStyles: Record<string, string> = {
  default: SOFT,
  // Estados terminais → soft
  encerrado: SOFT,
  arquivado: SOFT,
  cancelado: SOFT,
  baixa: SOFT,
  // Estados activos / positivos → solid black
  activo: SOLID,
  cumprido: SOLID,
  pendente: SOLID,
  success: SOLID,
  info: SOLID,
  // Atenção / warning → outline mono
  suspenso: OUTLINE,
  media: OUTLINE,
  warning: OUTLINE,
  // Crítico → vermelho desaturado sólido
  expirado: DANGER,
  alta: DANGER,
  danger: DANGER,
  // Categoriais (não-semantic) → soft
  civel: SOFT,
  laboral: SOFT,
  criminal: SOFT,
  comercial: SOFT,
  administrativo: SOFT,
  familia: SOFT,
  arbitragem: SOFT,
}

export interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant | string
  className?: string
  icon?: React.ElementType
}

export function Badge({ children, variant = 'default', className, icon: Icon }: BadgeProps) {
  const style = variantStyles[variant.toLowerCase()] || variantStyles.default

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded',
        style,
        className,
      )}
    >
      {Icon && <Icon className="w-3 h-3" />}
      {children}
    </span>
  )
}
