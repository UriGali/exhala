import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yzkwoeauwusrklvpxupc.supabase.co'
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Archivo persistente en el servidor para almacenar historias de 24h
// Garantiza que todos los amigos vean las historias reales inmediatamente
const CACHE_FILE = path.join(process.cwd(), '.stories_cache.json')

interface CachedStory {
  id: string
  user_id: string
  userName: string
  userInitials: string
  userRole: 'smoker' | 'friend'
  media_url: string
  caption?: string | null
  created_at: string
  expires_at: string
}

function readPersistentStories(): CachedStory[] {
  try {
    if (!fs.existsSync(CACHE_FILE)) {
      return []
    }
    const raw = fs.readFileSync(CACHE_FILE, 'utf8')
    const list: CachedStory[] = JSON.parse(raw)
    const now = Date.now()
    // Filtrar historias expiradas (< 24h)
    return list.filter((s) => new Date(s.expires_at).getTime() > now)
  } catch (err) {
    console.warn('[Stories Storage] Read error:', err)
    return []
  }
}

function savePersistentStory(newStory: CachedStory) {
  try {
    const activeList = readPersistentStories()
    const updated = [newStory, ...activeList.filter((s) => s.id !== newStory.id)]
    fs.writeFileSync(CACHE_FILE, JSON.stringify(updated, null, 2), 'utf8')
  } catch (err) {
    console.warn('[Stories Storage] Save error:', err)
  }
}

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
    const nowMs = Date.now()

    // 1. Obtener amigos aceptados del viewer para saber qué historias debe ver
    const friendIdsSet = new Set<string>()
    if (viewerId) {
      friendIdsSet.add(viewerId) // Ver siempre las historias propias

      try {
        const { data: friendships } = await supabase
          .from('friendships')
          .select('smoker_id, friend_id, status')
          .or(`smoker_id.eq.${viewerId},friend_id.eq.${viewerId}`)

        friendships?.forEach((f) => {
          if (f.status === 'accepted') {
            const friendId = f.smoker_id === viewerId ? f.friend_id : f.smoker_id
            friendIdsSet.add(friendId)
          }
        })
      } catch (fErr) {
        console.warn('[Stories GET] Friendship query note:', fErr)
      }
    }

    // 2. Intentar consultar historias en Supabase
    let dbStories: any[] = []
    try {
      const { data, error } = await supabase
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

      if (!error && Array.isArray(data)) {
        dbStories = data
      }
    } catch {}

    // 3. Consultar historias persistentes en el servidor
    const cachedStories = readPersistentStories()

    // 4. Fusionar historias reales (sin historias demo)
    const userMap: Record<string, any> = {}

    // Procesar historias de base de datos
    dbStories.forEach((st: any) => {
      const uId = st.user_id
      // Si tenemos viewerId y hay lista de amigos, verificar si son amigos
      if (viewerId && friendIdsSet.size > 1 && !friendIdsSet.has(uId)) {
        return
      }

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

    // Procesar historias persistentes del servidor
    cachedStories.forEach((cst) => {
      if (new Date(cst.expires_at).getTime() <= nowMs) return
      const uId = cst.user_id

      // Si tenemos viewerId y hay amigos conectados, filtrar
      if (viewerId && friendIdsSet.size > 1 && !friendIdsSet.has(uId)) {
        return
      }

      if (!userMap[uId]) {
        userMap[uId] = {
          userId: uId,
          userName: cst.userName,
          userInitials: cst.userInitials,
          userRole: cst.userRole,
          stories: [],
        }
      }

      // Evitar duplicados si ya vino de la base de datos
      const alreadyExists = userMap[uId].stories.some((s: any) => s.id === cst.id)
      if (!alreadyExists) {
        userMap[uId].stories.push({
          id: cst.id,
          mediaUrl: cst.media_url,
          caption: cst.caption,
          createdAt: cst.created_at,
          expiresAt: cst.expires_at,
        })
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

    // Obtener perfil del usuario que publica para conocer su nombre real
    let userName = 'Compañero'
    let userInitials = 'CO'
    let userRole: 'smoker' | 'friend' = 'smoker'

    try {
      const { data: prof } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', user_id)
        .maybeSingle()

      if (prof?.full_name) {
        userName = prof.full_name
        userInitials = prof.full_name
          .split(' ')
          .map((n: string) => n[0])
          .join('')
          .slice(0, 2)
          .toUpperCase()
      }
      if (prof?.role) {
        userRole = prof.role
      }
    } catch {}

    const now = new Date()
    const created_at = now.toISOString()
    // Exactamente 24 horas de vigencia
    const expires_at = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
    const storyId = 'story-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7)

    const storyObject: CachedStory = {
      id: storyId,
      user_id,
      userName,
      userInitials,
      userRole,
      media_url,
      caption: caption?.trim() || null,
      created_at,
      expires_at,
    }

    // 1. Guardar de inmediato en almacenamiento persistente del servidor
    savePersistentStory(storyObject)

    // 2. Intentar guardar en Supabase si la tabla existe
    try {
      await supabase.from('stories').insert({
        id: storyId.startsWith('story-') ? undefined : storyId,
        user_id,
        media_url,
        caption: caption?.trim() || null,
        created_at,
        expires_at,
      })
    } catch (dbErr) {
      console.warn('[Stories POST] Supabase insert notice:', dbErr)
    }

    return NextResponse.json({
      success: true,
      story: {
        id: storyId,
        user_id,
        media_url,
        caption: caption?.trim() || null,
        created_at,
        expires_at,
      },
    })
  } catch (err: any) {
    console.error('[Stories POST API] Error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
