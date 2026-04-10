'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { api } from '@/lib/api'

type PushStatus = 'unsupported' | 'denied' | 'default' | 'granted' | 'subscribed'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export function usePushNotifications() {
  const { data: session } = useSession()
  const [status, setStatus] = useState<PushStatus>('default')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported')
      return
    }
    setStatus(Notification.permission as PushStatus)
    navigator.serviceWorker.getRegistration('/sw.js').then((reg) => {
      if (reg) {
        reg.pushManager.getSubscription().then((sub) => {
          if (sub) setStatus('subscribed')
        })
      }
    })
  }, [])

  const subscribe = useCallback(async () => {
    if (!session?.accessToken) return
    setLoading(true)
    setError(null)
    try {
      // Register SW
      const registration = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      // Request permission
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus(permission as PushStatus)
        setLoading(false)
        return
      }

      // Get VAPID key
      const vapidRes = await api<{ data: { publicKey: string } }>('/notifications/vapid-public-key', {
        token: session.accessToken,
      })
      const publicKey = (vapidRes as any).data?.publicKey || (vapidRes as any).publicKey
      if (!publicKey) {
        setError('VAPID key not configured')
        setLoading(false)
        return
      }

      // Subscribe
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      })

      // Send to backend
      const subJson = subscription.toJSON() as any
      await api('/notifications/push/subscribe', {
        method: 'POST',
        token: session.accessToken,
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: subJson.keys,
          userAgent: navigator.userAgent,
        }),
      })
      setStatus('subscribed')
    } catch (err: any) {
      setError(err.message || 'Erro ao activar notificacoes push')
    } finally {
      setLoading(false)
    }
  }, [session])

  const unsubscribe = useCallback(async () => {
    if (!session?.accessToken) return
    setLoading(true)
    try {
      const registration = await navigator.serviceWorker.getRegistration('/sw.js')
      if (registration) {
        const subscription = await registration.pushManager.getSubscription()
        if (subscription) await subscription.unsubscribe()
      }
      setStatus('default')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [session])

  return { status, loading, error, subscribe, unsubscribe }
}
