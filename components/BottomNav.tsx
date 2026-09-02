'use client'

import React from 'react'
import Link from 'next/link'

export type NavTab = 'friends' | 'home' | 'profile' | 'badges' | 'plant'

interface BottomNavProps {
  currentTab: NavTab
  unreadFriendsCount?: number
  userRole?: string
}

export default function BottomNav({
  currentTab,
  unreadFriendsCount = 0,
}: BottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] z-40 px-5 pt-1 pb-[calc(5px+env(safe-area-inset-bottom))] flex items-center justify-around border-t border-[rgba(232,183,94,0.12)] backdrop-blur-xl bg-[#0F1913]/95 shadow-[0_-6px_25px_rgba(0,0,0,0.55)] select-none transition-all"
      style={{
        fontFamily: "'Work Sans', sans-serif",
      }}
    >
      {/* 1. Izquierda: Comunidad */}
      <Link
        href="/dashboard/friends"
        className={`group flex flex-col items-center gap-[1px] text-[9.5px] py-0.5 px-3 transition-all duration-150 cursor-pointer relative active:scale-95 ${
          currentTab === 'friends'
            ? 'text-[#E8B75E] font-semibold'
            : 'text-[#7C9481] hover:text-[#F1EEE2]'
        }`}
      >
        <div className="relative flex items-center justify-center">
          <span
            className={`text-[16px] leading-none transition-transform duration-150 group-hover:scale-105 ${
              currentTab === 'friends'
                ? 'scale-105 drop-shadow-[0_0_6px_rgba(232,183,94,0.35)]'
                : ''
            }`}
          >
            🌱
          </span>
          {unreadFriendsCount > 0 && (
            <span className="absolute -top-1 -right-2 min-w-[13px] h-[13px] px-0.5 rounded-full bg-[#E8547C] text-white text-[8px] font-bold flex items-center justify-center border border-[#0F1913] shadow-sm animate-pulse">
              {unreadFriendsCount > 9 ? '9+' : unreadFriendsCount}
            </span>
          )}
        </div>
        <span className="tracking-tight">Comunidad</span>
        {currentTab === 'friends' && (
          <span className="w-1 h-1 rounded-full bg-[#E8B75E] shadow-[0_0_4px_#E8B75E]" />
        )}
      </Link>

      {/* 2. Al medio: Inicio (Jardín) */}
      <Link
        href="/dashboard/plant"
        className={`group flex flex-col items-center gap-[1px] text-[9.5px] py-0.5 px-3 transition-all duration-150 cursor-pointer active:scale-95 ${
          currentTab === 'home' || currentTab === 'plant'
            ? 'text-[#E8B75E] font-semibold'
            : 'text-[#7C9481] hover:text-[#F1EEE2]'
        }`}
      >
        <span
          className={`text-[16px] leading-none transition-transform duration-150 group-hover:scale-105 ${
            currentTab === 'home' || currentTab === 'plant'
              ? 'scale-105 drop-shadow-[0_0_6px_rgba(232,183,94,0.35)]'
              : ''
          }`}
        >
          ⌂
        </span>
        <span className="tracking-tight">Inicio</span>
        {(currentTab === 'home' || currentTab === 'plant') && (
          <span className="w-1 h-1 rounded-full bg-[#E8B75E] shadow-[0_0_4px_#E8B75E]" />
        )}
      </Link>

      {/* 3. A la derecha: Perfil */}
      <Link
        href="/dashboard/profile"
        className={`group flex flex-col items-center gap-[1px] text-[9.5px] py-0.5 px-3 transition-all duration-150 cursor-pointer active:scale-95 ${
          currentTab === 'profile'
            ? 'text-[#E8B75E] font-semibold'
            : 'text-[#7C9481] hover:text-[#F1EEE2]'
        }`}
      >
        <span
          className={`text-[16px] leading-none transition-transform duration-150 group-hover:scale-105 ${
            currentTab === 'profile'
              ? 'scale-105 drop-shadow-[0_0_6px_rgba(232,183,94,0.35)]'
              : ''
          }`}
        >
          ◑
        </span>
        <span className="tracking-tight">Perfil</span>
        {currentTab === 'profile' && (
          <span className="w-1 h-1 rounded-full bg-[#E8B75E] shadow-[0_0_4px_#E8B75E]" />
        )}
      </Link>
    </nav>
  )
}
