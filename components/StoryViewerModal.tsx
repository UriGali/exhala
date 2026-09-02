'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { X, Clock, Send, Loader2 } from 'lucide-react'
import confetti from 'canvas-confetti'
import { supabase } from '@/lib/supabase/client'
import { dispatchPushMessageToFriend } from '@/lib/push-notifications'

export interface StoryItem {
  id: string
  mediaUrl: string
  caption?: string | null
  createdAt: string
  expiresAt: string
}

export interface UserStoriesGroup {
  userId: string
  userName: string
  userInitials: string
  userRole: 'smoker' | 'friend'
  stories: StoryItem[]
}

interface StoryViewerModalProps {
  initialUserIndex: number
  usersWithStories: UserStoriesGroup[]
  currentUserId: string | null
  currentUserName?: string
  onClose: () => void
  onSendCheer?: (targetUserId: string, reaction: string) => void
}

const STORY_DURATION_MS = 5000

export default function StoryViewerModal({
  initialUserIndex,
  usersWithStories,
  currentUserId,
  currentUserName,
  onClose,
  onSendCheer,
}: StoryViewerModalProps) {
  const [currentUserIndex, setCurrentUserIndex] = useState<number>(initialUserIndex)
  const [currentStoryIndex, setCurrentStoryIndex] = useState<number>(0)
  const [isPaused, setIsPaused] = useState<boolean>(false)
  const [cheerFeedback, setCheerFeedback] = useState<string | null>(null)

  // Estados para deslizamiento hacia abajo (Swipe down to dismiss)
  const [dragY, setDragY] = useState<number>(0)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [isClosing, setIsClosing] = useState<boolean>(false)

  const touchStartY = useRef<number>(0)
  const touchStartX = useRef<number>(0)
  const isVerticalSwipe = useRef<boolean | null>(null)
  const storyTimerRef = useRef<any>(null)
  const storyStartTimeRef = useRef<number>(Date.now())
  const elapsedBeforePauseRef = useRef<number>(0)

  const activeUser = usersWithStories[currentUserIndex] || null
  const activeStories = activeUser?.stories || []
  const currentStory = activeStories[currentStoryIndex] || null

  // Navegar a la siguiente historia o usuario
  const handleNext = useCallback(() => {
    if (!activeUser) return

    if (currentStoryIndex < activeStories.length - 1) {
      setCurrentStoryIndex((prev) => prev + 1)
      elapsedBeforePauseRef.current = 0
      storyStartTimeRef.current = Date.now()
    } else if (currentUserIndex < usersWithStories.length - 1) {
      setCurrentUserIndex((prev) => prev + 1)
      setCurrentStoryIndex(0)
      elapsedBeforePauseRef.current = 0
      storyStartTimeRef.current = Date.now()
    } else {
      onClose()
    }
  }, [activeUser, currentStoryIndex, activeStories.length, currentUserIndex, usersWithStories.length, onClose])

  // Navegar a la historia o usuario anterior
  const handlePrev = useCallback(() => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex((prev) => prev - 1)
      elapsedBeforePauseRef.current = 0
      storyStartTimeRef.current = Date.now()
    } else if (currentUserIndex > 0) {
      const prevUserIdx = currentUserIndex - 1
      const prevStories = usersWithStories[prevUserIdx]?.stories || []
      setCurrentUserIndex(prevUserIdx)
      setCurrentStoryIndex(Math.max(0, prevStories.length - 1))
      elapsedBeforePauseRef.current = 0
      storyStartTimeRef.current = Date.now()
    }
  }, [currentStoryIndex, currentUserIndex, usersWithStories])

  // Temporizador ultra fluido por historia (sin renders cada 50ms)
  useEffect(() => {
    if (isPaused || isDragging || isClosing || !currentStory) {
      if (storyTimerRef.current) clearTimeout(storyTimerRef.current)
      return
    }

    const remainingTime = Math.max(
      300,
      STORY_DURATION_MS - elapsedBeforePauseRef.current
    )
    storyStartTimeRef.current = Date.now()

    storyTimerRef.current = setTimeout(() => {
      handleNext()
    }, remainingTime)

    return () => {
      if (storyTimerRef.current) clearTimeout(storyTimerRef.current)
    }
  }, [currentUserIndex, currentStoryIndex, isPaused, isDragging, isClosing, currentStory, handleNext])

  // Pausar y reanudar temporizador
  const pauseStory = () => {
    if (isPaused) return
    const elapsed = Date.now() - storyStartTimeRef.current
    elapsedBeforePauseRef.current += elapsed
    setIsPaused(true)
  }

  const resumeStory = () => {
    if (!isPaused) return
    setIsPaused(false)
  }

  // GESTO DESLIZAR HACIA ABAJO (Touch Events)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
    touchStartX.current = e.touches[0].clientX
    isVerticalSwipe.current = null
    pauseStory()
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const currentY = e.touches[0].clientY
    const currentX = e.touches[0].clientX
    const deltaY = currentY - touchStartY.current
    const deltaX = currentX - touchStartX.current

    // Detectar si el usuario está deslizando verticalmente
    if (isVerticalSwipe.current === null) {
      if (Math.abs(deltaY) > 8 || Math.abs(deltaX) > 8) {
        isVerticalSwipe.current = Math.abs(deltaY) > Math.abs(deltaX)
      }
    }

    if (isVerticalSwipe.current && deltaY > 0) {
      // Solo arrastrar hacia abajo con amortiguación
      setIsDragging(true)
      setDragY(deltaY)
    }
  }

  const handleTouchEnd = () => {
    resumeStory()
    if (isDragging) {
      setIsDragging(false)
      if (dragY > 90) {
        // Deslizado suficiente: cerrar con animación
        setIsClosing(true)
        setTimeout(() => {
          onClose()
        }, 220)
      } else {
        // Regresar a posición original suavemente
        setDragY(0)
      }
    }
  }

  // Calcular etiquetas de tiempo
  const getTimeLabels = (createdAtIso?: string, expiresAtIso?: string) => {
    if (!createdAtIso) return { timeAgo: 'Reciente', remaining: '24h' }
    try {
      const created = new Date(createdAtIso).getTime()
      const now = Date.now()
      const diffHours = Math.max(0, Math.floor((now - created) / (1000 * 3600)))
      const expires = expiresAtIso ? new Date(expiresAtIso).getTime() : created + 24 * 3600 * 1000
      const remainingHours = Math.max(1, Math.ceil((expires - now) / (1000 * 3600)))

      const timeAgo = diffHours < 1 ? 'Hace poco' : `Hace ${diffHours}h`
      return { timeAgo, remaining: `${remainingHours}h` }
    } catch {
      return { timeAgo: 'Reciente', remaining: '24h' }
    }
  }

  const handleReaction = (emoji: string, label: string) => {
    if (!activeUser) return

    try {
      confetti({
        particleCount: 30,
        spread: 50,
        origin: { y: 0.8 },
      })
    } catch {}

    setCheerFeedback(`¡Has enviado ${emoji} ${label}!`)
    setTimeout(() => setCheerFeedback(null), 2000)

    if (onSendCheer) {
      onSendCheer(activeUser.userId, `${emoji} ${label}`)
    }
  }

  // Estado para contestar abajo estilo Instagram y enviar directo al chat
  const [replyText, setReplyText] = useState<string>('')
  const [isSendingReply, setIsSendingReply] = useState<boolean>(false)
  const isOwnStory = activeUser?.userId === currentUserId

  const handleSendReply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!replyText.trim() || !currentUserId || !activeUser || isSendingReply) return

    const messageContent = replyText.trim()
    setIsSendingReply(true)

    try {
      // 1. Guardar en la tabla messages (chat directo con esa persona)
      const { data: newMsg, error } = await supabase
        .from('messages')
        .insert({
          sender_id: currentUserId,
          receiver_id: activeUser.userId,
          content: messageContent,
        })
        .select()
        .single()

      if (error) {
        console.warn('Notice saving reply to direct chat:', error.message)
      }

      // 2. Notificación push al móvil de esa persona
      dispatchPushMessageToFriend(
        activeUser.userId,
        currentUserName || 'Tu compañero',
        messageContent
      ).catch(() => {})

      // 3. Emitir evento Realtime al canal del chat privado
      const sortedIds = [currentUserId, activeUser.userId].sort()
      const channelName = `chat-room-${sortedIds[0]}-${sortedIds[1]}`
      const chatChannel = supabase.channel(channelName)
      chatChannel
        .send({
          type: 'broadcast',
          event: 'new_message',
          payload: newMsg || {
            id: 'msg-' + Date.now(),
            sender_id: currentUserId,
            receiver_id: activeUser.userId,
            content: messageContent,
            created_at: new Date().toISOString(),
          },
        })
        .catch(() => {})

      // 4. Confetti y feedback
      try {
        confetti({
          particleCount: 25,
          spread: 50,
          origin: { y: 0.88 },
          colors: ['#E8B75E', '#52B788', '#E8547C'],
        })
      } catch {}

      setCheerFeedback(`💬 Mensaje enviado a ${activeUser.userName.split(' ')[0]}`)
      setTimeout(() => setCheerFeedback(null), 2500)

      setReplyText('')
      resumeStory()
    } catch (err) {
      console.error('Error sending story reply:', err)
    } finally {
      setIsSendingReply(false)
    }
  }

  if (!activeUser || !currentStory) return null

  const { timeAgo, remaining } = getTimeLabels(currentStory.createdAt, currentStory.expiresAt)

  // Cálculo de transformación durante el arrastre vertical
  const translateY = isClosing ? 800 : dragY
  const scale = Math.max(0.86, 1 - dragY / 900)
  const opacity = Math.max(0.3, 1 - dragY / 350)
  const backdropOpacity = Math.max(0, 1 - dragY / 250)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 select-none touch-none"
      style={{
        backgroundColor: `rgba(0, 0, 0, ${0.95 * backdropOpacity})`,
        transition: isDragging ? 'none' : 'background-color 0.25s ease',
      }}
    >
      <style>{`
        @keyframes storyFillAnim {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>

      {/* CONTENEDOR ESTILO INSTAGRAM CON SWIPE DOWN TO DISMISS */}
      <div
        className="w-full sm:w-[390px] h-full sm:h-[780px] sm:rounded-[34px] overflow-hidden relative flex flex-col bg-black border sm:border-[rgba(232,183,94,0.18)] shadow-2xl will-change-transform"
        style={{
          transform: `translate3d(0, ${translateY}px, 0) scale(${scale})`,
          opacity: isClosing ? 0 : opacity,
          borderRadius: dragY > 15 ? '32px' : undefined,
          transition: isDragging
            ? 'none'
            : 'transform 0.26s cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.22s ease, border-radius 0.2s ease',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={pauseStory}
        onMouseUp={resumeStory}
      >
        {/* ============================================================== */}
        {/* IMAGEN DE FONDO DE LA HISTORIA                                 */}
        {/* ============================================================== */}
        <div className="absolute inset-0 z-0 bg-[#121212]">
          <img
            key={currentStory.id}
            src={currentStory.mediaUrl}
            alt="Historia"
            className="w-full h-full object-cover pointer-events-none"
          />
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/80 via-black/35 to-transparent pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/90 via-black/45 to-transparent pointer-events-none" />
        </div>

        {/* ============================================================== */}
        {/* INDICADOR VISUAL SUTIL PARA DESLIZAR HACIA ABAJO               */}
        {/* ============================================================== */}
        <div className="absolute top-1.5 inset-x-0 z-30 flex justify-center pointer-events-none">
          <div className="w-10 h-1 rounded-full bg-white/30 backdrop-blur-sm" />
        </div>

        {/* ============================================================== */}
        {/* ZONAS TÁCTILES PARA AVANZAR O RETROCEDER                       */}
        {/* ============================================================== */}
        <div className="absolute inset-0 z-10 flex pointer-events-auto">
          <div
            className="w-1/3 h-full cursor-pointer"
            onClick={(e) => {
              e.stopPropagation()
              if (!isDragging) handlePrev()
            }}
          />
          <div
            className="w-2/3 h-full cursor-pointer"
            onClick={(e) => {
              e.stopPropagation()
              if (!isDragging) handleNext()
            }}
          />
        </div>

        {/* ============================================================== */}
        {/* BARRAS DE PROGRESO SUPERIORES CON ANIMACIÓN GPU PURA           */}
        {/* ============================================================== */}
        <div className="relative z-20 pt-4 px-3 pb-1 flex gap-1.5 items-center pointer-events-none">
          {activeStories.map((st, idx) => {
            const isFinished = idx < currentStoryIndex
            const isCurrent = idx === currentStoryIndex

            return (
              <div
                key={st.id}
                className="flex-1 h-1 rounded-full bg-white/25 overflow-hidden backdrop-blur-sm"
              >
                <div
                  className="h-full bg-gradient-to-r from-[#EFC471] to-[#E8B75E]"
                  style={{
                    width: isFinished ? '100%' : isCurrent ? '100%' : '0%',
                    animation: isCurrent
                      ? `storyFillAnim ${STORY_DURATION_MS}ms linear forwards`
                      : 'none',
                    animationPlayState: isPaused || isDragging ? 'paused' : 'running',
                  }}
                />
              </div>
            )
          })}
        </div>

        {/* ============================================================== */}
        {/* CABECERA CON AUTOR, TIEMPO Y BOTÓN CERRAR                      */}
        {/* ============================================================== */}
        <header className="relative z-20 px-3.5 py-2 flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#EFC471] to-[#E8B75E] text-[#2B1C08] font-bold text-xs flex items-center justify-center border-2 border-white/20 shadow-md">
              {activeUser.userInitials}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13.5px] font-semibold text-white truncate shadow-sm">
                  {activeUser.userName}
                </span>
                <span className="text-[10px] text-[#A9BBA4] bg-white/10 px-1.5 py-0.5 rounded-full border border-white/10">
                  {timeAgo}
                </span>
              </div>

              <div className="flex items-center gap-1 text-[10.5px] text-[#E8B75E]">
                <Clock className="w-3 h-3" />
                <span>Expira en {remaining}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors flex items-center justify-center backdrop-blur-md border border-white/10 cursor-pointer"
            aria-label="Cerrar historia"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* ESPACIADOR CENTRAL */}
        <div className="flex-1" />

        {/* TOAST DE REACCIÓN */}
        {cheerFeedback && (
          <div className="relative z-30 mx-4 mb-2 p-2.5 rounded-2xl bg-black/80 border border-[#E8B75E]/30 text-xs text-[#F1EEE2] text-center backdrop-blur-md animate-in fade-in zoom-in">
            {cheerFeedback}
          </div>
        )}

        {/* ============================================================== */}
        {/* PIE DE FOTO / MENSAJE                                          */}
        {/* ============================================================== */}
        {currentStory.caption && (
          <div className="relative z-20 px-4 pb-3 pointer-events-none">
            <div className="p-3 rounded-2xl bg-black/65 backdrop-blur-md border border-white/10 text-[13px] text-[#F1EEE2] leading-relaxed shadow-lg">
              {currentStory.caption}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* BARRA DE RESPUESTA DIRECTA AL CHAT (ESTILO INSTAGRAM)         */}
        {/* ============================================================== */}
        <footer className="relative z-20 p-3 pt-2 pb-4 border-t border-white/10 bg-black/60 backdrop-blur-lg pointer-events-auto">
          {isOwnStory ? (
            <div className="flex items-center justify-between text-xs text-[#A9BBA4] px-2 py-1">
              <span className="font-medium text-[#E8B75E]">Tu historia</span>
              <span className="text-[11px] text-[#7C9481]">Visible para tus amigos por 24h</span>
            </div>
          ) : (
            <div className="space-y-2">
              <form
                onSubmit={handleSendReply}
                className="flex items-center gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onFocus={() => {
                      pauseStory()
                    }}
                    onBlur={() => {
                      if (!replyText) resumeStory()
                    }}
                    placeholder={`Responder a ${activeUser.userName.split(' ')[0]}...`}
                    maxLength={300}
                    className="w-full h-10 pl-4 pr-10 rounded-full bg-white/15 border border-white/20 text-white text-[13px] placeholder:text-white/60 focus:outline-none focus:border-[#E8B75E] focus:bg-white/20 transition-all shadow-inner"
                  />
                  {replyText.trim().length > 0 && (
                    <button
                      type="submit"
                      disabled={isSendingReply}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-gradient-to-r from-[#EFC471] to-[#E8B75E] text-[#1B1710] flex items-center justify-center cursor-pointer transition-transform hover:scale-105 active:scale-95 shadow-sm disabled:opacity-50"
                    >
                      {isSendingReply ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>

                {/* Botón de reacción rápida corazón si no está escribiendo */}
                {replyText.trim().length === 0 && (
                  <button
                    type="button"
                    onClick={() => handleReaction('❤️', 'Apoyo')}
                    className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 transition-all flex items-center justify-center text-lg text-white border border-white/15 shrink-0 cursor-pointer"
                    title="Enviar apoyo rápido"
                  >
                    ❤️
                  </button>
                )}
              </form>

              {/* Reacciones rápidas */}
              <div className="flex items-center justify-between gap-1.5 px-1">
                {[
                  { emoji: '💧', label: 'Nutrir' },
                  { emoji: '💪', label: 'Ánimo' },
                  { emoji: '🌿', label: 'Limpio' },
                  { emoji: '🔥', label: 'Fuego' },
                ].map((reac) => (
                  <button
                    key={reac.emoji}
                    type="button"
                    onClick={() => handleReaction(reac.emoji, reac.label)}
                    className="flex-1 py-1 rounded-full bg-white/5 hover:bg-white/15 active:scale-95 transition-all text-[11px] text-white/80 border border-white/5 flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>{reac.emoji}</span>
                    <span className="text-[10px] hidden xs:inline">{reac.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </footer>
      </div>
    </div>
  )
}
