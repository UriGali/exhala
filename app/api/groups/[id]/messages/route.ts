import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWebPushToUsers } from '@/lib/push-service'

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
    const authHeader = request.headers.get('Authorization') || request.headers.get('authorization')

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

    const { data: messages, error } = await supabase
      .from('group_messages')
      .select('id, group_id, sender_id, content, created_at')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true })

    if (error || !messages) {
      return NextResponse.json({ success: true, messages: [] })
    }

    const senderIds = Array.from(new Set(messages.map((m: any) => m.sender_id).filter(Boolean)))
    const clientWithAuth = authHeader
      ? createClient(SUPABASE_URL, SUPABASE_KEY, { global: { headers: { Authorization: authHeader } } })
      : supabase

    let profileMap = new Map<string, any>()
    if (senderIds.length > 0) {
      const { data: profiles } = await clientWithAuth
        .from('profiles')
        .select('id, full_name, role, avatar_url')
        .in('id', senderIds)

      profiles?.forEach((p: any) => profileMap.set(p.id, p))
    }

    const enrichedMessages = messages.map((m: any) => ({
      ...m,
      sender: profileMap.get(m.sender_id) || null,
    }))

    return NextResponse.json({ success: true, messages: enrichedMessages })
  } catch (err: any) {
    console.error('[Group Messages GET API] Error:', err)
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
    const { sender_id, content, sender_name, sender_avatar } = body

    if (!sender_id || !content?.trim()) {
      return NextResponse.json({ error: 'sender_id and content are required' }, { status: 400 })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

    const nowIso = new Date().toISOString()
    const { data: newMsg, error } = await supabase
      .from('group_messages')
      .insert({
        group_id: groupId,
        sender_id,
        content: content.trim(),
        created_at: nowIso,
      })
      .select(`
        id,
        group_id,
        sender_id,
        content,
        created_at,
        sender:profiles(id, full_name, role, avatar_url)
      `)
      .single()

    if (error || !newMsg) {
      console.warn('[Group Messages POST API] Notice:', error?.message)
      // Fallback message
      return NextResponse.json({
        success: true,
        isFallback: true,
        message: {
          id: 'mock-msg-' + Date.now(),
          group_id: groupId,
          sender_id,
          content: content.trim(),
          created_at: nowIso,
          sender: {
            id: sender_id,
            full_name: sender_name || 'Tú',
            role: 'smoker',
            avatar_url: sender_avatar || null,
          },
        },
      })
    }

    // Despachar notificación a los otros miembros del grupo en segundo plano
    try {
      // 1. Obtener nombre del grupo
      const { data: groupData } = await supabase
        .from('groups')
        .select('name')
        .eq('id', groupId)
        .maybeSingle()
      const groupName = groupData?.name || 'Grupo'

      // 2. Nombre del remitente
      const senderData: any = newMsg.sender
      const senderObj = Array.isArray(senderData) ? senderData[0] : senderData
      const senderName = senderObj?.full_name || 'Compañero'

      // 3. Miembros del grupo
      const { data: members } = await supabase
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId)
        .neq('user_id', sender_id)

      const recipientIds = (members || [])
        .map((m) => m.user_id)
        .filter((uid) => uid && uid !== sender_id)

      if (recipientIds.length > 0) {
        sendWebPushToUsers({
          userIds: recipientIds,
          title: `💬 ${groupName}: ${senderName}`,
          body: content.trim(),
          url: '/dashboard/friends',
        }).catch((e) => console.warn('[Group Messages POST API] Push dispatch notice:', e))
      }
    } catch (pushErr) {
      console.warn('[Group Messages POST API] Push notify error:', pushErr)
    }

    return NextResponse.json({ success: true, message: newMsg })
  } catch (err: any) {
    console.error('[Group Messages POST API] Error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
