'use client'

import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Highlighted AI button for the topbar.
 * Uses a subtle gradient + glow to stand out from neutral actions.
 */
export function AIButton({ className }: { className?: string }) {
  return (
    <Link
      href="/ia-assistente"
      aria-label="IA Assistente"
      className={cn(
        'group relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium',
        'text-white transition-all duration-200',
        'bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500',
        'hover:from-violet-500 hover:via-fuchsia-400 hover:to-pink-400',
        'shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_6px_18px_-4px_rgba(168,85,247,0.45)]',
        'hover:shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_10px_28px_-4px_rgba(168,85,247,0.65)]',
        className,
      )}
    >
      <Sparkles className="w-4 h-4" aria-hidden="true" />
      <span className="hidden sm:inline">IA</span>
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          background:
            'radial-gradient(120% 120% at 50% 0%, rgba(255,255,255,0.18), rgba(255,255,255,0) 60%)',
        }}
      />
    </Link>
  )
}
