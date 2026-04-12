'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface FormFieldProps {
  label: string
  htmlFor?: string
  error?: string
  hint?: string
  required?: boolean
  children: React.ReactNode
  className?: string
}

/**
 * Accessible form field wrapper. Associates label, error, and hint with the input
 * via aria-describedby and aria-invalid.
 *
 * Pass a pre-configured input as children. This component only renders the label,
 * error message, and hint — it does NOT render the input itself.
 *
 * To fully wire up aria attributes, use the returned ids:
 *   const { inputId, errorId, hintId } = useFormFieldIds()
 */
export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: FormFieldProps) {
  const generatedId = React.useId()
  const fieldId = htmlFor || generatedId
  const errorId = `${fieldId}-error`
  const hintId = `${fieldId}-hint`

  return (
    <div className={cn('space-y-1', className)}>
      <label
        htmlFor={fieldId}
        className="block text-[11px] font-medium text-ink-secondary tracking-[0.03em]"
      >
        {label}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p id={hintId} className="text-xs text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
