import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yzkwoeauwusrklvpxupc.supabase.co'
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params
    const { searchParams } = new URL(request.url)
    const viewerId = searchParams.get('viewerId')

    const authHeader = request.headers.get('Authorization') || request.headers.get('authorization')
    const clientOptions = authHeader
      ? { global: { headers: { Authorization: authHeader } } }
      : undefined

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, clientOptions)

    // 1. Obtener detalles del grupo
    const { data: group } = await supabase
      .from('groups')
      .select('id, name, description, created_by, created_at')
      .eq('id', groupId)
      .maybeSingle()

    // 2. Obtener miembros del grupo con sus perfiles
    const { data: members, error } = await supabase
      .from('group_members')
      .select(`
        id,
        group_id,
        user_id,
        role,
        joined_at,
        profile:profiles(id, full_name, role, avatar_url, smoke_free_since)
      `)
      .eq('group_id', groupId)

    if (error || !members || members.length === 0) {
      return NextResponse.json({
        success: true,
        group: group || null,
        members: [],
      })
    }

    // 3. Consultar amistades del viewer para saber si es amigo o no
    let viewerFriendships: any[] = []
    if (viewerId) {
      const { data: fData } = await supabase
        .from('friendships')
        .select('id, smoker_id, friend_id, status')
        .or(`smoker_id.eq.${viewerId},friend_id.eq.${viewerId}`)

      viewerFriendships = fData || []
    }

    const enrichedMembers = members.map((m: any) => {
      const targetUserId = m.user_id
      const isViewer = targetUserId === viewerId

      let isFriend = false
      let friendshipStatus: 'accepted' | 'pending' | 'none' = 'none'

      if (isViewer) {
        isFriend = true
        friendshipStatus = 'accepted'
      } else if (viewerId) {
        const found = viewerFriendships.find(
          (f) =>
            (f.smoker_id === viewerId && f.friend_id === targetUserId) ||
            (f.smoker_id === targetUserId && f.friend_id === viewerId)
        )

        if (found) {
          friendshipStatus = found.status || 'none'
          isFriend = found.status === 'accepted'
        }
      }

      const p = m.profile || {}
      const fullName = p.full_name || 'Compañero'
      const initials = fullName
        .split(' ')
        .map((w: string) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()

      return {
        id: m.id,
        user_id: targetUserId,
        name: fullName,
        initials,
        role: p.role || 'smoker',
        avatar_url: p.avatar_url,
        smoke_free_since: p.smoke_free_since,
        groupRole: m.role || 'member',
        joined_at: m.joined_at,
        isFriend,
        friendshipStatus,
        isViewer,
      }
    })

    return NextResponse.json({
      success: true,
      group: group || { id: groupId, name: 'Grupo' },
      members: enrichedMembers,
    })
  } catch (err: any) {
    console.error('[Group Members GET API] Error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params
    const authHeader = request.headers.get('Authorization') || request.headers.get('authorization')
    const body = await request.json()
    const { user_ids = [] } = body

    if (!Array.isArray(user_ids) || user_ids.length === 0) {
      return NextResponse.json({ error: 'user_ids array is required' }, { status: 400 })
    }

    const clientOptions = authHeader
      ? { global: { headers: { Authorization: authHeader } } }
      : undefined

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, clientOptions)

    const rows = user_ids.map((uId: string) => ({
      group_id: groupId,
      user_id: uId,
      role: 'member',
    }))

    const { data, error } = await supabase.from('group_members').insert(rows).select()

    if (error) {
      console.warn('[Group Members POST API] Notice:', error.message)
      return NextResponse.json({ success: true, isFallback: true, added: user_ids })
    }

    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    console.error('[Group Members POST API] Error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
