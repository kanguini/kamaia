'use client'

import { createContext, useContext, useCallback, useState } from 'react'

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  message: string
  variant: ToastVariant
  duration: number
}

export interface ToastContextValue {
  toasts: Toast[]
  addToast: (message: string, variant?: ToastVariant, duration?: number) => void
  removeToast: (id: string) => void
  success: (message: string) => void
  error: (message: string) => void
  warning: (message: string) => void
  info: (message: string) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

export function useToastState(): ToastContextValue {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback(
    (message: string, variant: ToastVariant = 'info', duration?: number) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const defaultDuration = variant === 'error' ? 5000 : 3000
      const toast: Toast = { id, message, variant, duration: duration ?? defaultDuration }

      setToasts((prev) => [...prev, toast])

      setTimeout(() => {
        removeToast(id)
      }, toast.duration)
    },
    [removeToast],
  )

  const success = useCallback((msg: string) => addToast(msg, 'success'), [addToast])
  const error = useCallback((msg: string) => addToast(msg, 'error'), [addToast])
  const warning = useCallback((msg: string) => addToast(msg, 'warning'), [addToast])
  const info = useCallback((msg: string) => addToast(msg, 'info'), [addToast])

  return { toasts, addToast, removeToast, success, error, warning, info }
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
