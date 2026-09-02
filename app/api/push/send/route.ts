import { NextResponse } from 'next/server'
import { sendWebPushToUsers } from '@/lib/push-service'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { friendIds, userIds, title, body: contentText, url } = body
    const targets = userIds || friendIds

    if (!targets || !Array.isArray(targets) || targets.length === 0) {
      return NextResponse.json(
        { error: 'userIds or friendIds is required and must be a non-empty array' },
        { status: 400 }
      )
    }

    const { deliveredTo, errors } = await sendWebPushToUsers({
      userIds: targets,
      title: title || '🌿 Exhala',
      body: contentText || 'Tienes una nueva notificación en Exhala.',
      url: url || '/dashboard/friends',
    })

    return NextResponse.json({
      success: true,
      deliveredTo,
      errors,
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
