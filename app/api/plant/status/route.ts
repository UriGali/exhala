import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PLANT_SPECIES } from '@/lib/plant-species'

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yzkwoeauwusrklvpxupc.supabase.co'
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const smokerId = searchParams.get('smokerId')
    const smokerIdsParam = searchParams.get('smokerIds')
    const viewerId = searchParams.get('viewerId')

    const targetIds = smokerIdsParam
      ? smokerIdsParam.split(',').map((id) => id.trim()).filter(Boolean)
      : smokerId
      ? [smokerId.trim()]
      : []

    if (targetIds.length === 0) {
      return NextResponse.json({ error: 'smokerId or smokerIds is required' }, { status: 400 })
    }

    const authHeader = request.headers.get('Authorization') || request.headers.get('authorization')
    const clientOptions = authHeader
      ? { global: { headers: { Authorization: authHeader } } }
      : undefined

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, clientOptions)

    // 1. Obtener perfiles de los fumadores consultados
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, role, smoke_free_since')
      .in('id', targetIds)

    const profilesMap = new Map((profiles || []).map((p) => [p.id, p]))

    // 2. Obtener todas las acciones de riego de estos fumadores
    const { data: allWaterActions } = await supabase
      .from('plant_actions')
      .select('id, smoker_id, friend_id, created_at, action_type')
      .in('smoker_id', targetIds)
      .eq('action_type', 'water')
      .order('created_at', { ascending: false })

    // Agrupar riegos por smoker_id
    const waterActionsBySmoker = new Map<string, any[]>()
    allWaterActions?.forEach((act) => {
      const list = waterActionsBySmoker.get(act.smoker_id) || []
      list.push(act)
      waterActionsBySmoker.set(act.smoker_id, list)
    })

    const speciesList = Array.isArray(PLANT_SPECIES) && PLANT_SPECIES.length > 0 ? PLANT_SPECIES : []
    const results: Record<string, any> = {}

    for (const sid of targetIds) {
      const profile = profilesMap.get(sid)
      const smokerActions = waterActionsBySmoker.get(sid) || []

      let baseWaterings = 0
      if (profile?.smoke_free_since) {
        const smokeFreeTime = new Date(profile.smoke_free_since).getTime()
        if (!isNaN(smokeFreeTime)) {
          const daysSince = Math.max(0, Math.floor((Date.now() - smokeFreeTime) / (1000 * 60 * 60 * 24)))
          baseWaterings = Math.max(0, daysSince * 2)
        }
      }

      const actionWaterings = smokerActions.length
      const rawTotalWaterings = baseWaterings + actionWaterings
      const totalWaterings = isNaN(rawTotalWaterings) || rawTotalWaterings < 0 ? 0 : rawTotalWaterings
      const lastWateredAt = smokerActions[0]?.created_at || null

      let canWater = true
      let remainingCooldownSeconds = 0

      if (viewerId) {
        const viewerLastWater = smokerActions.find((a) => a.friend_id === viewerId)
        if (viewerLastWater?.created_at) {
          const lastWaterTime = new Date(viewerLastWater.created_at).getTime()
          if (!isNaN(lastWaterTime)) {
            const diffMs = Date.now() - lastWaterTime
            const twelveHoursMs = 12 * 60 * 60 * 1000
            if (diffMs < twelveHoursMs) {
              canWater = false
              remainingCooldownSeconds = Math.ceil((twelveHoursMs - diffMs) / 1000)
            }
          }
        }
      }

      const speciesIndex = Math.floor(totalWaterings / 30) || 0
      const stage = totalWaterings % 30
      const species =
        speciesList[speciesIndex % speciesList.length] || {
          id: 'bonsai',
          name: 'Bonsái Zen de Jade',
          scientificName: 'Crassula Ovata Zen',
          healingBenefit: 'A los 30 riegos, tus vías respiratorias recuperan su elasticidad natural.',
        }
      const progressPercent = Math.min(100, Math.round((stage / 30) * 100))

      results[sid] = {
        success: true,
        smokerId: sid,
        totalWaterings,
        speciesIndex,
        stage,
        species: {
          id: species.id,
          name: species.name,
          scientificName: species.scientificName,
          healingBenefit: species.healingBenefit,
        },
        progressPercent,
        canWater,
        remainingCooldownSeconds,
        lastWateredAt,
      }
    }

    // Si se solicitó un único smokerId, devolver directamente el objeto por compatibilidad
    if (smokerId && !smokerIdsParam) {
      return NextResponse.json(results[smokerId] || { success: false, error: 'Smoker not found' })
    }

    // Si se solicitaron múltiples, devolver objeto con map 'statuses'
    return NextResponse.json({
      success: true,
      statuses: results,
    })
  } catch (err: any) {
    console.error('[Plant Status API] Error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
