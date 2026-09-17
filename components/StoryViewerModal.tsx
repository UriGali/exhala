'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  X,
  Clock,
  Send,
  Loader2,
  Heart,
  Droplets,
  Sparkles,
  Flame,
  Shield,
  Eye,
  ChevronUp,
  Users,
} from 'lucide-react'
import confetti from 'canvas-confetti'
import { supabase } from '@/lib/supabase/client'
import { dispatchPushMessageToFriend } from '@/lib/push-notifications'

export interface StoryViewerInfo {
  id: string
  name: string
  initials: string
  avatarUrl?: string | null
  role?: 'smoker' | 'friend'
  viewedAt: string
}

export interface StoryItem {
  id: string
  mediaUrl: string
  caption?: string | null
  createdAt: string
  expiresAt: string
  viewers?: StoryViewerInfo[]
  viewsCount?: number
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

  // Drawer / Bottom Sheet de visualizaciones para historias propias
  const [showViewersModal, setShowViewersModal] = useState<boolean>(false)
  const [liveViewers, setLiveViewers] = useState<StoryViewerInfo[]>([])
  const [isLoadingViewers, setIsLoadingViewers] = useState<boolean>(false)

  // Registro de visualizaciones ya enviadas en la sesión
  const recordedViewsRef = useRef<Set<string>>(new Set())

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
  const isOwnStory = activeUser?.userId === currentUserId

  // Sincronizar los viewers de la historia activa
  useEffect(() => {
    if (currentStory?.viewers) {
      setLiveViewers(currentStory.viewers)
    } else {
      setLiveViewers([])
    }
  }, [currentStory?.id, currentStory?.viewers])

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

  // Registrar visualización cuando un amigo ve una historia ajena
  useEffect(() => {
    if (!currentStory?.id || !currentUserId) return
    if (activeUser?.userId === currentUserId) return // No registrar visualización propia

    if (!recordedViewsRef.current.has(currentStory.id)) {
      recordedViewsRef.current.add(currentStory.id)
      fetch('/api/stories/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyId: currentStory.id,
          viewerId: currentUserId,
        }),
      }).catch((err) => {
        console.warn('Notice recording story view:', err)
      })
    }
  }, [currentStory?.id, currentUserId, activeUser?.userId])

  // Consultar lista en tiempo real de visualizadores si abre el modal de 'Visto por'
  useEffect(() => {
    if (showViewersModal && currentStory?.id && isOwnStory) {
      setIsLoadingViewers(true)
      fetch(`/api/stories/view?storyId=${currentStory.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.viewers)) {
            setLiveViewers(data.viewers)
          }
        })
        .catch((err) => console.warn('Notice fetching real-time viewers:', err))
        .finally(() => setIsLoadingViewers(false))
    }
  }, [showViewersModal, currentStory?.id, isOwnStory])

  // Temporizador ultra fluido por historia
  useEffect(() => {
    if (isPaused || isDragging || isClosing || showViewersModal || !currentStory) {
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
  }, [currentUserIndex, currentStoryIndex, isPaused, isDragging, isClosing, showViewersModal, currentStory, handleNext])

  // Pausar y reanudar temporizador
  const pauseStory = () => {
    if (isPaused) return
    const elapsed = Date.now() - storyStartTimeRef.current
    elapsedBeforePauseRef.current += elapsed
    setIsPaused(true)
  }

  const resumeStory = () => {
    if (showViewersModal) return
    if (!isPaused) return
    setIsPaused(false)
  }

  // GESTO DESLIZAR (Touch Events para dismiss hacia abajo o abrir viewers hacia arriba)
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

    if (isVerticalSwipe.current === null) {
      if (Math.abs(deltaY) > 8 || Math.abs(deltaX) > 8) {
        isVerticalSwipe.current = Math.abs(deltaY) > Math.abs(deltaX)
      }
    }

    if (isVerticalSwipe.current && deltaY > 0 && !showViewersModal) {
      // Arrastrar hacia abajo para descartar
      setIsDragging(true)
      setDragY(deltaY)
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const endY = e.changedTouches?.[0]?.clientY ?? touchStartY.current
    const deltaY = endY - touchStartY.current

    if (isDragging) {
      setIsDragging(false)
      if (dragY > 90) {
        setIsClosing(true)
        setTimeout(() => {
          onClose()
        }, 220)
        return
      } else {
        setDragY(0)
      }
    }

    // Deslizar hacia arriba en historia propia para abrir panel de vistas
    if (isOwnStory && deltaY < -40 && !showViewersModal) {
      pauseStory()
      setShowViewersModal(true)
      return
    }

    if (!showViewersModal) {
      resumeStory()
    }
  }

  // Formatear tiempo relativo
  const formatRelativeTime = (isoString?: string) => {
    if (!isoString) return 'Hace un momento'
    try {
      const diffMs = Date.now() - new Date(isoString).getTime()
      const diffMins = Math.floor(diffMs / (1000 * 60))
      if (diffMins < 1) return 'Hace un momento'
      if (diffMins < 60) return `Hace ${diffMins} min`
      const diffHours = Math.floor(diffMins / 60)
      if (diffHours < 24) return `Hace ${diffHours}h`
      return 'Hace 1d'
    } catch {
      return 'Hace poco'
    }
  }

  // Calcular etiquetas de tiempo de la historia
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

  const handleReaction = (iconLabel: string, label: string) => {
    if (!activeUser) return

    try {
      confetti({
        particleCount: 30,
        spread: 50,
        origin: { y: 0.8 },
      })
    } catch {}

    setCheerFeedback(`¡Has enviado apoyo: ${label}!`)
    setTimeout(() => setCheerFeedback(null), 2000)

    if (onSendCheer) {
      onSendCheer(activeUser.userId, label)
    }
  }

  // Estado para contestar abajo estilo Instagram y enviar directo al chat
  const [replyText, setReplyText] = useState<string>('')
  const [isSendingReply, setIsSendingReply] = useState<boolean>(false)

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

      setCheerFeedback(`Mensaje enviado a ${activeUser.userName.split(' ')[0]}`)
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

  // Cantidad total de visualizaciones activas
  const totalViewsCount = liveViewers.length > 0 ? liveViewers.length : (currentStory.viewsCount || 0)

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
          <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/95 via-black/60 to-transparent pointer-events-none" />
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
              if (!isDragging && !showViewersModal) handlePrev()
            }}
          />
          <div
            className="w-2/3 h-full cursor-pointer"
            onClick={(e) => {
              e.stopPropagation()
              if (!isDragging && !showViewersModal) handleNext()
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
                    animationPlayState: isPaused || isDragging || showViewersModal ? 'paused' : 'running',
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
        {/* BARRA INFERIOR: RESPUESTA O VISOR DE AMIGOS (ESTILO INSTAGRAM) */}
        {/* ============================================================== */}
        <footer className="relative z-20 p-3 pt-2 pb-4 border-t border-white/10 bg-black/70 backdrop-blur-xl pointer-events-auto">
          {isOwnStory ? (
            /* ============================================================ */
            /* BARRA INTERACTIVA 'VISTO POR...' PARA LA HISTORIA PROPIA      */
            /* ============================================================ */
            <div
              onClick={() => {
                pauseStory()
                setShowViewersModal(true)
              }}
              className="group flex items-center justify-between p-2.5 rounded-2xl bg-white/[0.08] hover:bg-white/[0.14] active:scale-[0.98] border border-[rgba(232,183,94,0.3)] transition-all cursor-pointer shadow-lg backdrop-blur-md"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Pila de avatares superpuestos si hay amigos que la vieron */}
                {liveViewers.length > 0 ? (
                  <div className="flex items-center -space-x-2 shrink-0">
                    {liveViewers.slice(0, 3).map((v, idx) => (
                      <div
                        key={v.id + idx}
                        className="w-6 h-6 rounded-full bg-gradient-to-br from-[#52B788] via-[#E8B75E] to-[#6FCB8A] text-[#1B1710] font-bold text-[9px] flex items-center justify-center border-2 border-[#16241C] shadow-sm shrink-0"
                        title={v.name}
                      >
                        {v.initials}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full bg-[rgba(232,183,94,0.15)] flex items-center justify-center text-[#E8B75E] shrink-0 border border-[rgba(232,183,94,0.3)]">
                    <Eye className="w-3.5 h-3.5" />
                  </div>
                )}

                <div className="flex flex-col text-left min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12.5px] font-bold text-white truncate">
                      {totalViewsCount === 0
                        ? '0 visualizaciones'
                        : totalViewsCount === 1
                        ? '1 persona la vio'
                        : `${totalViewsCount} personas la vieron`}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#E8B75E]/20 text-[#E8B75E] font-medium shrink-0">
                      Tu historia
                    </span>
                  </div>
                  <span className="text-[10px] text-[#A9BBA4] truncate">
                    {totalViewsCount > 0
                      ? 'Toca o desliza hacia arriba para ver la lista'
                      : 'Visible para tus amigos durante 24 horas'}
                  </span>
                </div>
              </div>

              {/* Botón / Flecha de deslizar */}
              <div className="flex items-center gap-1 text-[#E8B75E] text-xs font-semibold pl-2 shrink-0">
                <ChevronUp className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
              </div>
            </div>
          ) : (
            /* ============================================================ */
            /* BARRA DE RESPUESTA A HISTORIA DE AMIGO                        */
            /* ============================================================ */
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
                    onClick={() => handleReaction('heart', 'Mucho ánimo')}
                    className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 transition-all flex items-center justify-center text-white border border-white/15 shrink-0 cursor-pointer"
                    title="Enviar apoyo rápido"
                  >
                    <Heart className="w-5 h-5 fill-[#E8547C] text-[#E8547C]" />
                  </button>
                )}
              </form>

              {/* Reacciones rápidas */}
              <div className="flex items-center justify-between gap-1.5 px-1">
                {[
                  { icon: Droplets, color: 'text-sky-300', fill: 'fill-sky-300', label: 'Nutrir' },
                  { icon: Sparkles, color: 'text-amber-300', fill: 'fill-amber-300', label: 'Ánimo' },
                  { icon: Shield, color: 'text-emerald-300', fill: 'fill-emerald-300', label: 'Firme' },
                  { icon: Flame, color: 'text-rose-400', fill: 'fill-rose-400', label: 'Fuerza' },
                ].map((reac, i) => {
                  const IconComponent = reac.icon
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleReaction(reac.label, reac.label)}
                      className="flex-1 py-1.5 rounded-full bg-white/5 hover:bg-white/15 active:scale-95 transition-all text-[11px] text-white/90 border border-white/10 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <IconComponent className={`w-3.5 h-3.5 ${reac.color}`} />
                      <span className="text-[10.5px] font-medium hidden xs:inline">{reac.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </footer>

        {/* ============================================================== */}
        {/* MODAL / DRAWER BOTTOM SHEET DE 'VISTO POR...' ESTILO INSTAGRAM */}
        {/* ============================================================== */}
        {showViewersModal && (
          <div
            className="absolute inset-0 z-40 bg-black/75 backdrop-blur-xl flex flex-col justify-end animate-in fade-in duration-200"
            onClick={(e) => {
              e.stopPropagation()
              setShowViewersModal(false)
              resumeStory()
            }}
          >
            <div
              className="w-full max-h-[75%] bg-[#121B16] rounded-t-[30px] border-t border-[rgba(232,183,94,0.35)] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300 pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Encabezado y barra para arrastrar */}
              <div className="pt-3 pb-3 px-5 flex flex-col items-center border-b border-white/10 bg-[#16241C]/80">
                <div className="w-11 h-1 rounded-full bg-white/30 mb-3" />
                <div className="w-full flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[rgba(232,183,94,0.15)] flex items-center justify-center text-[#E8B75E]">
                      <Eye className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-[14px] font-bold text-[#F1EEE2]">
                        Visto por {totalViewsCount} {totalViewsCount === 1 ? 'amigo' : 'amigos'}
                      </h3>
                      <p className="text-[10.5px] text-[#A9BBA4]">
                        Personas que abrieron tu historia
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowViewersModal(false)
                      resumeStory()
                    }}
                    className="w-7 h-7 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors flex items-center justify-center cursor-pointer"
                    aria-label="Cerrar lista de espectadores"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Lista de amigos que han visto la historia */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2.5 max-h-[380px] no-scrollbar">
                {isLoadingViewers ? (
                  <div className="py-10 flex flex-col items-center justify-center gap-2 text-white/60">
                    <Loader2 className="w-6 h-6 animate-spin text-[#E8B75E]" />
                    <span className="text-xs">Cargando espectadores...</span>
                  </div>
                ) : liveViewers.length === 0 ? (
                  <div className="py-10 px-4 text-center flex flex-col items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-[rgba(232,183,94,0.1)] border border-[rgba(232,183,94,0.2)] flex items-center justify-center text-[#E8B75E] mb-3">
                      <Users className="w-6 h-6" />
                    </div>
                    <p className="text-[13.5px] font-semibold text-[#F1EEE2] mb-1">
                      Aún no hay visualizaciones
                    </p>
                    <p className="text-[11.5px] text-[#A9BBA4] max-w-[240px] leading-relaxed">
                      Cuando tus amigos abran tu historia de hoy, aparecerán aquí con la hora exacta en que la vieron.
                    </p>
                  </div>
                ) : (
                  liveViewers.map((viewer) => {
                    const isSmoker = viewer.role === 'smoker'
                    const roleLabel = isSmoker ? 'Compañero' : 'Guardián'
                    const timeAgoStr = formatRelativeTime(viewer.viewedAt)

                    return (
                      <div
                        key={viewer.id}
                        className="flex items-center justify-between p-2.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Avatar con gradiente botánico */}
                          <div
                            className={`w-10 h-10 rounded-full p-[2px] bg-gradient-to-tr ${
                              isSmoker
                                ? 'from-[#E8B75E] to-[#EFC471]'
                                : 'from-[#52B788] to-[#A796D8]'
                            } shrink-0`}
                          >
                            <div className="w-full h-full rounded-full bg-[#16241C] flex items-center justify-center font-bold text-xs text-[#F1EEE2]">
                              {viewer.initials}
                            </div>
                          </div>

                          <div className="min-w-0 text-left">
                            <p className="text-[13px] font-semibold text-[#F1EEE2] truncate">
                              {viewer.name}
                            </p>
                            <div className="flex items-center gap-1.5 text-[10.5px]">
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9.5px] font-medium ${
                                  isSmoker
                                    ? 'bg-[#E8B75E]/20 text-[#E8B75E]'
                                    : 'bg-[#52B788]/20 text-[#52B788]'
                                }`}
                              >
                                {roleLabel}
                              </span>
                              <span className="text-[#A9BBA4]">·</span>
                              <span className="text-[#A9BBA4]">{timeAgoStr}</span>
                            </div>
                          </div>
                        </div>

                        {/* Indicador de visto */}
                        <div className="flex items-center gap-1 shrink-0 px-2 py-1 rounded-full bg-[#52B788]/10 text-[#52B788] text-[11px] font-medium border border-[#52B788]/20">
                          <Eye className="w-3 h-3" />
                          <span>Visto</span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
