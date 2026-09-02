import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yzkwoeauwusrklvpxupc.supabase.co'
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Historias demo inspiradoras iniciales (imágenes limpias de naturaleza, té y aire puro)
const DEMO_STORIES = [
  {
    userId: '00000000-0000-4000-8000-000000000001',
    userName: 'Vinyet Blasi',
    userInitials: 'VB',
    userRole: 'smoker',
    stories: [
      {
        id: 'demo-story-vinyet-1',
        mediaUrl:
          'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
        caption: '🌅 Amanecer respirando aire puro frente al mar. Día 4 sin fumar.',
        createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
        expiresAt: new Date(Date.now() + 21 * 3600 * 1000).toISOString(),
      },
      {
        id: 'demo-story-vinyet-2',
        mediaUrl:
          'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=800&q=80',
        caption: '🍵 Té verde y sesión de respiración profunda en lugar de un cigarrillo.',
        createdAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
        expiresAt: new Date(Date.now() + 23 * 3600 * 1000).toISOString(),
      },
    ],
  },
  {
    userId: '00000000-0000-4000-8000-000000000002',
    userName: 'Angi',
    userInitials: 'A',
    userRole: 'smoker',
    stories: [
      {
        id: 'demo-story-angi-1',
        mediaUrl:
          'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=800&q=80',
        caption: '🌲 Caminata por el bosque. Mis pulmones agradecen cada paso limpio.',
        createdAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
        expiresAt: new Date(Date.now() + 19 * 3600 * 1000).toISOString(),
      },
    ],
  },
  {
    userId: '00000000-0000-4000-8000-000000000003',
    userName: 'Carlos Díaz',
    userInitials: 'CD',
    userRole: 'friend',
    stories: [
      {
        id: 'demo-story-carlos-1',
        mediaUrl:
          'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=800&q=80',
        caption: '💧 Regando las plantas de todo el escuadrón. ¡Vamos con todo hoy!',
        createdAt: new Date(Date.now() - 7 * 3600 * 1000).toISOString(),
        expiresAt: new Date(Date.now() + 17 * 3600 * 1000).toISOString(),
      },
    ],
  },
]

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const viewerId = searchParams.get('viewerId')

    const authHeader = request.headers.get('Authorization') || request.headers.get('authorization')
    const clientOptions = authHeader
      ? { global: { headers: { Authorization: authHeader } } }
      : undefined

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, clientOptions)

    const nowIso = new Date().toISOString()

    // 1. Consultar historias activas en base de datos (expiran en 24h)
    const { data: dbStories, error } = await supabase
      .from('stories')
      .select(`
        id,
        user_id,
        media_url,
        caption,
        created_at,
        expires_at,
        profile:profiles(id, full_name, role, avatar_url)
      `)
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: true })

    // Agrupar por usuario
    const userMap: Record<string, any> = {}

    if (!error && dbStories && dbStories.length > 0) {
      dbStories.forEach((st: any) => {
        const uId = st.user_id
        if (!userMap[uId]) {
          const fullName = st.profile?.full_name || 'Compañero'
          userMap[uId] = {
            userId: uId,
            userName: fullName,
            userInitials: fullName
              .split(' ')
              .map((n: string) => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase(),
            userRole: st.profile?.role || 'smoker',
            stories: [],
          }
        }

        userMap[uId].stories.push({
          id: st.id,
          mediaUrl: st.media_url,
          caption: st.caption,
          createdAt: st.created_at,
          expiresAt: st.expires_at,
        })
      })
    }

    // Incluir historias demo para amigos que no tengan historias en base de datos
    DEMO_STORIES.forEach((demo) => {
      if (!userMap[demo.userId]) {
        userMap[demo.userId] = demo
      }
    })

    const usersWithStories = Object.values(userMap)

    return NextResponse.json({
      success: true,
      users: usersWithStories,
    })
  } catch (err: any) {
    console.error('[Stories GET API] Error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization') || request.headers.get('authorization')
    const body = await request.json()
    const { user_id, media_url, caption = '' } = body

    if (!user_id || !media_url) {
      return NextResponse.json({ error: 'user_id and media_url are required' }, { status: 400 })
    }

    const clientOptions = authHeader
      ? { global: { headers: { Authorization: authHeader } } }
      : undefined

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, clientOptions)

    const now = new Date()
    const created_at = now.toISOString()
    // Exactamente 24 horas de duración
    const expires_at = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()

    const { data: newStory, error } = await supabase
      .from('stories')
      .insert({
        user_id,
        media_url,
        caption: caption?.trim() || null,
        created_at,
        expires_at,
      })
      .select()
      .single()

    if (error || !newStory) {
      console.warn('[Stories POST API] Notice:', error?.message)
      // Fallback local / demo si la tabla no se ha migrado aún en consola
      const fallbackStory = {
        id: 'local-story-' + Date.now(),
        user_id,
        media_url,
        caption: caption?.trim() || null,
        created_at,
        expires_at,
      }
      return NextResponse.json({ success: true, story: fallbackStory, isFallback: true })
    }

    return NextResponse.json({ success: true, story: newStory })
  } catch (err: any) {
    console.error('[Stories POST API] Error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
