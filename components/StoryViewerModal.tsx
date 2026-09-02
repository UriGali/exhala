'use client'

import React, { useState, useEffect, useRef } from 'react'
import { X, ChevronLeft, ChevronRight, Heart, Sparkles, Clock } from 'lucide-react'
import confetti from 'canvas-confetti'

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
  onClose: () => void
  onSendCheer?: (targetUserId: string, reaction: string) => void
}

const STORY_DURATION_MS = 5000

export default function StoryViewerModal({
  initialUserIndex,
  usersWithStories,
  currentUserId,
  onClose,
  onSendCheer,
}: StoryViewerModalProps) {
  const [currentUserIndex, setCurrentUserIndex] = useState<number>(initialUserIndex)
  const [currentStoryIndex, setCurrentStoryIndex] = useState<number>(0)
  const [progress, setProgress] = useState<number>(0)
  const [isPaused, setIsPaused] = useState<boolean>(false)
  const [cheerFeedback, setCheerFeedback] = useState<string | null>(null)
  const progressTimerRef = useRef<any>(null)

  const activeUser = usersWithStories[currentUserIndex] || null
  const activeStories = activeUser?.stories || []
  const currentStory = activeStories[currentStoryIndex] || null

  // Navegar a la siguiente historia o siguiente usuario
  const handleNext = () => {
    if (!activeUser) return

    if (currentStoryIndex < activeStories.length - 1) {
      setCurrentStoryIndex((prev) => prev + 1)
      setProgress(0)
    } else if (currentUserIndex < usersWithStories.length - 1) {
      setCurrentUserIndex((prev) => prev + 1)
      setCurrentStoryIndex(0)
      setProgress(0)
    } else {
      onClose()
    }
  }

  // Navegar a la historia anterior o usuario anterior
  const handlePrev = () => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex((prev) => prev - 1)
      setProgress(0)
    } else if (currentUserIndex > 0) {
      const prevUserIdx = currentUserIndex - 1
      const prevUserStories = usersWithStories[prevUserIdx]?.stories || []
      setCurrentUserIndex(prevUserIdx)
      setCurrentStoryIndex(Math.max(0, prevUserStories.length - 1))
      setProgress(0)
    }
  }

  // Timer de progreso continuo
  useEffect(() => {
    if (isPaused || !currentStory) return

    const intervalMs = 50
    const increment = (intervalMs / STORY_DURATION_MS) * 100

    progressTimerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressTimerRef.current)
          handleNext()
          return 0
        }
        return prev + increment
      })
    }, intervalMs)

    return () => clearInterval(progressTimerRef.current)
  }, [currentUserIndex, currentStoryIndex, isPaused, currentStory])

  // Calcular tiempo transcurrido y horas restantes para expirar
  const getTimeLabels = (createdAtIso?: string, expiresAtIso?: string) => {
    if (!createdAtIso) return { timeAgo: 'Reciente', remaining: '24h' }
    try {
      const created = new Date(createdAtIso).getTime()
      const now = Date.now()
      const diffHours = Math.max(0, Math.floor((now - created) / (1000 * 3600)))
      const expires = expiresAtIso ? new Date(expiresAtIso).getTime() : created + 24 * 3600 * 1000
      const remainingHours = Math.max(1, Math.ceil((expires - now) / (1000 * 3600)))

      const timeAgo = diffHours < 1 ? 'Hace unos momentos' : `Hace ${diffHours}h`
      return { timeAgo, remaining: `${remainingHours}h` }
    } catch {
      return { timeAgo: 'Reciente', remaining: '24h' }
    }
  }

  // Enviar reacción de apoyo
  const handleReaction = (emoji: string, label: string) => {
    if (!activeUser) return

    try {
      confetti({
        particleCount: 35,
        spread: 60,
        origin: { y: 0.8 },
      })
    } catch {}

    setCheerFeedback(`¡Has enviado ${emoji} ${label}!`)
    setTimeout(() => setCheerFeedback(null), 2500)

    if (onSendCheer) {
      onSendCheer(activeUser.userId, `${emoji} ${label}`)
    }
  }

  if (!activeUser || !currentStory) return null

  const { timeAgo, remaining } = getTimeLabels(currentStory.createdAt, currentStory.expiresAt)

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex items-center justify-center p-0 sm:p-4 select-none">
      {/* CONTENEDOR ESTILO HISTORIA INSTAGRAM (390px x 780px máx) */}
      <div
        className="w-full sm:w-[390px] h-full sm:h-[800px] sm:rounded-[34px] overflow-hidden relative flex flex-col bg-black border sm:border-[rgba(232,183,94,0.18)] shadow-2xl"
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* ============================================================== */}
        {/* IMAGEN DE FONDO DE LA HISTORIA                                 */}
        {/* ============================================================== */}
        <div className="absolute inset-0 z-0">
          <img
            src={currentStory.mediaUrl}
            alt="Historia"
            className="w-full h-full object-cover"
          />
          {/* Degradado superior para legibilidad de cabecera */}
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none" />
          {/* Degradado inferior para legibilidad de pie de foto */}
          <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none" />
        </div>

        {/* ============================================================== */}
        {/* ZONAS TÁCTILES PARA AVANZAR O RETROCEDER                       */}
        {/* ============================================================== */}
        <div className="absolute inset-0 z-10 flex">
          {/* Mitad izquierda: retroceder */}
          <div
            className="w-1/3 h-full cursor-pointer"
            onClick={(e) => {
              e.stopPropagation()
              handlePrev()
            }}
          />
          {/* Mitad derecha: avanzar */}
          <div
            className="w-2/3 h-full cursor-pointer"
            onClick={(e) => {
              e.stopPropagation()
              handleNext()
            }}
          />
        </div>

        {/* ============================================================== */}
        {/* BARRAS DE PROGRESO SUPERIORES                                  */}
        {/* ============================================================== */}
        <div className="relative z-20 pt-3 px-3 pb-1 flex gap-1.5 items-center">
          {activeStories.map((st, idx) => {
            let widthPercent = 0
            if (idx < currentStoryIndex) widthPercent = 100
            else if (idx === currentStoryIndex) widthPercent = progress
            else widthPercent = 0

            return (
              <div
                key={st.id}
                className="flex-1 h-1 rounded-full bg-white/25 overflow-hidden backdrop-blur-sm"
              >
                <div
                  className="h-full bg-gradient-to-r from-[#EFC471] to-[#E8B75E] transition-all duration-75 ease-linear"
                  style={{ width: `${widthPercent}%` }}
                />
              </div>
            )
          })}
        </div>

        {/* ============================================================== */}
        {/* CABECERA CON AUTOR, TIEMPO Y BOTÓN CERRAR                      */}
        {/* ============================================================== */}
        <header className="relative z-20 px-3.5 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Avatar */}
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

        {/* TOAST DE FEEDBACK DE REACCIÓN */}
        {cheerFeedback && (
          <div className="relative z-30 mx-4 mb-2 p-2.5 rounded-2xl bg-black/80 border border-[#E8B75E]/30 text-xs text-[#F1EEE2] text-center backdrop-blur-md animate-in fade-in zoom-in">
            {cheerFeedback}
          </div>
        )}

        {/* ============================================================== */}
        {/* PIE DE FOTO / MENSAJE                                          */}
        {/* ============================================================== */}
        {currentStory.caption && (
          <div className="relative z-20 px-4 pb-3">
            <div className="p-3 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 text-[13px] text-[#F1EEE2] leading-relaxed shadow-lg">
              {currentStory.caption}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* BARRA DE REACCIONES RÁPIDAS                                    */}
        {/* ============================================================== */}
        <footer className="relative z-20 p-3 pt-1 border-t border-white/10 bg-black/40 backdrop-blur-md flex items-center justify-around gap-2">
          <button
            type="button"
            onClick={() => handleReaction('💧', 'Vitalidad')}
            className="flex items-center gap-1.5 py-2 px-3 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-xs text-white border border-white/10 cursor-pointer"
            title="Enviar agua a su planta"
          >
            <span className="text-base">💧</span>
            <span className="font-medium">Nutrir</span>
          </button>

          <button
            type="button"
            onClick={() => handleReaction('💪', 'Fuerza')}
            className="flex items-center gap-1.5 py-2 px-3 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-xs text-white border border-white/10 cursor-pointer"
            title="Enviar fuerza"
          >
            <span className="text-base">💪</span>
            <span className="font-medium">Ánimo</span>
          </button>

          <button
            type="button"
            onClick={() => handleReaction('🌿', 'Aire Limpio')}
            className="flex items-center gap-1.5 py-2 px-3 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-xs text-white border border-white/10 cursor-pointer"
            title="Celebrar aire limpio"
          >
            <span className="text-base">🌿</span>
            <span className="font-medium">Limpio</span>
          </button>

          <button
            type="button"
            onClick={() => handleReaction('❤️', 'Apoyo')}
            className="flex items-center gap-1.5 py-2 px-3 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-xs text-white border border-white/10 cursor-pointer"
            title="Enviar apoyo"
          >
            <span className="text-base">❤️</span>
            <span className="font-medium">Apoyo</span>
          </button>
        </footer>
      </div>
    </div>
  )
}
