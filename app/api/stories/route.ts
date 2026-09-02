import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yzkwoeauwusrklvpxupc.supabase.co'
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

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

    // 1. Consultar historias activas en Supabase (expiran en 24h)
    const { data: dbStories, error: dbError } = await supabase
      .from('stories')
      .select('id, user_id, media_url, caption, created_at, expires_at')
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: true })

    if (dbError) {
      console.warn('[Stories GET API] Database notice:', dbError.message)
      const isTableMissing =
        dbError.code === 'PGRST205' ||
        dbError.message?.toLowerCase().includes('schema cache') ||
        dbError.message?.toLowerCase().includes('does not exist')

      return NextResponse.json({
        success: !isTableMissing,
        tableMissing: isTableMissing,
        error: isTableMissing
          ? "La tabla 'stories' no existe en Supabase. Ejecuta el script SQL para habilitar la persistencia."
          : dbError.message,
        users: [],
      })
    }

    if (!dbStories || dbStories.length === 0) {
      return NextResponse.json({ success: true, users: [] })
    }

    // 2. Obtener perfiles de los autores de las historias
    const authorIds = Array.from(new Set(dbStories.map((s) => s.user_id)))
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, role, avatar_url')
      .in('id', authorIds)

    const profileMap = new Map<string, any>()
    profiles?.forEach((p) => profileMap.set(p.id, p))

    // 3. Agrupar historias por autor
    const userMap: Record<string, any> = {}

    dbStories.forEach((st) => {
      const uId = st.user_id
      if (!userMap[uId]) {
        const prof = profileMap.get(uId)
        const fullName = prof?.full_name || 'Compañero'
        const initials = fullName
          .split(' ')
          .map((n: string) => n[0])
          .join('')
          .slice(0, 2)
          .toUpperCase()

        userMap[uId] = {
          userId: uId,
          userName: fullName,
          userInitials: initials,
          userRole: prof?.role || 'smoker',
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

    return NextResponse.json({
      success: true,
      users: Object.values(userMap),
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
    // Exactamente 24 horas de vigencia
    const expires_at = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()

    const { data: newStory, error: insertError } = await supabase
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

    if (insertError) {
      console.error('[Stories POST API] Insert error:', insertError)
      const isTableMissing =
        insertError.code === 'PGRST205' ||
        insertError.message?.toLowerCase().includes('schema cache') ||
        insertError.message?.toLowerCase().includes('does not exist')

      return NextResponse.json(
        {
          success: false,
          tableMissing: isTableMissing,
          error: isTableMissing
            ? "Falta crear la tabla 'stories' en Supabase. Ejecuta el script SQL en tu panel de Supabase para guardar historias."
            : insertError.message,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      story: newStory,
    })
  } catch (err: any) {
    console.error('[Stories POST API] Error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
