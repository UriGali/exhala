'use client'

import React from 'react'
import { Plus, Sparkles } from 'lucide-react'
import { UserStoriesGroup } from '@/components/StoryViewerModal'

interface StoriesBarProps {
  currentUserId: string | null
  currentUserName: string
  usersWithStories: UserStoriesGroup[]
  onOpenCreateStory: () => void
  onOpenStoryViewer: (userIndex: number) => void
}

export default function StoriesBar({
  currentUserId,
  currentUserName,
  usersWithStories,
  onOpenCreateStory,
  onOpenStoryViewer,
}: StoriesBarProps) {
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

  return (
    <div className="w-full relative z-10 my-[14px]">
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
              /* SIN HISTORIA ACTIVA: BOTÓN CREAR DIRECTO */
              <button
                type="button"
                onClick={onOpenCreateStory}
                className="w-[58px] h-[58px] rounded-full p-[2px] border-2 border-dashed border-[rgba(232,183,94,0.35)] bg-[rgba(255,255,255,0.02)] cursor-pointer hover:border-[#E8B75E] hover:scale-105 active:scale-95 transition-all flex items-center justify-center shadow-sm"
                title="Subir historia de 24 horas"
              >
                <div className="w-[46px] h-[46px] rounded-full bg-[rgba(232,183,94,0.1)] text-[#E8B75E] font-bold text-[13px] flex items-center justify-center">
                  {myInitials}
                </div>
              </button>
            )}

            {/* BADGE DORADO "+" EN LA ESQUINA */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onOpenCreateStory()
              }}
              className="absolute -bottom-0.5 -right-0.5 w-[20px] h-[20px] rounded-full bg-gradient-to-r from-[#EFC471] to-[#E8B75E] text-[#1B1710] border-2 border-[#16241C] flex items-center justify-center shadow-md cursor-pointer hover:scale-110 active:scale-90 transition-transform"
              title="Añadir nueva historia"
              aria-label="Añadir historia"
            >
              <Plus className="w-3 h-3 stroke-[3]" />
            </button>
          </div>

          <span className="text-[11px] text-[#A9BBA4] font-medium tracking-tight truncate max-w-[62px] text-center">
            {hasMyStories ? 'Tu historia' : 'Tu historia'}
          </span>
        </div>

        {/* ============================================================== */}
        {/* 2. HISTORIAS DE AMIGOS CON AROS BOTÁNICOS                      */}
        {/* ============================================================== */}
        {friendStoryGroups.map(({ grp, originalIdx }, i) => {
          const firstName = grp.userName.split(' ')[0]
          // Gradientes vibrantes botánicos
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
              {/* ARO DEGRADADO ESTILO INSTAGRAM / BOTÁNICO */}
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
