'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'w-full px-3 py-2 rounded-lg border border-border bg-surface text-ink text-sm',
          'placeholder:text-ink-muted/50',
          'focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink/40',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'transition-colors',
          className,
        )}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'w-full px-3 py-2 rounded-lg border border-border bg-surface text-ink text-sm',
          'placeholder:text-ink-muted/50',
          'focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink/40',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'transition-colors resize-none',
          className,
        )}
        {...props}
      />
    )
  },
)
Textarea.displayName = 'Textarea'

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'w-full px-3 py-2 rounded-lg border border-border bg-surface text-ink text-sm',
          'focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink/40',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'transition-colors',
          className,
        )}
        {...props}
      >
        {children}
      </select>
    )
  },
)
Select.displayName = 'Select'
