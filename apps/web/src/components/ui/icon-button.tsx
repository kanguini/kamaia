import * as React from 'react'
import { cn } from '@/lib/utils'

type Size = 'sm' | 'md' | 'lg'
type Variant = 'default' | 'ghost' | 'danger'

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** REQUIRED: label for screen readers. */
  'aria-label': string
  size?: Size
  variant?: Variant
}

const sizeClasses: Record<Size, string> = {
  sm: 'w-9 h-9 p-2',
  md: 'w-10 h-10 p-2.5',
  lg: 'w-12 h-12 p-3',
}

const variantClasses: Record<Variant, string> = {
  default: 'text-ink bg-bone hover:bg-border',
  ghost: 'text-muted hover:text-ink hover:bg-bone',
  danger: 'text-error hover:bg-error/10',
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, size = 'md', variant = 'ghost', type = 'button', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'inline-flex items-center justify-center rounded-lg transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-2 focus-visible:ring-offset-paper',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          sizeClasses[size],
          variantClasses[variant],
          className,
        )}
        {...props}
      >
        <span aria-hidden="true" className="flex items-center justify-center">
          {children}
        </span>
      </button>
    )
  },
)

IconButton.displayName = 'IconButton'
