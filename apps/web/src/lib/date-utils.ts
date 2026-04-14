/**
 * Centralized date formatting utilities for Kamaia.
 * All dates displayed in pt-AO locale, WAT timezone (UTC+1).
 */

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('pt-AO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatDateTime(date: Date | string): string {
  const d = new Date(date)
  return `${d.toLocaleDateString('pt-AO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })} ${d.toLocaleTimeString('pt-AO', {
    hour: '2-digit',
    minute: '2-digit',
  })}`
}

export function formatRelativeTime(date: Date | string): string {
  const now = new Date()
  const d = new Date(date)
  const diff = d.getTime() - now.getTime()
  const diffAbs = Math.abs(diff)

  const minutes = Math.floor(diffAbs / (1000 * 60))
  const hours = Math.floor(diffAbs / (1000 * 60 * 60))
  const days = Math.floor(diffAbs / (1000 * 60 * 60 * 24))

  const prefix = diff < 0 ? 'ha' : 'em'

  if (minutes < 1) return 'agora'
  if (minutes < 60) return `${prefix} ${minutes} min`
  if (hours < 24) return `${prefix} ${hours}h`
  if (days === 1) return diff < 0 ? 'ontem' : 'amanha'
  if (days < 30) return `${prefix} ${days} dias`
  if (days < 365) return `${prefix} ${Math.floor(days / 30)} meses`
  return `${prefix} ${Math.floor(days / 365)} anos`
}

export function formatMonthYear(date: Date | string): string {
  return new Date(date).toLocaleDateString('pt-AO', {
    month: 'long',
    year: 'numeric',
  })
}

export function isOverdue(date: Date | string): boolean {
  return new Date(date) < new Date()
}

export function daysUntil(date: Date | string): number {
  const diff = new Date(date).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}
