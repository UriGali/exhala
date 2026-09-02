'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

interface NotificationBellButtonProps {
  className?: string
  iconSize?: string
  sizeClasses?: string
  userId?: string | null
}

export default function NotificationBellButton({
  className = '',
  iconSize = 'w-5 h-5',
  sizeClasses = 'w-10 h-10',
  userId: propUserId,
}: NotificationBellButtonProps) {
  const router = useRouter()
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [currentUserId, setCurrentUserId] = useState<string | null>(propUserId || null)

  const checkUnread = useCallback(async (uid: string) => {
    try {
      const lastRead =
        typeof window !== 'undefined'
          ? localStorage.getItem('last_read_notifications_at') ||
            new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
          : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

      const { count: unreadWater } = await supabase
        .from('plant_actions')
        .select('id', { count: 'exact', head: true })
        .eq('smoker_id', uid)
        .neq('friend_id', uid)
        .gt('created_at', lastRead)

      const { count: unreadSos } = await supabase
        .from('sos_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('friend_id', uid)
        .gt('created_at', lastRead)

      setUnreadCount((unreadWater || 0) + (unreadSos || 0))
    } catch (err) {
      console.warn('Error fetching unread notifications count:', err)
    }
  }, [])

  useEffect(() => {
    let channel: any = null

    const init = async () => {
      let uid = propUserId
      if (!uid) {
        const { data: { user } } = await supabase.auth.getUser()
        uid = user?.id || null
      }
      setCurrentUserId(uid)
      if (!uid) return

      await checkUnread(uid)

      const handleRead = () => setUnreadCount(0)
      window.addEventListener('notifications_read', handleRead)
      window.addEventListener('storage', handleRead)

      const channelName = `bell-badge-${uid}-${Date.now()}`
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'plant_actions',
            filter: `smoker_id=eq.${uid}`,
          },
          (payload: any) => {
            const newAction = payload?.new
            if (!newAction || newAction.friend_id === uid) return
            setUnreadCount((prev) => prev + 1)
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'sos_notifications',
            filter: `friend_id=eq.${uid}`,
          },
          (payload: any) => {
            if (payload?.new) {
              setUnreadCount((prev) => prev + 1)
            }
          }
        )
        .subscribe()
    }

    init()

    return () => {
      window.removeEventListener('notifications_read', () => setUnreadCount(0))
      window.removeEventListener('storage', () => setUnreadCount(0))
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [propUserId, checkUnread])

  const handleClick = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('last_read_notifications_at', new Date().toISOString())
      window.dispatchEvent(new Event('notifications_read'))
    }
    setUnreadCount(0)
    router.push('/dashboard/notifications')
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`relative ${sizeClasses} rounded-2xl bg-white/90 hover:bg-white border border-neutral-200/80 text-neutral-700 hover:text-emerald-700 flex items-center justify-center transition-all shadow-2xs hover:shadow-xs active:scale-95 ${className}`}
      title="Ver notificaciones y alertas"
      aria-label="Ver notificaciones"
    >
      <Bell className={`${iconSize} stroke-[1.9] transition-transform`} />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[19px] h-[19px] px-1 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-xs animate-pulse">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  )
}
