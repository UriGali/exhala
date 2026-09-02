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
    const viewerId = searchParams.get('viewerId')

    if (!smokerId) {
      return NextResponse.json({ error: 'smokerId is required' }, { status: 400 })
    }

    const authHeader = request.headers.get('Authorization') || request.headers.get('authorization')
    const clientOptions = authHeader
      ? { global: { headers: { Authorization: authHeader } } }
      : undefined

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, clientOptions)

    // 1. Obtener perfil del fumador (para ver smoke_free_since y nombre)
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, role, smoke_free_since')
      .eq('id', smokerId)
      .maybeSingle()

    // 2. Obtener total de riegos registrados en plant_actions
    const { count: waterCount, data: lastWaterList } = await supabase
      .from('plant_actions')
      .select('created_at', { count: 'exact' })
      .eq('smoker_id', smokerId)
      .eq('action_type', 'water')
      .order('created_at', { ascending: false })
      .limit(1)

    // Base según días limpios (2 riegos por cada día sin fumar)
    let baseWaterings = 0
    if (profile?.smoke_free_since) {
      const smokeFreeTime = new Date(profile.smoke_free_since).getTime()
      if (!isNaN(smokeFreeTime)) {
        const daysSince = Math.max(0, Math.floor((Date.now() - smokeFreeTime) / (1000 * 60 * 60 * 24)))
        baseWaterings = Math.max(0, daysSince * 2)
      }
    }

    // Cada riego en plant_actions le suma 1 riego más a lo que lleva acumulado
    const actionWaterings = typeof waterCount === 'number' && !isNaN(waterCount) ? waterCount : 0
    const rawTotalWaterings = baseWaterings + actionWaterings
    const totalWaterings = isNaN(rawTotalWaterings) || rawTotalWaterings < 0 ? 0 : rawTotalWaterings

    const lastWateredAt = lastWaterList?.[0]?.created_at || null

    // 3. Cooldown del visor (viewerId)
    let canWater = true
    let remainingCooldownSeconds = 0

    if (viewerId) {
      const { data: viewerLastWater } = await supabase
        .from('plant_actions')
        .select('created_at')
        .eq('smoker_id', smokerId)
        .eq('friend_id', viewerId)
        .eq('action_type', 'water')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

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

    // 4. Calcular especie y etapa (30 riegos por espécimen)
    const speciesIndex = Math.floor(totalWaterings / 30) || 0
    const stage = totalWaterings % 30
    const speciesList = Array.isArray(PLANT_SPECIES) && PLANT_SPECIES.length > 0 ? PLANT_SPECIES : []
    const species =
      speciesList[speciesIndex % speciesList.length] || {
        id: 'bonsai',
        name: 'Bonsái Zen de Jade',
        scientificName: 'Crassula Ovata Zen',
        healingBenefit: 'A los 30 riegos, tus vías respiratorias recuperan su elasticidad natural.',
      }
    const progressPercent = Math.min(100, Math.round((stage / 30) * 100))

    return NextResponse.json({
      success: true,
      smokerId,
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
    })
  } catch (err: any) {
    console.error('[Plant Status API] Error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
