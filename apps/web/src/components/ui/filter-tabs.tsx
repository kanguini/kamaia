'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface FilterTab<T extends string> {
  value: T
  label: string
  count?: number
}

export interface FilterTabsProps<T extends string> {
  value: T
  onChange: (value: T) => void
  tabs: FilterTab<T>[]
  label?: string
  className?: string
}

export function FilterTabs<T extends string>({
  value,
  onChange,
  tabs,
  label = 'Filtros',
  className,
}: FilterTabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        'flex gap-2 overflow-x-auto pb-1 -mb-1',
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = tab.value === value
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.value)}
            className={cn(
              'px-4 py-2 text-sm font-medium whitespace-nowrap min-h-[40px]',
              'motion-safe:transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
              active
                ? 'bg-white text-[#070707]'
                : 'bg-surface-raised text-ink-muted hover:text-ink-secondary hover:bg-surface-hover',
            )}
          >
            {tab.label}
            {typeof tab.count === 'number' && (
              <span
                className={cn(
                  'ml-2 inline-flex items-center justify-center text-xs font-mono px-1.5 py-0.5 min-w-[20px]',
                  active ? 'bg-white/20 text-white' : 'bg-white text-ink-muted',
                )}
                aria-hidden="true"
              >
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
