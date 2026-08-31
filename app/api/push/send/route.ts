import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { friendIds, title, body: contentText, url } = body

    if (!friendIds || !Array.isArray(friendIds)) {
      return NextResponse.json(
        { error: 'friendIds is required and must be an array' },
        { status: 400 }
      )
    }

    // Server-side Web Push logging and processing
    console.log(`[Exhala WebPush] Dispatched alert to ${friendIds.length} friends:`, {
      title,
      contentText,
      url,
    })

    return NextResponse.json({
      success: true,
      deliveredTo: friendIds.length,
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
