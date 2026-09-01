import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

// VAPID keys configuration with fallback
const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BJPePg3ypQhbXqMu7luASzD-OTyUSjUq67jlA-kmBDpxO2mcGY7aPaekefQJ2pGeHN0htKe55cWMINoVFetJp-g'

const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY || '7hL2FblSDV08rbp-KBLQZZhQP4tFMwJ47q5Ee4Ve35E'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yzkwoeauwusrklvpxupc.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Initialize Supabase Admin client using Service Role key to bypass RLS, falling back to anon key
const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY
if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    '[WebPush API] WARNING: SUPABASE_SERVICE_ROLE_KEY is not defined. Falling back to anon key. Push subscriptions query might be restricted by Supabase Row Level Security (RLS).'
  )
}

const supabaseAdmin = createClient(SUPABASE_URL, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

// Configure VAPID details for Web Push protocol
try {
  webpush.setVapidDetails(
    'mailto:soporte@exhala.app',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  )
} catch (e) {
  console.error('[WebPush API] Error setting VAPID details:', e)
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

    // Query active device subscriptions for all targeted friends (bypassing RLS with Admin client)
    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth')
      .in('user_id', friendIds)

    if (subError) {
      console.error('[WebPush API] Error fetching subscriptions from DB:', subError)
      return NextResponse.json(
        { error: 'Failed to retrieve push subscriptions', details: subError.message },
        { status: 500 }
      )
    }

    const payload = JSON.stringify({
      title: title || '🚨 Exhala — Alerta',
      body: contentText || 'Tienes una nueva notificación en Exhala.',
      url: url || '/dashboard/friends',
      timestamp: Date.now(),
    })

    let deliveredCount = 0
    const deadSubscriptionIds: string[] = []

    if (subscriptions && subscriptions.length > 0) {
      const sendPromises = subscriptions.map(async (sub) => {
        if (!sub.endpoint || !sub.p256dh || !sub.auth) {
          return
        }

        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        }

        try {
          await webpush.sendNotification(pushSubscription, payload, {
            TTL: 86400, // 24 hours
            urgency: 'high',
          })
          deliveredCount++
        } catch (err: any) {
          const statusCode = err?.statusCode || err?.status
          console.warn(
            `[WebPush API] Failed dispatching to endpoint ${sub.endpoint.slice(0, 35)}...: Status ${statusCode} (${err.message})`
          )

          // 410 Gone or 404 Not Found indicates an expired, unregistered, or revoked subscription
          if (statusCode === 410 || statusCode === 404) {
            deadSubscriptionIds.push(sub.id)
          }
        }
      })

      await Promise.allSettled(sendPromises)

      // Automatic cleanup: Remove expired / dead endpoints from push_subscriptions
      if (deadSubscriptionIds.length > 0) {
        console.log(
          `[WebPush API] Cleaning up ${deadSubscriptionIds.length} expired push subscription(s)...`
        )
        const { error: deleteError } = await supabaseAdmin
          .from('push_subscriptions')
          .delete()
          .in('id', deadSubscriptionIds)

        if (deleteError) {
          console.error('[WebPush API] Error removing dead subscriptions:', deleteError)
        }
      }
    }

    console.log(
      `[WebPush API] Summary: Delivered to ${deliveredCount}/${subscriptions?.length || 0} subscriptions across ${friendIds.length} target friend(s).`
    )

    return NextResponse.json({
      success: true,
      deliveredTo: deliveredCount,
      totalSubscriptions: subscriptions?.length || 0,
      cleanedUpDeadEndpoints: deadSubscriptionIds.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[WebPush API] Internal Server Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}
