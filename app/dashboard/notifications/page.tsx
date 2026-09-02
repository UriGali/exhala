'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Bell,
  Droplets,
  Sprout,
  HeartHandshake,
  AlertTriangle,
  ArrowLeft,
  Clock,
  Sparkles,
  MessageCircle,
  CheckCircle2,
  Users,
  ChevronRight,
  Filter,
} from 'lucide-react'
import confetti from 'canvas-confetti'
import { supabase } from '@/lib/supabase/client'
import { Profile } from '@/types/database.types'
import BottomNav from '@/components/BottomNav'

type NotificationFilter = 'all' | 'water' | 'sos'

interface NotificationItem {
  id: string
  type: 'water' | 'sos'
  senderId: string
  senderName: string
  senderRole?: 'smoker' | 'friend'
  senderAvatarBg: string
  senderAvatarText: string
  senderInitials: string
  title: string
  message: string
  createdAt: string
  actionUrl: string
}

const AVATAR_PALETTES = [
  { bg: 'bg-emerald-100', text: 'text-emerald-800' },
  { bg: 'bg-sky-100', text: 'text-sky-800' },
  { bg: 'bg-amber-100', text: 'text-amber-800' },
  { bg: 'bg-purple-100', text: 'text-purple-800' },
  { bg: 'bg-rose-100', text: 'text-rose-800' },
]

function getAvatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length]
}

function getInitials(name: string) {
  const parts = name.trim().split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function formatRelativeTime(dateString: string): string {
  const now = new Date().getTime()
  const created = new Date(dateString).getTime()
  const diffMinutes = Math.floor((now - created) / (1000 * 60))

  if (diffMinutes < 1) return 'Justo ahora'
  if (diffMinutes < 60) return `Hace ${diffMinutes} min`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `Hace ${diffHours} h`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'Ayer'
  if (diffDays < 7) return `Hace ${diffDays} días`

  return new Date(dateString).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
  })
}

export default function NotificationsPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>('all')
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }, [])

  // Cargar notificaciones históricas
  const loadNotifications = useCallback(async (currentUserId: string) => {
    try {
      // 1. Consultar riegos recibidos de amigos en plant_actions
      const { data: waterActions, error: waterError } = await supabase
        .from('plant_actions')
        .select(`
          id,
          smoker_id,
          friend_id,
          action_type,
          created_at,
          friend:profiles!plant_actions_friend_id_fkey(id, full_name, role)
        `)
        .eq('smoker_id', currentUserId)
        .neq('friend_id', currentUserId)
        .order('created_at', { ascending: false })
        .limit(30)

      if (waterError) {
        console.warn('Error loading plant_actions notifications:', waterError)
      }

      // 2. Consultar alertas SOS recibidas
      const { data: sosAlerts, error: sosError } = await supabase
        .from('sos_notifications')
        .select(`
          id,
          smoker_id,
          friend_id,
          message,
          created_at,
          smoker:profiles!sos_notifications_smoker_id_fkey(id, full_name, role)
        `)
        .eq('friend_id', currentUserId)
        .order('created_at', { ascending: false })
        .limit(30)

      if (sosError) {
        console.warn('Error loading sos_notifications:', sosError)
      }

      const formattedNotifications: NotificationItem[] = []

      // Mapear riegos de plantas
      if (waterActions) {
        for (const action of waterActions) {
          const friendProfile = (action as any).friend
          const friendName = friendProfile?.full_name || 'Un amigo'
          const avatar = getAvatarColor(friendName)
          const initials = getInitials(friendName)

          formattedNotifications.push({
            id: `water-${action.id}`,
            type: 'water',
            senderId: action.friend_id,
            senderName: friendName,
            senderRole: friendProfile?.role,
            senderAvatarBg: avatar.bg,
            senderAvatarText: avatar.text,
            senderInitials: initials,
            title: `¡${friendName} ha regado tu planta!`,
            message: 'Tu planta ha recibido un baño de agua pura (+1 vitalidad 🌱).',
            createdAt: action.created_at,
            actionUrl: '/dashboard/plant',
          })
        }
      }

      // Mapear alertas SOS
      if (sosAlerts) {
        for (const sos of sosAlerts) {
          const smokerProfile = (sos as any).smoker
          const smokerName = smokerProfile?.full_name || 'Un compañero'
          const avatar = getAvatarColor(smokerName)
          const initials = getInitials(smokerName)

          formattedNotifications.push({
            id: `sos-${sos.id}`,
            type: 'sos',
            senderId: sos.smoker_id,
            senderName: smokerName,
            senderRole: smokerProfile?.role,
            senderAvatarBg: avatar.bg,
            senderAvatarText: avatar.text,
            senderInitials: initials,
            title: `🚨 Alerta SOS de ${smokerName}`,
            message: sos.message || `${smokerName} necesita apoyo urgente contra un antojo.`,
            createdAt: sos.created_at,
            actionUrl: '/dashboard/friends',
          })
        }
      }

      // Ordenar cronológicamente descendente
      formattedNotifications.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )

      setNotifications(formattedNotifications)
    } catch (err) {
      console.error('Error fetching notifications:', err)
    }
  }, [])

  // Inicializar autenticación y suscripción Realtime
  useEffect(() => {
    let channel: any = null

    const init = async () => {
      setLoading(true)
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser()

        if (authError || !user) {
          await supabase.auth.signOut().catch(() => {})
          router.push('/')
          return
        }

        setUserId(user.id)

        const { data: userProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()

        if (userProfile) setProfile(userProfile)

        await loadNotifications(user.id)

        // Marcar notificaciones como leídas en esta sesión
        if (typeof window !== 'undefined') {
          localStorage.setItem('last_read_notifications_at', new Date().toISOString())
          window.dispatchEvent(new Event('notifications_read'))
        }

        // Realtime listener: Escuchar nuevos riegos y alertas SOS en tiempo real
        const channelName = `user-notifications-${user.id}-${Date.now()}`
        channel = supabase
          .channel(channelName)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'plant_actions',
              filter: `smoker_id=eq.${user.id}`,
            },
            async (payload: any) => {
              const newAction = payload?.new
              if (!newAction || newAction.friend_id === user.id) return

              // Obtener nombre del amigo que regó
              const { data: friendProfile } = await supabase
                .from('profiles')
                .select('full_name, role')
                .eq('id', newAction.friend_id)
                .maybeSingle()

              const friendName = friendProfile?.full_name || 'Un amigo'
              const avatar = getAvatarColor(friendName)
              const initials = getInitials(friendName)

              const newNotificationItem: NotificationItem = {
                id: `water-${newAction.id}`,
                type: 'water',
                senderId: newAction.friend_id,
                senderName: friendName,
                senderRole: friendProfile?.role,
                senderAvatarBg: avatar.bg,
                senderAvatarText: avatar.text,
                senderInitials: initials,
                title: `¡${friendName} ha regado tu planta!`,
                message: 'Tu planta ha recibido un baño de agua pura (+1 vitalidad 🌱).',
                createdAt: newAction.created_at || new Date().toISOString(),
                actionUrl: '/dashboard/plant',
              }

              setNotifications((prev) => [newNotificationItem, ...prev])
              showToast(`💧 ¡${friendName} acaba de regar tu planta!`)

              try {
                confetti({
                  particleCount: 40,
                  spread: 60,
                  origin: { y: 0.2 },
                  colors: ['#10B981', '#38BDF8', '#34D399'],
                })
              } catch {}
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'sos_notifications',
              filter: `friend_id=eq.${user.id}`,
            },
            async (payload: any) => {
              const newSos = payload?.new
              if (!newSos) return

              const { data: smokerProfile } = await supabase
                .from('profiles')
                .select('full_name, role')
                .eq('id', newSos.smoker_id)
                .maybeSingle()

              const smokerName = smokerProfile?.full_name || 'Un compañero'
              const avatar = getAvatarColor(smokerName)
              const initials = getInitials(smokerName)

              const newNotificationItem: NotificationItem = {
                id: `sos-${newSos.id}`,
                type: 'sos',
                senderId: newSos.smoker_id,
                senderName: smokerName,
                senderRole: smokerProfile?.role,
                senderAvatarBg: avatar.bg,
                senderAvatarText: avatar.text,
                senderInitials: initials,
                title: `🚨 Alerta SOS de ${smokerName}`,
                message: newSos.message || `${smokerName} necesita apoyo urgente contra un antojo.`,
                createdAt: newSos.created_at || new Date().toISOString(),
                actionUrl: '/dashboard/friends',
              }

              setNotifications((prev) => [newNotificationItem, ...prev])
              showToast(`🚨 ¡Alerta SOS de ${smokerName}!`)
            }
          )
          .subscribe()
      } catch (err) {
        console.error('Error initializing notifications page:', err)
      } finally {
        setLoading(false)
      }
    }

    init()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [router, loadNotifications, showToast])

  // Filtrar notificaciones según tab activo
  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'water') {
      return notifications.filter((n) => n.type === 'water')
    }
    if (activeFilter === 'sos') {
      return notifications.filter((n) => n.type === 'sos')
    }
    return notifications
  }, [notifications, activeFilter])

  const waterCount = useMemo(() => notifications.filter((n) => n.type === 'water').length, [notifications])
  const sosCount = useMemo(() => notifications.filter((n) => n.type === 'sos').length, [notifications])

  if (loading) {
    return (
      <div className="min-h-[100dvh] w-full bg-[#F8FAF9] flex flex-col items-center justify-center max-w-md mx-auto p-6 space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-white border border-neutral-200 shadow-sm flex items-center justify-center animate-pulse">
          <Bell className="w-6 h-6 text-neutral-900" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
          Cargando notificaciones...
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] w-full bg-[#F8FAF9] text-neutral-900 flex flex-col justify-between max-w-md mx-auto relative antialiased select-none pb-24">
      {/* NOTIFICACIÓN TOAST FLOTANTE */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-sm bg-neutral-950 text-white text-xs py-3 px-4 rounded-2xl shadow-xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top duration-300">
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="font-medium leading-tight">{toastMessage}</span>
        </div>
      )}

      {/* HEADER PRINCIPAL */}
      <header className="pt-6 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-9 h-9 rounded-2xl bg-white border border-neutral-200 text-neutral-700 hover:text-neutral-950 flex items-center justify-center shadow-2xs transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-base font-bold text-neutral-950 leading-tight">
              Actividad & Riegos
            </h1>
            <p className="text-[11px] text-neutral-400 font-medium">
              Notificaciones de apoyo en tiempo real
            </p>
          </div>
        </div>

        {/* Badge En Directo */}
        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200/70 rounded-full">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
            En vivo
          </span>
        </div>
      </header>

      {/* FILTROS DE ACTIVIDAD */}
      <div className="px-6 mt-4">
        <div className="grid grid-cols-3 p-1 bg-neutral-200/70 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`py-2 text-xs font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-1 ${
              activeFilter === 'all'
                ? 'bg-white text-neutral-950 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <span>Todas</span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 bg-neutral-100 rounded-full text-neutral-600">
              {notifications.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('water')}
            className={`py-2 text-xs font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-1 ${
              activeFilter === 'water'
                ? 'bg-white text-neutral-950 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Droplets className="w-3 h-3 text-sky-600" />
            <span>Riegos</span>
            {waterCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.2 bg-sky-100 rounded-full text-sky-800">
                {waterCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('sos')}
            className={`py-2 text-xs font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-1 ${
              activeFilter === 'sos'
                ? 'bg-white text-neutral-950 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <AlertTriangle className="w-3 h-3 text-rose-600" />
            <span>SOS</span>
            {sosCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.2 bg-rose-100 rounded-full text-rose-800">
                {sosCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* LISTADO DE NOTIFICACIONES */}
      <main className="flex-1 px-6 py-4 space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="bg-white border border-neutral-100 rounded-3xl p-8 text-center space-y-3 shadow-xs my-6">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              {activeFilter === 'water' ? (
                <Droplets className="w-6 h-6" />
              ) : activeFilter === 'sos' ? (
                <AlertTriangle className="w-6 h-6" />
              ) : (
                <Sprout className="w-6 h-6" />
              )}
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-neutral-950">
                {activeFilter === 'water'
                  ? 'Sin riegos recibidos aún'
                  : activeFilter === 'sos'
                  ? 'Sin alertas de auxilio activas'
                  : 'Bandeja de actividad vacía'}
              </h3>
              <p className="text-xs text-neutral-400 max-w-xs mx-auto leading-relaxed">
                {activeFilter === 'water'
                  ? 'Cuando tus guardianes o amigos rieguen tu planta botánica, los avisos aparecerán aquí en directo.'
                  : 'Aquí recibirás las alertas de tus compañeros cuando necesiten motivación o apoyo en tiempo real.'}
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/dashboard/friends"
                className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-950 text-white text-xs font-semibold rounded-2xl hover:bg-neutral-800 transition-colors shadow-xs"
              >
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <span>Ver Comunidad de Amigos</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredNotifications.map((item) => {
              const isWater = item.type === 'water'

              return (
                <div
                  key={item.id}
                  className="bg-white border border-neutral-100 rounded-3xl p-4 shadow-xs hover:border-neutral-200 transition-all space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Avatar y Datos del Remitente */}
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-bold ${item.senderAvatarBg} ${item.senderAvatarText}`}
                        >
                          {item.senderInitials}
                        </div>
                        <div
                          className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-white border-2 border-white ${
                            isWater ? 'bg-sky-500' : 'bg-rose-500'
                          }`}
                        >
                          {isWater ? (
                            <Droplets className="w-2.5 h-2.5" />
                          ) : (
                            <AlertTriangle className="w-2.5 h-2.5" />
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-neutral-950">
                            {item.senderName}
                          </h4>
                          {item.senderRole === 'friend' && (
                            <span className="text-[9px] font-semibold text-sky-700 bg-sky-50 border border-sky-200/70 px-1.5 py-0.2 rounded-md">
                              Guardián
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-neutral-400 flex items-center gap-1 mt-0.5 font-medium">
                          <Clock className="w-2.5 h-2.5" />
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isWater
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/60'
                          : 'bg-rose-50 text-rose-800 border border-rose-200/60'
                      }`}
                    >
                      {isWater ? '+1 Riego 🌱' : 'SOS 🚨'}
                    </span>
                  </div>

                  {/* Mensaje descriptivo */}
                  <div className="bg-neutral-50/80 rounded-2xl p-3 border border-neutral-100">
                    <p className="text-xs text-neutral-700 leading-relaxed font-medium">
                      {item.message}
                    </p>
                  </div>

                  {/* Botones de acción rápida */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => router.push(item.actionUrl)}
                      className="flex-1 py-2 px-3 bg-neutral-950 text-white text-[11px] font-semibold rounded-xl flex items-center justify-center gap-1.5 hover:bg-neutral-800 transition-colors shadow-2xs"
                    >
                      {isWater ? (
                        <>
                          <Sprout className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Ver mi Planta</span>
                        </>
                      ) : (
                        <>
                          <HeartHandshake className="w-3.5 h-3.5 text-rose-400" />
                          <span>Dar Apoyo Inmediato</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => router.push('/dashboard/friends')}
                      className="py-2 px-3 bg-white border border-neutral-200 text-neutral-700 text-[11px] font-semibold rounded-xl flex items-center justify-center gap-1 hover:bg-neutral-50 transition-colors"
                      title="Enviar mensaje por el chat"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-neutral-500" />
                      <span>Chat</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* BARRA DE NAVEGACIÓN INFERIOR */}
      <BottomNav currentTab="home" userRole={profile?.role || 'smoker'} />
    </div>
  )
}
