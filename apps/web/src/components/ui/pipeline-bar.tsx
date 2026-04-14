'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LIFECYCLE_STAGES, LIFECYCLE_LABELS } from '@kamaia/shared-types'

interface PipelineBarProps {
  currentStage: string
  onAdvance?: (stage: string) => void
  disabled?: boolean
}

export function PipelineBar({ currentStage, onAdvance, disabled }: PipelineBarProps) {
  const currentIndex = LIFECYCLE_STAGES.indexOf(currentStage as any)

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {LIFECYCLE_STAGES.map((stage, index) => {
        const isPast = index < currentIndex
        const isCurrent = index === currentIndex
        const isFuture = index > currentIndex
        const isNext = index === currentIndex + 1

        return (
          <button
            key={stage}
            onClick={() => {
              if (isNext && onAdvance && !disabled) onAdvance(stage)
            }}
            disabled={disabled || !isNext}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg whitespace-nowrap transition-all',
              isPast && 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
              isCurrent && 'bg-ink text-surface ring-2 ring-ink/20',
              isFuture && !isNext && 'bg-surface-raised text-ink-muted cursor-default',
              isNext && !disabled && 'bg-surface-raised text-ink-muted hover:bg-ink/10 hover:text-ink cursor-pointer border border-dashed border-ink/20',
            )}
          >
            {isPast && <Check className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{LIFECYCLE_LABELS[stage]}</span>
            <span className="sm:hidden">{(index + 1)}</span>
          </button>
        )
      })}
    </div>
  )
}
