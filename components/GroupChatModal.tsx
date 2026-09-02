'use client'

import React, { useState, useEffect, useRef } from 'react'
import { X, Send, Users, Info, Sparkles, CheckCheck, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import GroupInfoModal from '@/components/GroupInfoModal'

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
  onClose: () => void
  onFriendAdded?: (friendId: string) => void
}

const QUICK_GROUP_PROMPTS = [
  '💧 ¡He regado mi planta hoy!',
  '💪 ¡Mucho ánimo a todos!',
  '🌿 Respirando limpio y con calma.',
  '🙌 ¡Un día más sin humo!',
]

export default function GroupChatModal({
  group,
  currentUserId,
  currentUserName,
  onClose,
  onFriendAdded,
}: GroupChatModalProps) {
  const [messages, setMessages] = useState<GroupMessageItem[]>([])
  const [inputText, setInputText] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [isSending, setIsSending] = useState<boolean>(false)
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Cargar mensajes iniciales
  useEffect(() => {
    let isMounted = true
    setLoading(true)

    async function loadMessages() {
      try {
        const res = await fetch(`/api/groups/${group.id}/messages`)
        if (res.ok) {
          const data = await res.json()
          if (data.success && Array.isArray(data.messages) && isMounted) {
            setMessages(data.messages)
          }
        }
      } catch (err) {
        console.warn('Error loading group messages:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadMessages()

    // Suscripción Realtime a nuevos mensajes en este grupo
    const channelName = `group-room-${group.id}-${Date.now()}`
    const channel = supabase
      .channel(channelName)
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
          if (!newMsg) return

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

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev
            return [
              ...prev,
              {
                ...newMsg,
                sender: senderProfile || {
                  id: newMsg.sender_id,
                  full_name: 'Compañero',
                  role: 'smoker',
                  avatar_url: null,
                },
              },
            ]
          })

          if (typeof window !== 'undefined') {
            localStorage.setItem(`last_read_group_${group.id}`, new Date().toISOString())
          }
        }
      )
      .subscribe()

    if (typeof window !== 'undefined') {
      localStorage.setItem(`last_read_group_${group.id}`, new Date().toISOString())
    }

    return () => {
      isMounted = false
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

    const tempId = 'temp-' + Date.now()
    const optimisticMsg: GroupMessageItem = {
      id: tempId,
      group_id: group.id,
      sender_id: currentUserId,
      content,
      created_at: new Date().toISOString(),
      sender: {
        id: currentUserId,
        full_name: currentUserName,
        role: 'smoker',
        avatar_url: null,
      },
    }

    setMessages((prev) => [...prev, optimisticMsg])

    try {
      const res = await fetch(`/api/groups/${group.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_id: currentUserId,
          content,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.success && data.message) {
          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? data.message : m))
          )
        }
      }
    } catch (err) {
      console.warn('Error sending group message:', err)
    } finally {
      setIsSending(false)
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
                👥
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
              {/* BOTÓN INFORMACIÓN DEL GRUPO (VER MIEMBROS Y AÑADIR AMIGOS) */}
              <button
                type="button"
                onClick={() => setShowInfoModal(true)}
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
                <span className="text-3xl">🌿</span>
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
                const senderName = isMe ? 'Tú' : msg.sender?.full_name || 'Compañero'
                const initials = senderName
                  .split(' ')
                  .map((w: string) => w[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    {/* Nombre del remitente (si no soy yo) */}
                    {!isMe && (
                      <div className="flex items-center gap-1.5 mb-1 px-1">
                        <div className="w-4 h-4 rounded-full bg-[#E8B75E]/20 text-[#E8B75E] text-[9px] font-bold flex items-center justify-center">
                          {initials}
                        </div>
                        <span className="text-[11px] font-medium text-[#A9BBA4]">
                          {senderName}
                        </span>
                      </div>
                    )}

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
          onClose={() => setShowInfoModal(false)}
          onFriendAdded={onFriendAdded}
        />
      )}
    </>
  )
}
