'use client'

import React, { useState, useEffect, useRef } from 'react'
import { X, Send, Users, Info, Sparkles, CheckCheck, Loader2, UserPlus } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import GroupInfoModal, { FriendSummary } from '@/components/GroupInfoModal'

export interface GroupChatData {
  id: string
  name: string
  description?: string
  member_count: number
  created_by?: string
}

interface GroupMessageItem {
  id: string
  group_id: string
  sender_id: string
  content: string
  created_at: string
  sender?: {
    id: string
    full_name: string | null
    role: 'smoker' | 'friend'
    avatar_url: string | null
  }
}

interface GroupChatModalProps {
  group: GroupChatData
  currentUserId: string | null
  currentUserName: string
  currentUserAvatarUrl?: string | null
  friends?: FriendSummary[]
  onClose: () => void
  onFriendAdded?: (friendId: string) => void
  onMembersAdded?: () => void
}

const QUICK_GROUP_PROMPTS = [
  'He regado mi planta hoy',
  '¡Mucho ánimo a todos!',
  'Respirando limpio y con calma',
  '¡Un día más sin humo!',
]

export default function GroupChatModal({
  group,
  currentUserId,
  currentUserName,
  currentUserAvatarUrl,
  friends,
  onClose,
  onFriendAdded,
  onMembersAdded,
}: GroupChatModalProps) {
  const [messages, setMessages] = useState<GroupMessageItem[]>([])
  const [inputText, setInputText] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [isSending, setIsSending] = useState<boolean>(false)
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false)
  const [openAddMembersDirectly, setOpenAddMembersDirectly] = useState<boolean>(false)
  const [myAvatar, setMyAvatar] = useState<string | null>(currentUserAvatarUrl || null)
  const [memberProfilesMap, setMemberProfilesMap] = useState<
    Record<string, { name: string; avatar_url: string | null }>
  >({})
  const [enlargedAvatar, setEnlargedAvatar] = useState<{
    url: string | null
    name: string
    initials: string
  } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!enlargedAvatar) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEnlargedAvatar(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enlargedAvatar])

  // Cargar avatar del usuario activo si no viene en las props
  useEffect(() => {
    if (currentUserAvatarUrl) {
      setMyAvatar(currentUserAvatarUrl)
      return
    }
    if (!currentUserId) return

    async function fetchMyAvatar() {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', currentUserId)
          .maybeSingle()
        if (data?.avatar_url) setMyAvatar(data.avatar_url)
      } catch (err) {
        console.warn('Error fetching current user avatar:', err)
      }
    }

    fetchMyAvatar()
  }, [currentUserId, currentUserAvatarUrl])

  // Cargar mapa de perfiles de miembros del grupo para avatares fiables
  useEffect(() => {
    async function fetchMemberProfiles() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch(`/api/groups/${group.id}/members?viewerId=${currentUserId || ''}`, {
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        })
        if (res.ok) {
          const data = await res.json()
          if (data.success && Array.isArray(data.members)) {
            const map: Record<string, { name: string; avatar_url: string | null }> = {}
            data.members.forEach((item: any) => {
              if (item.user_id) {
                map[item.user_id] = {
                  name: item.name || 'Compañero',
                  avatar_url: item.avatar_url || null,
                }
              }
            })
            setMemberProfilesMap(map)
          }
        }
      } catch (err) {
        console.warn('Error fetching group member profiles:', err)
      }
    }

    fetchMemberProfiles()
  }, [group.id, currentUserId])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Cargar mensajes iniciales y suscribirse a Realtime
  useEffect(() => {
    let isMounted = true
    let pollInterval: any = null
    const channelName = `group-chat-${group.id}`

    async function loadMessages(isInitial = false) {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch(`/api/groups/${group.id}/messages`, {
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        })
        if (res.ok) {
          const data = await res.json()
          if (data.success && Array.isArray(data.messages) && isMounted) {
            setMessages((prev) => {
              // Combinar evitando duplicados y preservando mensajes enviados
              const existingMap = new Map(prev.map((m) => [m.id, m]))
              data.messages.forEach((m: GroupMessageItem) => {
                existingMap.set(m.id, m)
              })
              // Filtrar mensajes temporales que ya hayan sido confirmados
              const list = Array.from(existingMap.values()).sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              )
              return list
            })
          }
        }
      } catch (err) {
        console.warn('Error loading group messages:', err)
      } finally {
        if (isInitial && isMounted) setLoading(false)
      }
    }

    loadMessages(true)

    // Configurar canal Realtime compartido con Broadcast + Postgres Changes
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false },
      },
    })

    channel
      .on('broadcast', { event: 'new_group_message' }, ({ payload }: { payload: GroupMessageItem }) => {
        if (!isMounted || !payload) return
        setMessages((prev) => {
          if (prev.some((m) => m.id === payload.id)) return prev
          return [...prev, payload]
        })
        if (typeof window !== 'undefined') {
          localStorage.setItem(`last_read_group_${group.id}`, new Date().toISOString())
        }
        setTimeout(scrollToBottom, 60)
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_messages',
          filter: `group_id=eq.${group.id}`,
        },
        async (payload: any) => {
          const newMsg = payload?.new
          if (!newMsg || !isMounted) return

          // Obtener perfil del remitente si no viene en el payload
          let senderProfile: any = null
          try {
            const { data: prof } = await supabase
              .from('profiles')
              .select('id, full_name, role, avatar_url')
              .eq('id', newMsg.sender_id)
              .maybeSingle()
            senderProfile = prof
          } catch {}

          const fullMsg: GroupMessageItem = {
            ...newMsg,
            sender: senderProfile || {
              id: newMsg.sender_id,
              full_name: 'Compañero',
              role: 'smoker',
              avatar_url: null,
            },
          }

          setMessages((prev) => {
            if (prev.some((m) => m.id === fullMsg.id)) return prev
            return [...prev, fullMsg]
          })

          if (typeof window !== 'undefined') {
            localStorage.setItem(`last_read_group_${group.id}`, new Date().toISOString())
          }
          setTimeout(scrollToBottom, 60)
        }
      )
      .subscribe()

    // Polling de respaldo cada 2.5s mientras el chat está abierto para 100% de fiabilidad
    pollInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return
      loadMessages(false)
    }, 2500)

    if (typeof window !== 'undefined') {
      localStorage.setItem(`last_read_group_${group.id}`, new Date().toISOString())
    }

    return () => {
      isMounted = false
      if (pollInterval) clearInterval(pollInterval)
      if (typeof window !== 'undefined') {
        localStorage.setItem(`last_read_group_${group.id}`, new Date().toISOString())
      }
      supabase.removeChannel(channel)
    }
  }, [group.id])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Enviar mensaje
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const content = inputText.trim()
    if (!content || !currentUserId || isSending) return

    setIsSending(true)
    setInputText('')

    const nowIso = new Date().toISOString()
    const tempId = 'temp-' + Date.now()
    const optimisticMsg: GroupMessageItem = {
      id: tempId,
      group_id: group.id,
      sender_id: currentUserId,
      content,
      created_at: nowIso,
      sender: {
        id: currentUserId,
        full_name: currentUserName,
        role: 'smoker',
        avatar_url: myAvatar,
      },
    }

    setMessages((prev) => [...prev, optimisticMsg])
    setTimeout(scrollToBottom, 50)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/groups/${group.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          sender_id: currentUserId,
          content,
          sender_name: currentUserName,
          sender_avatar: myAvatar,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.success && data.message) {
          const finalMsg = data.message
          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? finalMsg : m))
          )

          // Emitir inmediatamente broadcast a todos los participantes en el canal del grupo
          const channel = supabase.channel(`group-chat-${group.id}`)
          channel.send({
            type: 'broadcast',
            event: 'new_group_message',
            payload: finalMsg,
          })
        }
      }
    } catch (err) {
      console.warn('Error sending group message:', err)
    } finally {
      setIsSending(false)
      setTimeout(scrollToBottom, 60)
    }
  }

  const formatMessageTime = (isoString: string) => {
    try {
      const d = new Date(isoString)
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200 select-none">
        <div
          className="w-full sm:w-[390px] h-[92vh] sm:h-[750px] rounded-t-[32px] sm:rounded-[32px] border border-[rgba(232,183,94,0.18)] flex flex-col overflow-hidden shadow-[0_30px_90px_rgba(0,0,0,0.7)] animate-in slide-in-from-bottom duration-300"
          style={{
            background: 'radial-gradient(120% 90% at 50% -10%, #223729 0%, #16241C 45%, #0F1913 100%)',
            fontFamily: "'Work Sans', sans-serif",
            color: '#F1EEE2',
          }}
        >
          {/* ============================================================== */}
          {/* CABECERA DEL CHAT GRUPAL                                      */}
          {/* ============================================================== */}
          <header className="pt-4 px-4 pb-3.5 border-b border-[rgba(232,183,94,0.12)] flex items-center justify-between bg-[rgba(255,255,255,0.02)] backdrop-blur-md">
            <div className="flex items-center gap-3 min-w-0">
              {/* Avatar del Grupo */}
              <div className="w-[42px] h-[42px] rounded-full bg-gradient-to-br from-[#EFC471] to-[#E8B75E] text-[#2B1C08] flex items-center justify-center font-bold text-[16px] shrink-0 shadow-md">
                <Users className="w-5 h-5 text-[#2B1C08]" />
              </div>

              {/* Nombre e info del grupo */}
              <div className="min-w-0">
                <h2 className="font-fraunces font-medium text-[16px] text-[#F1EEE2] truncate leading-tight">
                  {group.name}
                </h2>
                <div className="text-[11.5px] text-[#7C9481] flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#6FCB8A]" />
                  <span>{group.member_count} participantes</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* BOTÓN RÁPIDO AÑADIR AMIGOS AL GRUPO */}
              <button
                type="button"
                onClick={() => {
                  setOpenAddMembersDirectly(true)
                  setShowInfoModal(true)
                }}
                className="h-8 px-2.5 rounded-full bg-[rgba(232,183,94,0.12)] border border-[rgba(232,183,94,0.25)] text-[#E8B75E] hover:bg-[rgba(232,183,94,0.22)] text-xs font-semibold flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-xs"
                title="Añadir amigos a este grupo"
                aria-label="Añadir amigos al grupo"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span className="text-[11px] hidden xs:inline">Añadir</span>
              </button>

              {/* BOTÓN INFORMACIÓN DEL GRUPO (VER MIEMBROS) */}
              <button
                type="button"
                onClick={() => {
                  setOpenAddMembersDirectly(false)
                  setShowInfoModal(true)
                }}
                className="w-8 h-8 rounded-full bg-[rgba(232,183,94,0.08)] border border-[rgba(232,183,94,0.22)] flex items-center justify-center text-[#E8B75E] hover:bg-[rgba(232,183,94,0.18)] transition-all cursor-pointer"
                title="Información y miembros del grupo"
                aria-label="Ver miembros del grupo"
              >
                <Info className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-[rgba(255,255,255,0.04)] border border-[rgba(232,183,94,0.1)] flex items-center justify-center text-[#A9BBA4] hover:text-[#F1EEE2] transition-colors cursor-pointer"
                aria-label="Cerrar chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* ============================================================== */}
          {/* LISTA DE MENSAJES                                              */}
          {/* ============================================================== */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 no-scrollbar">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-[#E8B75E]" />
                <span className="text-xs text-[#7C9481]">Cargando mensajes del grupo...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 gap-2 opacity-80">
                <Users className="w-8 h-8 text-[#E8B75E]/60 mx-auto" />
                <p className="font-fraunces text-sm text-[#F1EEE2]">
                  ¡El grupo está abierto para todos!
                </p>
                <p className="text-xs text-[#7C9481]">
                  Envía el primer mensaje de apoyo o comparte cómo va tu racha limpia.
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.sender_id === currentUserId
                const rawSender: any = msg.sender
                const senderObj = Array.isArray(rawSender) ? rawSender[0] : rawSender

                const cached = memberProfilesMap[msg.sender_id]
                const senderName = isMe
                  ? 'Tú'
                  : (senderObj?.full_name || cached?.name || 'Compañero')

                const avatarUrl = isMe
                  ? (myAvatar || senderObj?.avatar_url || cached?.avatar_url || null)
                  : (senderObj?.avatar_url || cached?.avatar_url || null)

                const rawInitialsSource = isMe ? (currentUserName || 'Tú') : senderName
                const initials = rawInitialsSource
                  .split(' ')
                  .filter(Boolean)
                  .map((w: string) => w[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase() || 'U'

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    {/* FOTO DE PERFIL ANTES DE SU NOMBRE */}
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      {/* Foto de perfil ampliable */}
                      <button
                        type="button"
                        onClick={() =>
                          setEnlargedAvatar({
                            url: avatarUrl,
                            name: senderName,
                            initials,
                          })
                        }
                        className="w-[23px] h-[23px] rounded-full overflow-hidden flex items-center justify-center shrink-0 border border-[rgba(232,183,94,0.35)] shadow-xs cursor-pointer hover:scale-115 hover:border-[#E8B75E] active:scale-90 transition-all focus:outline-none"
                        style={{
                          background: avatarUrl
                            ? '#16241C'
                            : 'radial-gradient(circle at 35% 30%, #EFC471, #E8B75E)',
                          color: '#1B1710',
                        }}
                        title={`Ampliar foto de ${senderName}`}
                        aria-label={`Ampliar foto de ${senderName}`}
                      >
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={senderName}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        ) : (
                          <span className="text-[9.5px] font-bold leading-none">
                            {initials}
                          </span>
                        )}
                      </button>

                      {/* Nombre ampliable */}
                      <button
                        type="button"
                        onClick={() =>
                          setEnlargedAvatar({
                            url: avatarUrl,
                            name: senderName,
                            initials,
                          })
                        }
                        className={`text-[11.5px] font-medium leading-none cursor-pointer hover:underline focus:outline-none text-left ${
                          isMe ? 'text-[#E8B75E]' : 'text-[#A9BBA4]'
                        }`}
                        title={`Ampliar foto de ${senderName}`}
                      >
                        {senderName}
                      </button>
                    </div>

                    {/* Burbuja del mensaje */}
                    <div
                      className={`max-w-[78%] px-3.5 py-2.5 rounded-[20px] text-[13.5px] leading-relaxed shadow-sm ${
                        isMe
                          ? 'bg-gradient-to-r from-[#EFC471] to-[#E8B75E] text-[#1B1710] rounded-br-[4px] font-normal'
                          : 'bg-[rgba(255,255,255,0.06)] border border-[rgba(232,183,94,0.12)] text-[#F1EEE2] rounded-bl-[4px]'
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      <div
                        className={`text-[10px] mt-1 text-right flex items-center justify-end gap-1 ${
                          isMe ? 'text-[#3D2A1A]/75' : 'text-[#7C9481]'
                        }`}
                      >
                        <span>{formatMessageTime(msg.created_at)}</span>
                        {isMe && <CheckCheck className="w-3 h-3" />}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* ============================================================== */}
          {/* RESPUESTAS RÁPIDAS DE APOYO                                    */}
          {/* ============================================================== */}
          <div className="px-3 py-2 flex gap-1.5 overflow-x-auto no-scrollbar border-t border-[rgba(232,183,94,0.08)] bg-[rgba(0,0,0,0.1)]">
            {QUICK_GROUP_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setInputText(prompt)}
                className="shrink-0 text-[11px] text-[#A9BBA4] bg-[rgba(255,255,255,0.03)] border border-[rgba(232,183,94,0.12)] px-2.5 py-1 rounded-full hover:text-[#E8B75E] hover:border-[rgba(232,183,94,0.3)] transition-all cursor-pointer whitespace-nowrap"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* ============================================================== */}
          {/* INPUT BAR                                                      */}
          {/* ============================================================== */}
          <form
            onSubmit={handleSendMessage}
            className="p-3 border-t border-[rgba(232,183,94,0.12)] bg-[rgba(22,36,28,0.95)] flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Escribe un mensaje al grupo..."
              className="flex-1 h-11 px-4 rounded-full bg-[rgba(255,255,255,0.04)] border border-[rgba(232,183,94,0.16)] text-[#F1EEE2] text-[13px] placeholder:text-[#7C9481] focus:outline-none focus:border-[#E8B75E] transition-colors"
            />

            <button
              type="submit"
              disabled={!inputText.trim() || isSending}
              className="w-11 h-11 rounded-full bg-gradient-to-r from-[#EFC471] to-[#E8B75E] text-[#1B1710] flex items-center justify-center shrink-0 disabled:opacity-40 disabled:scale-100 hover:scale-105 active:scale-95 transition-all shadow-md cursor-pointer"
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>
        </div>
      </div>

      {/* MODAL DE INFORMACIÓN Y MIEMBROS DEL GRUPO */}
      {showInfoModal && (
        <GroupInfoModal
          groupId={group.id}
          groupName={group.name}
          groupDescription={group.description}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          initialOpenAddMembers={openAddMembersDirectly}
          availableFriends={friends}
          onClose={() => {
            setShowInfoModal(false)
            setOpenAddMembersDirectly(false)
          }}
          onFriendAdded={onFriendAdded}
          onMembersAdded={onMembersAdded}
        />
      )}

      {/* MODAL FOTO DE PERFIL AMPLIADA EN FORMA REDONDA (MEDIA PANTALLA) */}
      {enlargedAvatar && (
        <div
          onClick={() => setEnlargedAvatar(null)}
          className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in fade-in duration-200 cursor-pointer select-none"
        >
          {/* Botón cerrar */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setEnlargedAvatar(null)
            }}
            className="absolute top-6 right-6 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-[#F1EEE2] transition-colors cursor-pointer z-10"
            aria-label="Cerrar foto"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Contenedor de la foto redonda ampliada a media pantalla */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex flex-col items-center animate-in zoom-in-75 duration-250 ease-out cursor-default"
          >
            <div className="w-[min(68vw,280px)] h-[min(68vw,280px)] rounded-full overflow-hidden border-[4.5px] border-[#E8B75E] shadow-[0_0_60px_rgba(232,183,94,0.45)] flex items-center justify-center bg-[#16241C] relative transition-transform">
              {enlargedAvatar.url ? (
                <img
                  src={enlargedAvatar.url}
                  alt={enlargedAvatar.name}
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-6xl font-bold font-fraunces text-[#1B1710]"
                  style={{
                    background: 'radial-gradient(circle at 35% 30%, #EFC471, #E8B75E)',
                  }}
                >
                  {enlargedAvatar.initials}
                </div>
              )}
            </div>

            {/* Nombre e indicación */}
            <div className="mt-5 text-center space-y-1">
              <h3 className="font-fraunces text-xl font-semibold text-[#F1EEE2] tracking-wide">
                {enlargedAvatar.name}
              </h3>
              <p className="text-xs text-[#A9BBA4]">
                Toca en cualquier lugar para cerrar
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
