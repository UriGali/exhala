'use client'

import React from 'react'
import Link from 'next/link'
import { Home, User } from 'lucide-react'

export type NavTab = 'home' | 'profile' | 'plant' | 'friends'

interface BottomNavProps {
  currentTab: NavTab
  unreadCount?: number
  unreadFriendsCount?: number
  userRole?: string
}

export default function BottomNav({
  currentTab,
  unreadCount = 0,
  unreadFriendsCount = 0,
}: BottomNavProps) {
  const totalUnread = unreadCount || unreadFriendsCount
  const isHomeActive = currentTab === 'home' || currentTab === 'plant' || currentTab === 'friends'
  const isProfileActive = currentTab === 'profile'

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] z-40 px-8 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))] flex items-center justify-around border-t border-[rgba(232,183,94,0.12)] backdrop-blur-xl bg-[#0F1913]/95 shadow-[0_-8px_30px_rgba(0,0,0,0.6)] select-none transition-all"
      style={{
        fontFamily: "'Work Sans', sans-serif",
      }}
    >
      {/* 1. Inicio */}
      <Link
        href="/dashboard/plant"
        prefetch={true}
        className={`group flex-1 flex flex-col items-center gap-[3px] text-[11px] py-1 transition-all duration-150 cursor-pointer active:scale-95 ${
          isHomeActive
            ? 'text-[#E8B75E] font-semibold'
            : 'text-[#7C9481] hover:text-[#F1EEE2]'
        }`}
      >
        <div className="relative flex items-center justify-center">
          <Home
            className={`w-[20px] h-[20px] transition-transform duration-150 group-hover:scale-105 ${
              isHomeActive
                ? 'scale-105 stroke-[2.2] text-[#E8B75E] drop-shadow-[0_0_8px_rgba(232,183,94,0.4)]'
                : 'stroke-[1.8]'
            }`}
          />
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-2 min-w-[14px] h-[14px] px-1 rounded-full bg-[#E8547C] text-white text-[8.5px] font-bold flex items-center justify-center border border-[#0F1913] shadow-sm animate-pulse">
              {totalUnread > 9 ? '9+' : totalUnread}
            </span>
          )}
        </div>
        <span className="tracking-tight">Inicio</span>
        {isHomeActive && (
          <span className="w-1.5 h-1.5 rounded-full bg-[#E8B75E] shadow-[0_0_6px_#E8B75E] mt-0.5" />
        )}
      </Link>

      {/* 2. Perfil */}
      <Link
        href="/dashboard/profile"
        prefetch={true}
        className={`group flex-1 flex flex-col items-center gap-[3px] text-[11px] py-1 transition-all duration-150 cursor-pointer active:scale-95 ${
          isProfileActive
            ? 'text-[#E8B75E] font-semibold'
            : 'text-[#7C9481] hover:text-[#F1EEE2]'
        }`}
      >
        <User
          className={`w-[20px] h-[20px] transition-transform duration-150 group-hover:scale-105 ${
            isProfileActive
              ? 'scale-105 stroke-[2.2] text-[#E8B75E] drop-shadow-[0_0_8px_rgba(232,183,94,0.4)]'
              : 'stroke-[1.8]'
          }`}
        />
        <span className="tracking-tight">Perfil</span>
        {isProfileActive && (
          <span className="w-1.5 h-1.5 rounded-full bg-[#E8B75E] shadow-[0_0_6px_#E8B75E] mt-0.5" />
        )}
      </Link>
    </nav>
  )
}
