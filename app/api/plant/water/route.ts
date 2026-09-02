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
    const { smoker_id, friend_id, action_type = 'water' } = body

    if (!smoker_id || !friend_id) {
      return NextResponse.json(
        { error: 'smoker_id and friend_id are required' },
        { status: 400 }
      )
    }

    const clientOptions = authHeader
      ? { global: { headers: { Authorization: authHeader } } }
      : undefined

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, clientOptions)

    const nowIso = new Date().toISOString()
    const { data, error } = await supabase
      .from('plant_actions')
      .insert({
        smoker_id,
        friend_id,
        action_type,
        created_at: nowIso,
      })
      .select()
      .single()

    if (error) {
      console.warn('[Plant Water API] Database insert warning:', error.message)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    console.error('[Plant Water API] Error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
