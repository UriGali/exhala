import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BJPePg3ypQhbXqMu7luASzD-OTyUSjUq67jlA-kmBDpxO2mcGY7aPaekefQJ2pGeHN0htKe55cWMINoVFetJp-g'

const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY || '7hL2FblSDV08rbp-KBLQZZhQP4tFMwJ47q5Ee4Ve35E'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yzkwoeauwusrklvpxupc.supabase.co'
const SUPABASE_SERVICE_ROLE_OR_ANON =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Configurar credenciales VAPID
try {
  webpush.setVapidDetails(
    'mailto:soporte@exhala.app',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  )
} catch (e) {
  console.warn('Error setting VAPID details:', e)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { friendIds, title, body: contentText, url } = body

    if (!friendIds || !Array.isArray(friendIds) || friendIds.length === 0) {
      return NextResponse.json(
        { error: 'friendIds is required and must be a non-empty array' },
        { status: 400 }
      )
    }

    // Instanciar cliente Supabase para consultar suscripciones activas
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_OR_ANON)

    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', friendIds)

    if (subError) {
      console.error('[WebPush] Error fetching subscriptions:', subError)
    }

    const payload = JSON.stringify({
      title: title || '🌿 Exhala',
      body: contentText || 'Tienes una nueva notificación en Exhala.',
      url: url || '/dashboard/friends',
    })

    let deliveredCount = 0
    const failedEndpointIds: string[] = []

    if (subscriptions && subscriptions.length > 0) {
      const sendPromises = subscriptions.map(async (sub) => {
        if (!sub.endpoint || !sub.p256dh || !sub.auth) return

        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        }

        try {
          await webpush.sendNotification(pushSubscription, payload, {
            TTL: 86400, // 24 horas
            urgency: 'high',
          })
          deliveredCount++
        } catch (err: any) {
          console.warn(`[WebPush] Failed sending to endpoint ${sub.endpoint.slice(0, 30)}:`, err.statusCode || err.message)
          // 410 Gone / 404 Not Found -> Suscripción expirada en el dispositivo
          if (err.statusCode === 410 || err.statusCode === 404) {
            failedEndpointIds.push(sub.id)
          }
        }
      })

      await Promise.allSettled(sendPromises)

      // Limpiar suscripciones inválidas/antiguas
      if (failedEndpointIds.length > 0) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .in('id', failedEndpointIds)
      }
    }

    console.log(`[WebPush] Dispatched push to ${deliveredCount}/${subscriptions?.length || 0} devices for users:`, friendIds)

    return NextResponse.json({
      success: true,
      deliveredTo: deliveredCount,
      totalSubscriptions: subscriptions?.length || 0,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[Exhala WebPush] Error sending push notification:', error)
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}
