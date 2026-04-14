'use client'

import * as React from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { ToastContext, useToastState, type Toast, type ToastVariant } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

const variantStyles: Record<ToastVariant, string> = {
  success: 'border-green-500/30 bg-green-50 text-green-900 dark:bg-green-950/50 dark:text-green-200 dark:border-green-500/20',
  error: 'border-red-500/30 bg-red-50 text-red-900 dark:bg-red-950/50 dark:text-red-200 dark:border-red-500/20',
  warning: 'border-amber-500/30 bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-500/20',
  info: 'border-blue-500/30 bg-blue-50 text-blue-900 dark:bg-blue-950/50 dark:text-blue-200 dark:border-blue-500/20',
}

const variantIcons: Record<ToastVariant, React.ElementType> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const Icon = variantIcons[toast.variant]

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg backdrop-blur-sm',
        'animate-in slide-in-from-right-full duration-300',
        'min-w-[300px] max-w-[420px]',
        variantStyles[toast.variant],
      )}
    >
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <p className="text-sm flex-1">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 p-0.5 rounded opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Fechar"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

function ToastContainer() {
  const ctx = React.useContext(ToastContext)
  if (!ctx) return null

  return (
    <div
      className="fixed bottom-4 right-4 z-[60] flex flex-col-reverse gap-2 pointer-events-none"
      aria-live="polite"
      aria-label="Notificacoes"
    >
      {ctx.toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onDismiss={ctx.removeToast} />
        </div>
      ))}
    </div>
  )
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const toastState = useToastState()

  return (
    <ToastContext.Provider value={toastState}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  )
}
