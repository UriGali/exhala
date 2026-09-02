'use client'

import React, { useRef } from 'react'
import { Plus } from 'lucide-react'
import { UserStoriesGroup } from '@/components/StoryViewerModal'

interface StoriesBarProps {
  currentUserId: string | null
  currentUserName: string
  usersWithStories: UserStoriesGroup[]
  onOpenCreateStory: (initialImg?: string | null) => void
  onOpenStoryViewer: (userIndex: number) => void
}

export default function StoriesBar({
  currentUserId,
  currentUserName,
  usersWithStories,
  onOpenCreateStory,
  onOpenStoryViewer,
}: StoriesBarProps) {
  const directCameraInputRef = useRef<HTMLInputElement>(null)

  // Identificar si el usuario actual ya tiene alguna historia activa (< 24h)
  const myStoriesGroupIndex = usersWithStories.findIndex(
    (u) => u.userId === currentUserId
  )
  const hasMyStories =
    myStoriesGroupIndex !== -1 &&
    usersWithStories[myStoriesGroupIndex].stories.length > 0

  const myInitials = (currentUserName || 'TÚ')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  // Amigos que tienen historias (excluyendo la propia para no duplicar en la lista)
  const friendStoryGroups = usersWithStories
    .map((grp, originalIdx) => ({ grp, originalIdx }))
    .filter(({ grp }) => grp.userId !== currentUserId)

  // Abrir cámara directamente al tocar
  const handleTriggerCamera = () => {
    if (directCameraInputRef.current) {
      directCameraInputRef.current.value = ''
      directCameraInputRef.current.click()
    } else {
      onOpenCreateStory(null)
    }
  }

  const handleFileCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      onOpenCreateStory(null)
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string
      onOpenCreateStory(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="w-full relative z-10 my-[14px]">
      {/* INPUT NATIVO DE CÁMARA DIRECTA */}
      <input
        ref={directCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileCapture}
      />

      <div className="flex items-center gap-3.5 overflow-x-auto no-scrollbar px-[4px] py-1">
        {/* ============================================================== */}
        {/* 1. "TU HISTORIA" (+ / VER PROPIA)                              */}
        {/* ============================================================== */}
        <div className="flex flex-col items-center gap-1.5 shrink-0 group">
          <div className="relative">
            {hasMyStories ? (
              /* ARO LUMINOSO DE HISTORIA ACTIVA */
              <button
                type="button"
                onClick={() => onOpenStoryViewer(myStoriesGroupIndex)}
                className="w-[58px] h-[58px] rounded-full p-[2.5px] bg-gradient-to-tr from-[#52B788] via-[#E8B75E] to-[#A796D8] cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-md"
                title="Ver tu historia de hoy"
              >
                <div className="w-full h-full rounded-full bg-[#16241C] p-[2px]">
                  <div className="w-full h-full rounded-full bg-gradient-to-br from-[#EFC471] to-[#E8B75E] text-[#1B1710] font-bold text-[13px] flex items-center justify-center">
                    {myInitials}
                  </div>
                </div>
              </button>
            ) : (
              /* SIN HISTORIA ACTIVA: TOCA PARA ABRIR CÁMARA DIRECTAMENTE */
              <button
                type="button"
                onClick={handleTriggerCamera}
                className="w-[58px] h-[58px] rounded-full p-[2px] border-2 border-dashed border-[rgba(232,183,94,0.35)] bg-[rgba(255,255,255,0.02)] cursor-pointer hover:border-[#E8B75E] hover:scale-105 active:scale-95 transition-all flex items-center justify-center shadow-sm"
                title="Toca para abrir cámara y subir historia"
              >
                <div className="w-[46px] h-[46px] rounded-full bg-[rgba(232,183,94,0.1)] text-[#E8B75E] font-bold text-[13px] flex items-center justify-center">
                  {myInitials}
                </div>
              </button>
            )}

            {/* BADGE DORADO "+" EN LA ESQUINA: ABRE CÁMARA DIRECTA */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleTriggerCamera()
              }}
              className="absolute -bottom-0.5 -right-0.5 w-[21px] h-[21px] rounded-full bg-gradient-to-r from-[#EFC471] to-[#E8B75E] text-[#1B1710] border-2 border-[#16241C] flex items-center justify-center shadow-md cursor-pointer hover:scale-110 active:scale-90 transition-transform"
              title="Hacer foto para historia"
              aria-label="Hacer foto"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
            </button>
          </div>

          <span className="text-[11px] text-[#A9BBA4] font-medium tracking-tight truncate max-w-[62px] text-center">
            Tu historia
          </span>
        </div>

        {/* ============================================================== */}
        {/* 2. HISTORIAS DE AMIGOS CON AROS BOTÁNICOS                      */}
        {/* ============================================================== */}
        {friendStoryGroups.map(({ grp, originalIdx }, i) => {
          const firstName = grp.userName.split(' ')[0]
          const gradientClass =
            i % 3 === 0
              ? 'from-[#52B788] via-[#E8B75E] to-[#6FCB8A]'
              : i % 3 === 1
              ? 'from-[#E8B75E] via-[#E8547C] to-[#A796D8]'
              : 'from-[#38BDF8] via-[#52B788] to-[#E8B75E]'

          return (
            <div
              key={grp.userId}
              className="flex flex-col items-center gap-1.5 shrink-0 group cursor-pointer"
              onClick={() => onOpenStoryViewer(originalIdx)}
            >
              <div
                className={`w-[58px] h-[58px] rounded-full p-[2.5px] bg-gradient-to-tr ${gradientClass} group-hover:scale-105 active:scale-95 transition-all shadow-md`}
              >
                <div className="w-full h-full rounded-full bg-[#16241C] p-[2px]">
                  <div className="w-full h-full rounded-full bg-gradient-to-br from-[#253A2C] to-[#16241C] border border-[rgba(232,183,94,0.15)] text-[#E8B75E] font-bold text-[13px] flex items-center justify-center">
                    {grp.userInitials}
                  </div>
                </div>
              </div>

              <span className="text-[11px] text-[#F1EEE2] font-medium tracking-tight truncate max-w-[62px] text-center group-hover:text-[#E8B75E] transition-colors">
                {firstName}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
