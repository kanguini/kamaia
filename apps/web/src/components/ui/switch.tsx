'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  label: string
  description?: string
  className?: string
}

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  label,
  description,
  className,
}: SwitchProps) {
  const descId = React.useId()
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-describedby={description ? descId : undefined}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 flex-shrink-0 items-center motion-safe:transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        checked ? '[background:var(--color-btn-primary-bg)]' : 'bg-border',
        className,
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform shadow-sm motion-safe:transition-transform',
          checked ? '[background:var(--color-btn-primary-text)]' : 'bg-ink-muted',
          checked ? 'translate-x-6' : 'translate-x-1',
        )}
        aria-hidden="true"
      />
      {description && (
        <span id={descId} className="sr-only">
          {description}
        </span>
      )}
    </button>
  )
}
