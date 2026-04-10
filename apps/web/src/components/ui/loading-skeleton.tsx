import * as React from 'react'
import { cn } from '@/lib/utils'

export interface LoadingSkeletonProps {
  /** How many skeleton rows to render. */
  count?: number
  /** Label for screen readers (default: "A carregar"). */
  label?: string
  /** Additional className for the container. */
  className?: string
  /** Custom row className to override default height/styles. */
  rowClassName?: string
}

export function LoadingSkeleton({
  count = 5,
  label = 'A carregar',
  className,
  rowClassName,
}: LoadingSkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={cn('space-y-3', className)}
    >
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-16 bg-bone rounded-lg motion-safe:animate-pulse',
            rowClassName,
          )}
          aria-hidden="true"
        />
      ))}
    </div>
  )
}

/** Inline single-line skeleton for text placeholders. */
export function SkeletonText({ className }: { className?: string }) {
  return (
    <div
      className={cn('h-4 bg-bone rounded motion-safe:animate-pulse', className)}
      aria-hidden="true"
    />
  )
}
