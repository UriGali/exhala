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

    // Cooldown de 12 horas: comprobar la última vez que este usuario regó esta planta
    const { data: lastAction } = await supabase
      .from('plant_actions')
      .select('created_at')
      .eq('smoker_id', smoker_id)
      .eq('friend_id', friend_id)
      .eq('action_type', action_type)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastAction?.created_at) {
      const diffMs = Date.now() - new Date(lastAction.created_at).getTime()
      const twelveHoursMs = 12 * 60 * 60 * 1000
      if (diffMs < twelveHoursMs) {
        const remainingSeconds = Math.ceil((twelveHoursMs - diffMs) / 1000)
        return NextResponse.json(
          {
            error: 'Debes esperar 12 horas entre cada riego para esta planta.',
            cooldown: true,
            remainingSeconds,
          },
          { status: 429 }
        )
      }
    }

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
