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
    const authHeader = request.headers.get('Authorization') || request.headers.get('authorization')

    const clientOptions = authHeader
      ? { global: { headers: { Authorization: authHeader } } }
      : undefined

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, clientOptions)

    const { data: messages, error } = await supabase
      .from('group_messages')
      .select(`
        id,
        group_id,
        sender_id,
        content,
        created_at,
        sender:profiles(id, full_name, role, avatar_url)
      `)
      .eq('group_id', groupId)
      .order('created_at', { ascending: true })

    if (error || !messages) {
      // Fallback demo messages si la tabla no está creada aún
      const demoMessages = [
        {
          id: 'msg-demo-1',
          group_id: groupId,
          sender_id: 'demo-user-1',
          content: '¡Bienvenidos al grupo de apoyo! ¿Cómo lleváis el día de hoy? 🌿',
          created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
          sender: {
            id: 'demo-user-1',
            full_name: 'Vinyet Blasi',
            role: 'smoker',
            avatar_url: null,
          },
        },
        {
          id: 'msg-demo-2',
          group_id: groupId,
          sender_id: 'demo-user-2',
          content: '¡Con muchas ganas! La respiración guiada del botón SOS me ayudó a calmar un momento difícil.',
          created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          sender: {
            id: 'demo-user-2',
            full_name: 'Angi',
            role: 'smoker',
            avatar_url: null,
          },
        },
        {
          id: 'msg-demo-3',
          group_id: groupId,
          sender_id: 'demo-user-3',
          content: '¡Mucho ánimo a todos! Como guardián estoy pendiente para enviaros agua y vitalidad en cualquier instante. 💪',
          created_at: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
          sender: {
            id: 'demo-user-3',
            full_name: 'Carlos Díaz',
            role: 'friend',
            avatar_url: null,
          },
        },
      ]

      return NextResponse.json({ success: true, messages: demoMessages, isFallback: true })
    }

    return NextResponse.json({ success: true, messages })
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
    const { sender_id, content } = body

    if (!sender_id || !content?.trim()) {
      return NextResponse.json({ error: 'sender_id and content are required' }, { status: 400 })
    }

    const clientOptions = authHeader
      ? { global: { headers: { Authorization: authHeader } } }
      : undefined

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, clientOptions)

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
            full_name: 'Tú',
            role: 'smoker',
            avatar_url: null,
          },
        },
      })
    }

    return NextResponse.json({ success: true, message: newMsg })
  } catch (err: any) {
    console.error('[Group Messages POST API] Error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
