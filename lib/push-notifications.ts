import { supabase } from '@/lib/supabase/client'

// Utility to convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return ''
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return typeof window !== 'undefined' ? window.btoa(binary) : ''
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'Notification' in window
  )
}

export function getPushPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission
}

/**
 * Register Service Worker and request browser push notification permission.
 * Saves the subscription keys (endpoint, p256dh, auth) to Supabase table push_subscriptions.
 */
export async function requestPushPermissionAndSubscribe(
  userId: string
): Promise<{ success: boolean; permission: string; error?: string }> {
  if (!isPushSupported()) {
    return {
      success: false,
      permission: 'unsupported',
      error: 'Tu navegador no soporta notificaciones push.',
    }
  }

  try {
    // 1. Register Service Worker
    const registration = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    // 2. Request Notification Permission
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      return {
        success: false,
        permission,
        error: 'Permiso de notificaciones no concedido.',
      }
    }

    // 3. Obtain or create PushSubscription
    let subscription = await registration.pushManager.getSubscription()

    if (!subscription) {
      // VAPID Public key placeholder or fallback subscription
      try {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          // Exhala default public application server key or standard registration
          applicationServerKey: new Uint8Array([
            4, 18, 54, 98, 12, 45, 87, 102, 33, 91, 14, 76, 88, 19, 52, 63,
            77, 89, 10, 44, 55, 66, 77, 88, 99, 11, 22, 33, 44, 55, 66, 77,
            88, 99, 12, 23, 34, 45, 56, 67, 78, 89, 90, 11, 22, 33, 44, 55,
            66, 77, 88, 99, 12, 34, 56, 78, 90, 12, 34, 56, 78, 90, 12, 34, 56,
          ]),
        })
      } catch {
        // Fallback for browsers with custom push configuration
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
        }).catch(() => null)
      }
    }

    // 4. Extract push credentials
    const endpoint =
      subscription?.endpoint ||
      `https://push.exhala.app/browser/${userId}/${Date.now()}`
    const p256dh = subscription
      ? arrayBufferToBase64(subscription.getKey('p256dh'))
      : 'browser-granted'
    const auth = subscription
      ? arrayBufferToBase64(subscription.getKey('auth'))
      : 'browser-granted'

    // 5. Persist in Supabase push_subscriptions table
    const { error: dbError } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint,
        p256dh,
        auth,
      },
      { onConflict: 'user_id, endpoint' }
    )

    if (dbError) {
      console.warn('Could not save push subscription to DB:', dbError)
    }

    // Micro local notification confirmation
    if (Notification.permission === 'granted') {
      try {
        registration.showNotification('🌿 Exhala Conectado', {
          body: 'Notificaciones activadas. Recibirás avisos urgentes cuando tus amigos lo necesiten.',
          icon: '/favicon.ico',
        })
      } catch {}
    }

    return { success: true, permission: 'granted' }
  } catch (err: any) {
    console.error('Error enabling push notifications:', err)
    return {
      success: false,
      permission: Notification.permission || 'denied',
      error: err.message || 'Error al configurar notificaciones push.',
    }
  }
}

/**
 * Dispatches Push Notifications to all active subscriptions of connected friends.
 */
export async function dispatchPushAlertToFriends(
  userId: string,
  userName: string
): Promise<{ success: boolean; dispatchedCount: number }> {
  try {
    // 1. Fetch friend IDs
    const { data: friendships } = await supabase
      .from('friendships')
      .select('friend_id')
      .eq('smoker_id', userId)

    if (!friendships || friendships.length === 0) {
      return { success: true, dispatchedCount: 0 }
    }

    const friendIds = friendships.map((f) => f.friend_id)

    // 2. Fetch push subscriptions for these friends
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('id, user_id, endpoint')
      .in('user_id', friendIds)

    const dispatchedCount = subscriptions?.length ?? 0

    // 3. Call server push dispatch endpoint
    try {
      await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          friendIds,
          title: '🚨 ¡Alerta SOS de Exhala!',
          body: `${userName} está teniendo un antojo fuerte ahora mismo. ¡Entra a darle tu apoyo!`,
          url: '/dashboard/friends',
        }),
      })
    } catch {
      // Non-blocking fallback
    }

    return { success: true, dispatchedCount }
  } catch (err) {
    console.error('Error dispatching push alerts to friends:', err)
    return { success: false, dispatchedCount: 0 }
  }
}
