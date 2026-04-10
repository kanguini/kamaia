import * as React from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        'bg-bone rounded-xl p-8 sm:p-12 text-center',
        className,
      )}
    >
      <div
        className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-muted/10 flex items-center justify-center mx-auto mb-4"
        aria-hidden="true"
      >
        <Icon className="w-7 h-7 sm:w-8 sm:h-8 text-muted" />
      </div>
      <h3 className="text-ink font-medium text-base sm:text-lg mb-2">{title}</h3>
      {description && (
        <p className="text-muted text-sm mb-6 max-w-md mx-auto">{description}</p>
      )}
      {action && <div className="flex justify-center">{action}</div>}
    </div>
  )
}
