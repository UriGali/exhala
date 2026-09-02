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

    const isDemoSmoker =
      typeof smoker_id === 'string' &&
      (smoker_id.startsWith('00000000-0000-4000-') || smoker_id.startsWith('demo-'))

    if (isDemoSmoker) {
      return NextResponse.json({
        success: true,
        demo: true,
        data: {
          id: 'demo-' + Date.now(),
          smoker_id,
          friend_id,
          action_type,
          created_at: new Date().toISOString(),
        },
      })
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

    // Calcular el nuevo total de riegos para responder con el progreso exacto
    const { data: profile } = await supabase
      .from('profiles')
      .select('smoke_free_since')
      .eq('id', smoker_id)
      .maybeSingle()

    const { count: newWaterCount } = await supabase
      .from('plant_actions')
      .select('created_at', { count: 'exact' })
      .eq('smoker_id', smoker_id)
      .eq('action_type', 'water')

    let baseWaterings = 0
    if (profile?.smoke_free_since) {
      const time = new Date(profile.smoke_free_since).getTime()
      if (!isNaN(time)) {
        const daysSince = Math.max(0, Math.floor((Date.now() - time) / (1000 * 60 * 60 * 24)))
        baseWaterings = Math.max(0, daysSince * 2)
      }
    }

    const wateringsFromDb = typeof newWaterCount === 'number' && !isNaN(newWaterCount) ? newWaterCount : 1
    const rawUpdated = baseWaterings + wateringsFromDb
    const updatedTotalWaterings = isNaN(rawUpdated) || rawUpdated < 0 ? 0 : rawUpdated
    const stage = updatedTotalWaterings % 30
    const progressPercent = Math.min(100, Math.round((stage / 30) * 100))

    return NextResponse.json({
      success: true,
      data,
      totalWaterings: updatedTotalWaterings,
      stage,
      progressPercent,
    })
  } catch (err: any) {
    console.error('[Plant Water API] Error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
