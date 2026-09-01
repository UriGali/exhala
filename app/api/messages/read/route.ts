import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yzkwoeauwusrklvpxupc.supabase.co'
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization') || request.headers.get('authorization')
    const body = await request.json()
    const { senderId, receiverId } = body

    if (!senderId || !receiverId) {
      return NextResponse.json(
        { error: 'senderId and receiverId are required' },
        { status: 400 }
      )
    }

    const clientOptions = authHeader
      ? { global: { headers: { Authorization: authHeader } } }
      : undefined

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, clientOptions)

    const { data, error } = await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('sender_id', senderId)
      .eq('receiver_id', receiverId)
      .is('read_at', null)
      .select('id')

    if (error) {
      console.warn('[Messages] Error marking messages as read in DB:', error.message)
    }

    return NextResponse.json({ success: true, updatedCount: data?.length || 0 })
  } catch (err: any) {
    console.warn('[Messages] Error handling read request:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 200 })
  }
}
