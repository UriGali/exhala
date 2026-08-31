'use client'

import React, { useState, useEffect, useRef } from 'react'
import { X, Send, MessageCircle, Sparkles, HeartHandshake, Smile, CheckCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { Message } from '@/types/database.types'

interface FriendInfo {
  id: string
  name: string
  initials: string
  status: string
  avatarBg: string
  avatarText: string
}

interface FriendChatModalProps {
  friend: FriendInfo | null
  currentUserId: string | null
  currentUserName: string
  onClose: () => void
}

const QUICK_PROMPTS = [
  '💪 ¡Mucho ánimo hoy!',
  '🌿 ¿Cómo te encuentras?',
  '💧 ¡Te he enviado apoyo!',
  '🙌 ¡Aguanta, estoy contigo!',
]

const isValidUUID = (id?: string | null): boolean => {
  if (!id) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

export default function FriendChatModal({
  friend,
  currentUserId,
  currentUserName,
  onClose,
}: FriendChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [isSending, setIsSending] = useState<boolean>(false)
  const [isRealProfile, setIsRealProfile] = useState<boolean>(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Load chat history & verify if receiver profile exists in Supabase DB
  useEffect(() => {
    if (!friend || !currentUserId) return

    let isMounted = true
    setLoading(true)

    // Guard clause: If IDs are not valid UUID format, handle as demo chat
    if (!isValidUUID(friend.id) || !isValidUUID(currentUserId)) {
      setIsRealProfile(false)
      setLoading(false)
      return
    }

    let channel: any = null

    const initChat = async () => {
      try {
        // 1. Verify that friend profile exists in profiles table (prevents FK constraint violation 23503)
        const { data: receiverProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', friend.id)
          .maybeSingle()

        if (!receiverProfile) {
          if (isMounted) {
            setIsRealProfile(false)
            setLoading(false)
          }
          return
        }

        if (isMounted) setIsRealProfile(true)

        // 2. Fetch real messages from DB
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .or(
            `and(sender_id.eq.${currentUserId},receiver_id.eq.${friend.id}),and(sender_id.eq.${friend.id},receiver_id.eq.${currentUserId})`
          )
          .order('created_at', { ascending: true })

        if (error) throw error

        if (isMounted) {
          setMessages(data || [])
          setTimeout(scrollToBottom, 100)
        }

        // 3. Realtime subscription
        channel = supabase
          .channel(`chat_${currentUserId}_${friend.id}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
            },
            (payload) => {
              const newMsg = payload.new as Message
              if (
                (newMsg.sender_id === friend.id && newMsg.receiver_id === currentUserId) ||
                (newMsg.sender_id === currentUserId && newMsg.receiver_id === friend.id)
              ) {
                setMessages((prev) => {
                  if (prev.some((m) => m.id === newMsg.id)) return prev
                  return [...prev, newMsg]
                })
                setTimeout(scrollToBottom, 100)
              }
            }
          )
          .subscribe()
      } catch (err) {
        console.error('Error loading chat messages:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    initChat()

    return () => {
      isMounted = false
      if (channel) supabase.removeChannel(channel)
    }
  }, [friend, currentUserId])

  const handleSendMessage = async (textToSend?: string) => {
    const content = (textToSend || inputText).trim()
    if (!content || !friend || !currentUserId || isSending) return

    setIsSending(true)
    const tempId = `temp-${Date.now()}`
    const optimisticMsg: Message = {
      id: tempId,
      sender_id: currentUserId,
      receiver_id: friend.id,
      content,
      read_at: null,
      created_at: new Date().toISOString(),
    }

    // Optimistic UI update
    setMessages((prev) => [...prev, optimisticMsg])
    if (!textToSend) setInputText('')
    setTimeout(scrollToBottom, 50)

    // If friend is not a registered profile in DB (demo/test friend), simulate friendly response locally
    if (!isRealProfile || !isValidUUID(friend.id) || !isValidUUID(currentUserId)) {
      setIsSending(false)
      setTimeout(scrollToBottom, 100)

      // Simulated supportive reply for demo friends
      setTimeout(() => {
        const replyMsg: Message = {
          id: `demo-reply-${Date.now()}`,
          sender_id: friend.id,
          receiver_id: currentUserId,
          content: `¡Gracias por el mensaje! 💪 Juntos lo vamos a conseguir, cuenta conmigo.`,
          read_at: null,
          created_at: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, replyMsg])
        setTimeout(scrollToBottom, 100)
      }, 700)
      return
    }

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: currentUserId,
          receiver_id: friend.id,
          content,
        })
        .select()
        .single()

      if (error) {
        // If FK error 23503 occurs, keep in local state gracefully
        if (error.code === '23503') {
          setIsRealProfile(false)
          return
        }
        throw error
      }

      if (data) {
        // Replace temp optimistic message with DB registered message
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? (data as Message) : m))
        )
      }
    } catch (err) {
      console.warn('Message kept in local state due to DB sync warning:', err)
    } finally {
      setIsSending(false)
      setTimeout(scrollToBottom, 100)
    }
  }

  if (!friend) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#F8FAF9] sm:rounded-3xl rounded-t-3xl h-[88dvh] sm:h-[620px] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300 border border-neutral-200/80">
        
        {/* CABECERA DEL CHAT */}
        <header className="bg-white px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between shadow-2xs shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold tracking-wider ${friend.avatarBg} ${friend.avatarText}`}
              >
                {friend.initials}
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-neutral-950 leading-tight">
                  {friend.name}
                </h3>
              </div>
              <span className="text-[11px] text-neutral-400 font-medium leading-none mt-0.5">
                {friend.status}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar chat"
            className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-500 hover:text-neutral-900 flex items-center justify-center transition-colors active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* ÁREA DE MENSAJES */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 flex flex-col">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-2 opacity-60">
              <div className="w-6 h-6 border-2 border-neutral-300 border-t-emerald-600 rounded-full animate-spin" />
              <p className="text-xs text-neutral-400">Cargando conversación...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-3 my-auto">
              <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <HeartHandshake className="w-7 h-7 stroke-[1.5]" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-neutral-900">
                  ¡Inicia la conversación con {friend.name.split(' ')[0]}!
                </p>
                <p className="text-xs text-neutral-400 max-w-[240px] leading-relaxed">
                  El apoyo mutuo multiplica por 3 las probabilidades de éxito sin fumar.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="text-center my-1">
                <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-300 bg-white/70 px-2.5 py-1 rounded-full border border-neutral-100">
                  Canal de apoyo seguro
                </span>
              </div>

              {messages.map((msg) => {
                const isMine = msg.sender_id === currentUserId
                const timeStr = new Date(msg.created_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} space-y-1`}
                  >
                    <div
                      className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-xs font-normal leading-relaxed shadow-2xs ${
                        isMine
                          ? 'bg-emerald-800 text-white rounded-br-xs'
                          : 'bg-white border border-neutral-200/80 text-neutral-900 rounded-bl-xs'
                      }`}
                    >
                      <p className="break-words">{msg.content}</p>
                    </div>
                    <span className="text-[10px] text-neutral-400 px-1 font-mono">
                      {timeStr}
                    </span>
                  </div>
                )
              })}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* PROMPTS RÁPIDOS DE APOYO */}
        <div className="px-4 py-1.5 overflow-x-auto flex gap-1.5 no-scrollbar shrink-0 bg-white/50 border-t border-neutral-100">
          {QUICK_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(prompt)}
              className="text-[11px] whitespace-nowrap bg-white border border-neutral-200 text-neutral-700 hover:border-emerald-500 hover:text-emerald-700 px-3 py-1.5 rounded-full transition-all active:scale-95 shadow-2xs font-medium shrink-0"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* BARRA DE ENTRADA DE MENSAJES */}
        <footer className="p-3 bg-white border-t border-neutral-100 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSendMessage()
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Escribe a ${friend.name.split(' ')[0]}...`}
              className="flex-1 h-11 px-4 bg-[#F8FAF9] border border-neutral-200 rounded-2xl text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-emerald-700 transition-colors"
            />

            <button
              type="submit"
              disabled={!inputText.trim() || isSending}
              className="w-11 h-11 bg-neutral-950 hover:bg-neutral-900 disabled:opacity-40 text-white rounded-2xl flex items-center justify-center transition-transform active:scale-95 shrink-0 shadow-xs"
              aria-label="Enviar mensaje"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </footer>
      </div>
    </div>
  )
}
