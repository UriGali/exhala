'use client'

import React from 'react'
import Link from 'next/link'
import { Home, Sprout, Users, Award, User } from 'lucide-react'

export type NavTab = 'home' | 'plant' | 'friends' | 'badges' | 'profile'

interface BottomNavProps {
  currentTab: NavTab
}

export default function BottomNav({ currentTab }: BottomNavProps) {
  const navItems = [
    {
      id: 'home' as NavTab,
      label: 'Inicio',
      href: '/dashboard/smoker',
      icon: Home,
    },
    {
      id: 'plant' as NavTab,
      label: 'Planta',
      href: '/dashboard/plant',
      icon: Sprout,
    },
    {
      id: 'friends' as NavTab,
      label: 'Amigos',
      href: '/dashboard/friends',
      icon: Users,
    },
    {
      id: 'badges' as NavTab,
      label: 'Logros',
      href: '/dashboard/badges',
      icon: Award,
    },
    {
      id: 'profile' as NavTab,
      label: 'Perfil',
      href: '/dashboard/profile',
      icon: User,
    },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-t border-neutral-100 py-2 max-w-md mx-auto">
      <div className="grid grid-cols-5 px-1.5">
        {navItems.map((item) => {
          const isActive = currentTab === item.id
          const Icon = item.icon

          return (
            <Link
              key={item.id}
              href={item.href}
              className={`relative flex flex-col items-center justify-center py-1.5 transition-all duration-200 ${
                isActive
                  ? 'text-emerald-700 font-semibold scale-105'
                  : 'text-neutral-400 hover:text-neutral-600'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'stroke-[2.4]' : 'stroke-[1.8]'}`} />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-emerald-600 rounded-full animate-in fade-in zoom-in" />
                )}
              </div>
              <span className={`text-[10px] mt-1 tracking-tight ${isActive ? 'text-emerald-900 font-medium' : 'text-neutral-400'}`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
