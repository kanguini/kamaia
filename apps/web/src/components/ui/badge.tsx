'use client'

import { cn } from '@/lib/utils'

type BadgeVariant =
  | 'default'
  | 'activo' | 'suspenso' | 'encerrado' | 'arquivado'
  | 'pendente' | 'cumprido' | 'expirado' | 'cancelado'
  | 'alta' | 'media' | 'baixa'
  | 'civel' | 'laboral' | 'criminal' | 'comercial' | 'administrativo' | 'familia' | 'arbitragem'
  | 'success' | 'warning' | 'danger' | 'info'

const variantStyles: Record<string, string> = {
  default: 'bg-surface-raised text-ink-muted border border-border',
  // Status processo
  activo: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  suspenso: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  encerrado: 'bg-surface-raised text-ink-muted',
  arquivado: 'bg-surface-raised text-ink-muted',
  // Status prazo
  pendente: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  cumprido: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  expirado: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  cancelado: 'bg-surface-raised text-ink-muted',
  // Prioridade
  alta: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  media: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  baixa: 'bg-surface-raised text-ink-muted',
  // Tipo processo
  civel: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  laboral: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  criminal: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  comercial: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  administrativo: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  familia: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  arbitragem: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  // Semantic
  success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  danger: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
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
