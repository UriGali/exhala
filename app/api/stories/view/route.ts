import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yzkwoeauwusrklvpxupc.supabase.co'
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// GET: Obtener lista de amigos que han visto una historia específica
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const storyId = searchParams.get('storyId')
    const authHeader = request.headers.get('Authorization') || request.headers.get('authorization')

    if (!storyId) {
      return NextResponse.json({ error: 'storyId is required' }, { status: 400 })
    }

    const clientOptions = authHeader
      ? { global: { headers: { Authorization: authHeader } } }
      : undefined

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, clientOptions)

    // Consultar visualizaciones de la historia
    const { data: views, error: viewsError } = await supabase
      .from('story_views')
      .select('id, viewer_id, viewed_at')
      .eq('story_id', storyId)
      .order('viewed_at', { ascending: false })

    if (viewsError) {
      console.warn('[Stories VIEW GET API] Notice:', viewsError.message)
      return NextResponse.json({
        success: true,
        viewers: [],
        viewsCount: 0,
      })
    }

    if (!views || views.length === 0) {
      return NextResponse.json({
        success: true,
        viewers: [],
        viewsCount: 0,
      })
    }

    // Obtener perfiles de los usuarios que la vieron
    const viewerIds = views.map((v) => v.viewer_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, role')
      .in('id', viewerIds)

    const profileMap = new Map<string, any>()
    profiles?.forEach((p) => profileMap.set(p.id, p))

    const viewers = views.map((v) => {
      const prof = profileMap.get(v.viewer_id)
      const fullName = prof?.full_name || 'Compañero'
      const initials = fullName
        .split(' ')
        .filter(Boolean)
        .map((n: string) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'AM'

      return {
        id: v.viewer_id,
        name: fullName,
        initials,
        avatarUrl: prof?.avatar_url || null,
        role: prof?.role || 'smoker',
        viewedAt: v.viewed_at,
      }
    })

    return NextResponse.json({
      success: true,
      viewers,
      viewsCount: viewers.length,
    })
  } catch (err: any) {
    console.error('[Stories VIEW GET API] Error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

// POST: Registrar que un usuario ha visto una historia
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization') || request.headers.get('authorization')
    const body = await request.json()
    const { storyId, viewerId } = body

    if (!storyId || !viewerId) {
      return NextResponse.json(
        { error: 'storyId and viewerId are required' },
        { status: 400 }
      )
    }

    const clientOptions = authHeader
      ? { global: { headers: { Authorization: authHeader } } }
      : undefined

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, clientOptions)

    // 1. Verificar si la historia es del propio usuario
    const { data: story, error: storyError } = await supabase
      .from('stories')
      .select('id, user_id')
      .eq('id', storyId)
      .maybeSingle()

    if (storyError) {
      console.warn('[Stories VIEW POST API] Story check notice:', storyError.message)
    }

    // Si el usuario es el dueño de la historia, no la registramos como vista de amigo
    if (story && story.user_id === viewerId) {
      return NextResponse.json({
        success: true,
        isOwner: true,
        recorded: false,
      })
    }

    // 2. Insertar o actualizar la visualización en story_views
    const nowIso = new Date().toISOString()
    const { data, error: insertError } = await supabase
      .from('story_views')
      .upsert(
        {
          story_id: storyId,
          viewer_id: viewerId,
          viewed_at: nowIso,
        },
        { onConflict: 'story_id,viewer_id' }
      )
      .select()

    if (insertError) {
      console.warn('[Stories VIEW POST API] Upsert notice, attempting direct insert:', insertError.message)
      // Fallback a insert directo
      const { data: insertFallback, error: fbError } = await supabase
        .from('story_views')
        .insert({
          story_id: storyId,
          viewer_id: viewerId,
          viewed_at: nowIso,
        })
        .select()

      if (fbError && !fbError.message.includes('unique')) {
        console.warn('[Stories VIEW POST API] Fallback insert notice:', fbError.message)
      }

      return NextResponse.json({
        success: true,
        recorded: !fbError,
        view: insertFallback?.[0] || null,
      })
    }

    return NextResponse.json({
      success: true,
      recorded: true,
      view: data?.[0] || null,
    })
  } catch (err: any) {
    console.error('[Stories VIEW POST API] Error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
