import { supabase } from '@/lib/supabase/client'

export const DEFAULT_VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BJPePg3ypQhbXqMu7luASzD-OTyUSjUq67jlA-kmBDpxO2mcGY7aPaekefQJ2pGeHN0htKe55cWMINoVFetJp-g'

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

// Utility to convert VAPID public key to Uint8Array
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'Notification' in window &&
    'PushManager' in window
  )
}

export function getPushPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission
}

/**
 * Register Service Worker and request browser push notification permission.
 * Saves the real subscription keys (endpoint, p256dh, auth) to Supabase table push_subscriptions.
 */
export async function requestPushPermissionAndSubscribe(
  userId: string
): Promise<{ success: boolean; permission: string; error?: string }> {
  if (!isPushSupported()) {
    return {
      success: false,
      permission: 'unsupported',
      error: 'Tu navegador o dispositivo no soporta notificaciones push.',
    }
  }

  try {
    // 1. Register Service Worker
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
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

    // 3. Obtain or create PushSubscription using real VAPID key
    let subscription = await registration.pushManager.getSubscription()

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(DEFAULT_VAPID_PUBLIC_KEY),
      })
    }

    // 4. Extract push credentials
    const endpoint = subscription.endpoint
    const p256dh = arrayBufferToBase64(subscription.getKey('p256dh'))
    const auth = arrayBufferToBase64(subscription.getKey('auth'))

    if (!endpoint || !p256dh || !auth) {
      throw new Error('No se pudieron obtener las credenciales de push del navegador.')
    }

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
          body: 'Notificaciones activadas. Recibirás avisos de tus amigos en tiempo real.',
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
    // 1. Fetch friend IDs (both smoker -> friend and friend -> smoker)
    const { data: friendships } = await supabase
      .from('friendships')
      .select('friend_id, smoker_id')
      .or(`smoker_id.eq.${userId},friend_id.eq.${userId}`)
      .eq('status', 'accepted')

    if (!friendships || friendships.length === 0) {
      return { success: true, dispatchedCount: 0 }
    }

    const friendIds = friendships.map((f) => (f.smoker_id === userId ? f.friend_id : f.smoker_id))
    const uniqueFriendIds = Array.from(new Set(friendIds))

    const { data: { session } } = await supabase.auth.getSession()

    // 2. Call server push dispatch endpoint
    const response = await fetch('/api/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({
        friendIds: uniqueFriendIds,
        title: '🚨 ¡Alerta SOS de Exhala!',
        body: `${userName} necesita tu apoyo urgente en este momento. ¡Entra a animarle!`,
        url: '/dashboard/friends',
      }),
    })

    const resData = await response.json().catch(() => ({}))

    return { success: true, dispatchedCount: resData?.deliveredTo || uniqueFriendIds.length }
  } catch (err) {
    console.error('Error dispatching push alerts to friends:', err)
    return { success: false, dispatchedCount: 0 }
  }
}

/**
 * Dispatches Push Notification for a single chat message.
 */
export async function dispatchPushMessageToFriend(
  friendId: string,
  senderName: string,
  messageContent: string
): Promise<{ success: boolean }> {
  try {
    const { data: { session } } = await supabase.auth.getSession()

    const response = await fetch('/api/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({
        friendIds: [friendId],
        title: `💬 Mensaje de ${senderName}`,
        body: messageContent,
        url: '/dashboard/friends',
      }),
    })

    const data = await response.json().catch(() => ({}))
    return { success: !!data?.success }
  } catch (err) {
    console.warn('Error dispatching chat push:', err)
    return { success: false }
  }
}

/**
 * Dispatches Push Notification to friends when a user uploads a story.
 */
export async function dispatchPushStoryNotification(
  userId: string,
  userName: string,
  caption?: string
): Promise<{ success: boolean }> {
  try {
    const { data: friendships } = await supabase
      .from('friendships')
      .select('friend_id, smoker_id')
      .or(`smoker_id.eq.${userId},friend_id.eq.${userId}`)
      .eq('status', 'accepted')

    if (!friendships || friendships.length === 0) return { success: true }

    const friendIds = Array.from(
      new Set(
        friendships
          .map((f) => (f.smoker_id === userId ? f.friend_id : f.smoker_id))
          .filter((id) => id && id !== userId)
      )
    )

    if (friendIds.length === 0) return { success: true }

    const { data: { session } } = await supabase.auth.getSession()

    const response = await fetch('/api/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({
        friendIds,
        title: `📸 ¡Nueva historia de ${userName}!`,
        body: caption?.trim()
          ? `${userName}: "${caption.trim()}"`
          : `${userName} ha subido una nueva foto a su historia. ¡Toca para verla!`,
        url: '/dashboard/friends',
      }),
    })

    const data = await response.json().catch(() => ({}))
    return { success: !!data?.success }
  } catch (err) {
    console.warn('Error dispatching story push:', err)
    return { success: false }
  }
}

/**
 * Dispatches Push Notification when a group is created.
 */
export async function dispatchPushGroupCreated(
  creatorName: string,
  groupName: string,
  targetMemberIds: string[]
): Promise<{ success: boolean }> {
  try {
    if (!targetMemberIds || targetMemberIds.length === 0) return { success: true }

    const { data: { session } } = await supabase.auth.getSession()

    const response = await fetch('/api/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({
        friendIds: targetMemberIds,
        title: `👥 Nuevo grupo: ${groupName}`,
        body: `${creatorName} te ha añadido al grupo "${groupName}". ¡Entra a saludar!`,
        url: '/dashboard/friends',
      }),
    })

    const data = await response.json().catch(() => ({}))
    return { success: !!data?.success }
  } catch (err) {
    console.warn('Error dispatching group created push:', err)
    return { success: false }
  }
}

/**
 * Dispatches Push Notification when a message is sent in a group.
 */
export async function dispatchPushGroupMessage(
  senderName: string,
  groupName: string,
  content: string,
  targetMemberIds: string[]
): Promise<{ success: boolean }> {
  try {
    if (!targetMemberIds || targetMemberIds.length === 0) return { success: true }

    const { data: { session } } = await supabase.auth.getSession()

    const response = await fetch('/api/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({
        friendIds: targetMemberIds,
        title: `💬 ${groupName}: ${senderName}`,
        body: content,
        url: '/dashboard/friends',
      }),
    })

    const data = await response.json().catch(() => ({}))
    return { success: !!data?.success }
  } catch (err) {
    console.warn('Error dispatching group message push:', err)
    return { success: false }
  }
}