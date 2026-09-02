import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BJPePg3ypQhbXqMu7luASzD-OTyUSjUq67jlA-kmBDpxO2mcGY7aPaekefQJ2pGeHN0htKe55cWMINoVFetJp-g'

const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY || '7hL2FblSDV08rbp-KBLQZZhQP4tFMwJ47q5Ee4Ve35E'

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yzkwoeauwusrklvpxupc.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY

const supabaseAdmin = createClient(SUPABASE_URL, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

// Configure VAPID details for Web Push protocol
try {
  webpush.setVapidDetails('mailto:soporte@exhala.app', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
} catch (e) {
  console.error('[WebPush Service] Error setting VAPID details:', e)
}

export async function sendWebPushToUsers({
  userIds,
  title,
  body,
  url = '/dashboard/friends',
}: {
  userIds: string[]
  title: string
  body: string
  url?: string
}): Promise<{ deliveredTo: number; errors: number }> {
  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return { deliveredTo: 0, errors: 0 }
  }

  const uniqueUserIds = Array.from(new Set(userIds))

  try {
    // 1. Obtener las suscripciones push de los usuarios destino
    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth')
      .in('user_id', uniqueUserIds)

    if (subError || !subscriptions || subscriptions.length === 0) {
      return { deliveredTo: 0, errors: 0 }
    }

    const payload = JSON.stringify({
      title,
      body,
      url,
      timestamp: Date.now(),
    })

    let delivered = 0
    let errCount = 0
    const obsoleteSubscriptionIds: string[] = []

    const sendPromises = subscriptions.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      }

      try {
        await webpush.sendNotification(pushSubscription, payload, {
          TTL: 60 * 60 * 24, // 24 horas
        })
        delivered++
      } catch (err: any) {
        errCount++
        if (err.statusCode === 404 || err.statusCode === 410) {
          obsoleteSubscriptionIds.push(sub.id)
        }
      }
    })

    await Promise.allSettled(sendPromises)

    // Limpiar suscripciones obsoletas en segundo plano
    if (obsoleteSubscriptionIds.length > 0) {
      try {
        await supabaseAdmin
          .from('push_subscriptions')
          .delete()
          .in('id', obsoleteSubscriptionIds)
      } catch {}
    }

    return { deliveredTo: delivered, errors: errCount }
  } catch (err) {
    console.error('[WebPush Service] Error in sendWebPushToUsers:', err)
    return { deliveredTo: 0, errors: 1 }
  }
}
