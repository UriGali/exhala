'use client'

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Sprout,
  Droplets,
  Sparkles,
  TreePine,
  Flower2,
  Clock,
  CheckCircle2,
  Lock,
  ChevronRight,
  Info,
  HeartPulse,
  Award,
  Wind,
  Sun,
  ShieldCheck,
  Check,
  Users,
  UserPlus,
  Bell,
  X,
  MessageCircle,
} from 'lucide-react'
import confetti from 'canvas-confetti'
import { supabase } from '@/lib/supabase/client'
import { Profile } from '@/types/database.types'
import BottomNav from '@/components/BottomNav'
import GardenPlantVisualizer, { PLANT_SPECIES, PlantSpecies } from '@/components/GardenPlantVisualizer'
import NotificationBellButton from '@/components/NotificationBellButton'

type PlantTab = 'active' | 'garden'

interface FriendGardenData {
  id: string
  name: string
  initials: string
  role: 'smoker' | 'friend'
  avatarBg: string
  avatarText: string
  totalWaterings: number
  lastWateredAt: string | null
  lastWateredByMeAt: string | null
  smokeFreeSince?: string | null
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

function getDaysClean(smokeFreeSince?: string | null): number {
  if (!smokeFreeSince) return 0
  const diff = Date.now() - new Date(smokeFreeSince).getTime()
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
}

function PlantPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialFriendParam = searchParams.get('friendId')
  const isDebugParam = searchParams.get('debug') === 'true'

  const [activeTab, setActiveTab] = useState<PlantTab>('active')

  // Estado del usuario
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  // Selección de jardín: 'me' o el ID de un amigo
  const [selectedGardenId, setSelectedGardenId] = useState<string>('me')

  // Datos del propio usuario
  const [myWaterings, setMyWaterings] = useState<number>(0)
  const [myLastWateredAt, setMyLastWateredAt] = useState<string | null>(null)
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState<number>(0)

  // Lista de amigos conectados con métricas de jardín
  const [friendsGardens, setFriendsGardens] = useState<FriendGardenData[]>([])

  // Feedback y animaciones
  const [isWateringActive, setIsWateringActive] = useState<boolean>(false)
  const [isWateringAnim, setIsWateringAnim] = useState<boolean>(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0)

  // Modal para ver información de la especie (Lore & Beneficios de salud bajo demanda)
  const [showSpeciesInfo, setShowSpeciesInfo] = useState<boolean>(false)

  // Modal para inspeccionar planta de la colección
  const [inspectedPlant, setInspectedPlant] = useState<{
    species: PlantSpecies
    speciesIndex: number
    isHarvested: boolean
    wateringsCompleted: number
  } | null>(null)

  // Modo debug oculto
  const [demoStage, setDemoStage] = useState<number>(0)
  const [isDemoActive, setIsDemoActive] = useState<boolean>(false)

  const isGuardian = profile?.role === 'friend'

  // Cargar datos del usuario y amigos
  const loadData = useCallback(async () => {
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

      if (userProfile) {
        setProfile(userProfile)

        // 1. Cargar historial propio de riegos
        const { data: myActions, count: myCount } = await supabase
          .from('plant_actions')
          .select('created_at', { count: 'exact' })
          .eq('smoker_id', user.id)
          .eq('action_type', 'water')
          .order('created_at', { ascending: false })

        const totalMyWaterings = myCount || 0
        setMyWaterings(totalMyWaterings)

        if (myActions && myActions.length > 0) {
          const lastDate = myActions[0].created_at
          setMyLastWateredAt(lastDate)
          const diffMs = Date.now() - new Date(lastDate).getTime()
          const twelveHoursMs = 12 * 60 * 60 * 1000
          if (diffMs < twelveHoursMs) {
            setTimeRemainingSeconds(Math.floor((twelveHoursMs - diffMs) / 1000))
          } else {
            setTimeRemainingSeconds(0)
          }
        } else {
          setTimeRemainingSeconds(0)
        }

        // 2. Cargar amigos conectados (bidireccional)
        const { data: friendships } = await supabase
          .from('friendships')
          .select(`
            id,
            smoker_id,
            friend_id,
            status,
            smoker:profiles!friendships_smoker_id_fkey(id, full_name, role, smoke_free_since),
            friend:profiles!friendships_friend_id_fkey(id, full_name, role, smoke_free_since)
          `)
          .or(`smoker_id.eq.${user.id},friend_id.eq.${user.id}`)
          .eq('status', 'accepted')

        if (friendships && friendships.length > 0) {
          const friendsData: FriendGardenData[] = []

          for (const f of friendships) {
            const rawFriend = f.smoker_id === user.id ? (f as any).friend : (f as any).smoker
            if (!rawFriend || !rawFriend.id) continue

            const { count: waterCount, data: lastWater } = await supabase
              .from('plant_actions')
              .select('created_at', { count: 'exact' })
              .eq('smoker_id', rawFriend.id)
              .eq('action_type', 'water')
              .order('created_at', { ascending: false })
              .limit(1)

            // Cuándo fue la última vez que YO (user.id) regué a este amigo
            const { data: lastWaterByMe } = await supabase
              .from('plant_actions')
              .select('created_at')
              .eq('smoker_id', rawFriend.id)
              .eq('friend_id', user.id)
              .eq('action_type', 'water')
              .order('created_at', { ascending: false })
              .limit(1)

            const name = rawFriend.full_name || 'Compañero'
            const color = getAvatarColor(name)
            const initials = getInitials(name)

            friendsData.push({
              id: rawFriend.id,
              name,
              initials,
              role: rawFriend.role || 'smoker',
              avatarBg: color.bg,
              avatarText: color.text,
              totalWaterings: waterCount || 0,
              lastWateredAt: lastWater?.[0]?.created_at || null,
              lastWateredByMeAt: lastWaterByMe?.[0]?.created_at || null,
              smokeFreeSince: rawFriend.smoke_free_since,
            })
          }

          setFriendsGardens(friendsData)

          // Selección inicial
          if (initialFriendParam && friendsData.some((fd) => fd.id === initialFriendParam)) {
            setSelectedGardenId(initialFriendParam)
          } else if (userProfile.role === 'friend' && friendsData.length > 0) {
            setSelectedGardenId(friendsData[0].id)
          } else {
            setSelectedGardenId('me')
          }
        } else {
          setSelectedGardenId(userProfile.role === 'friend' ? 'none' : 'me')
        }
      }
    } catch (err) {
      console.error('Error loading plant data:', err)
    } finally {
      setLoading(false)
    }
  }, [router, initialFriendParam])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Comprobar notificaciones no leídas
  const checkUnreadNotifications = useCallback(async (currentUserId: string) => {
    try {
      const lastRead =
        typeof window !== 'undefined'
          ? localStorage.getItem('last_read_notifications_at') ||
            new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
          : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

      const { count: unreadWater } = await supabase
        .from('plant_actions')
        .select('id', { count: 'exact', head: true })
        .eq('smoker_id', currentUserId)
        .neq('friend_id', currentUserId)
        .gt('created_at', lastRead)

      const { count: unreadSos } = await supabase
        .from('sos_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('friend_id', currentUserId)
        .gt('created_at', lastRead)

      const total = (unreadWater || 0) + (unreadSos || 0)
      setUnreadNotificationsCount(total)
    } catch (err) {
      console.warn('Error checking unread notifications:', err)
    }
  }, [])

  // Suscripción Realtime para notificaciones no leídas y badge
  useEffect(() => {
    if (!userId) return

    checkUnreadNotifications(userId)

    const handleRead = () => setUnreadNotificationsCount(0)
    window.addEventListener('notifications_read', handleRead)
    window.addEventListener('storage', handleRead)

    const channelName = `plant-page-notifications-${userId}-${Date.now()}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'plant_actions',
          filter: `smoker_id=eq.${userId}`,
        },
        async (payload: any) => {
          const newAction = payload?.new
          if (!newAction || newAction.friend_id === userId) return
          setUnreadNotificationsCount((prev) => prev + 1)
          const { data: friendProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', newAction.friend_id)
            .maybeSingle()
          const friendName = friendProfile?.full_name?.split(' ')[0] || 'Un amigo'
          setToastMessage(`💧 ¡${friendName} acaba de regar tu planta! (+1 vitalidad)`)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sos_notifications',
          filter: `friend_id=eq.${userId}`,
        },
        async (payload: any) => {
          const newSos = payload?.new
          if (!newSos) return
          setUnreadNotificationsCount((prev) => prev + 1)
          const { data: smokerProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', newSos.smoker_id)
            .maybeSingle()
          const smokerName = smokerProfile?.full_name?.split(' ')[0] || 'Un compañero'
          setToastMessage(`🚨 ¡Alerta SOS de ${smokerName}!`)
        }
      )
      .subscribe()

    return () => {
      window.removeEventListener('notifications_read', handleRead)
      window.removeEventListener('storage', handleRead)
      supabase.removeChannel(channel)
    }
  }, [userId, checkUnreadNotifications])

  // Temporizador de 12 horas
  useEffect(() => {
    if (timeRemainingSeconds <= 0) return

    const interval = setInterval(() => {
      setTimeRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [timeRemainingSeconds])

  // Formato de cuenta regresiva
  const formattedCountdown = useMemo(() => {
    if (timeRemainingSeconds <= 0) return null
    const hours = Math.floor(timeRemainingSeconds / 3600)
    const minutes = Math.floor((timeRemainingSeconds % 3600) / 60)
    return `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m`
  }, [timeRemainingSeconds])

  // Determinar jardín actual
  const isViewingOwnGarden = selectedGardenId === 'me'
  const currentSelectedFriend = friendsGardens.find((f) => f.id === selectedGardenId) || null

  // Última vez que se regó este jardín específico por parte de este usuario
  const selectedGardenLastWateredAt = useMemo(() => {
    if (isViewingOwnGarden) {
      return myLastWateredAt
    }
    return currentSelectedFriend?.lastWateredByMeAt || null
  }, [isViewingOwnGarden, myLastWateredAt, currentSelectedFriend])

  // Recalcular tiempo de espera de 12 horas al cambiar de jardín o al regar
  useEffect(() => {
    if (!selectedGardenLastWateredAt) {
      setTimeRemainingSeconds(0)
      return
    }
    const diffMs = Date.now() - new Date(selectedGardenLastWateredAt).getTime()
    const twelveHoursMs = 12 * 60 * 60 * 1000
    if (diffMs < twelveHoursMs) {
      setTimeRemainingSeconds(Math.floor((twelveHoursMs - diffMs) / 1000))
    } else {
      setTimeRemainingSeconds(0)
    }
  }, [selectedGardenLastWateredAt])

  const effectiveSubjectName = isViewingOwnGarden
    ? profile?.full_name || 'Mi Planta'
    : currentSelectedFriend?.name || 'Compañero'

  const effectiveTotalWaterings = isViewingOwnGarden
    ? myWaterings
    : currentSelectedFriend?.totalWaterings || 0

  // Cálculos botánicos: 30 riegos por espécimen
  const currentPlantIndex = Math.floor(effectiveTotalWaterings / 30)
  const currentPlantStage = effectiveTotalWaterings % 30
  const completedPlantsCount = currentPlantIndex

  const displayedStage = isDemoActive ? demoStage : currentPlantStage
  const displayedSpeciesIndex = currentPlantIndex
  const displayedSpecies = PLANT_SPECIES[displayedSpeciesIndex % PLANT_SPECIES.length]

  // Acción de regar
  const handleWaterPlant = async () => {
    if (isWateringActive || !userId) return

    // Cooldown para propia planta
    if (isViewingOwnGarden && timeRemainingSeconds > 0) return

    setIsWateringActive(true)
    setIsWateringAnim(true)

    try {
      const nowIso = new Date().toISOString()
      const targetSmokerId = isViewingOwnGarden ? userId : currentSelectedFriend?.id

      if (!targetSmokerId) return

      const { error: insertError } = await supabase.from('plant_actions').insert({
        smoker_id: targetSmokerId,
        friend_id: userId,
        action_type: 'water',
        created_at: nowIso,
      })

      if (insertError) {
        const { data: { session } } = await supabase.auth.getSession()
        const apiRes = await fetch('/api/plant/water', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({
            smoker_id: targetSmokerId,
            friend_id: userId,
            action_type: 'water',
          }),
        })

        const apiData = await apiRes.json().catch(() => ({}))
        if (!apiData.success) {
          throw new Error(apiData.error || insertError.message)
        }
      }

      setTimeout(() => {
        if (!isViewingOwnGarden && currentSelectedFriend) {
          const nextFriendWaterings = currentSelectedFriend.totalWaterings + 1
          setFriendsGardens((prev) =>
            prev.map((f) =>
              f.id === currentSelectedFriend.id
                ? {
                    ...f,
                    totalWaterings: nextFriendWaterings,
                    lastWateredAt: nowIso,
                    lastWateredByMeAt: nowIso,
                  }
                : f
            )
          )
          setTimeRemainingSeconds(12 * 60 * 60)
          setToastMessage(`💧 ¡Has impulsado la planta de ${currentSelectedFriend.name.split(' ')[0]}!`)
        } else {
          const nextTotal = myWaterings + 1
          setMyWaterings(nextTotal)
          setMyLastWateredAt(nowIso)
          setTimeRemainingSeconds(12 * 60 * 60)

          if (nextTotal % 30 === 0) {
            setToastMessage('🎉 ¡Felicidades! Planta madurada y sumada a tu Santuario.')
          } else {
            setToastMessage(`¡Planta nutrida! ${nextTotal % 30}/30 riegos 🌱`)
          }
        }

        try {
          confetti({
            particleCount: 45,
            spread: 60,
            origin: { y: 0.65 },
            colors: ['#10B981', '#34D399', '#38BDF8', '#74C69D'],
          })
        } catch {}
      }, 900)

      setTimeout(() => {
        setIsWateringAnim(false)
        setIsWateringActive(false)
      }, 2000)

      setTimeout(() => {
        setToastMessage(null)
      }, 3500)
    } catch (err: any) {
      console.error('Error watering:', err)
      setToastMessage('No se pudo registrar el riego. Inténtalo de nuevo.')
      setTimeout(() => setToastMessage(null), 3000)
      setIsWateringAnim(false)
      setIsWateringActive(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-[100dvh] w-full bg-gradient-to-b from-[#F0FDF4] to-[#F8FAF9] flex flex-col items-center justify-center max-w-md mx-auto p-6 space-y-4">
        <div className="w-14 h-14 rounded-3xl bg-emerald-900/10 text-emerald-800 flex items-center justify-center animate-pulse">
          <Sprout className="w-7 h-7 stroke-[1.8]" />
        </div>
        <p className="text-xs font-semibold tracking-wider text-neutral-400 uppercase">
          Abriendo Santuario...
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] w-full bg-gradient-to-b from-[#F2FBF6] via-[#F8FAF9] to-white text-neutral-900 flex flex-col justify-between max-w-md mx-auto relative antialiased select-none pb-22">
      {/* NOTIFICACIÓN TOAST MINIMALISTA */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-xs bg-neutral-950/90 backdrop-blur-md text-white text-xs py-3 px-4 rounded-2xl shadow-xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-3 duration-300">
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Check className="w-3.5 h-3.5" />
          </div>
          <span className="font-medium leading-tight">{toastMessage}</span>
        </div>
      )}

      {/* =================================================================== */}
      {/* 1. CABECERA LIMPIA Y AIROSA                                         */}
      {/* =================================================================== */}
      <header className="pt-6 px-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-neutral-950 tracking-tight">
              {isGuardian ? 'Jardines de Apoyo' : isViewingOwnGarden ? 'Mi Santuario' : `Jardín de ${effectiveSubjectName.split(' ')[0]}`}
            </h1>
            {!isGuardian && isViewingOwnGarden && (
              <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100/70 text-emerald-800 rounded-full">
                Nv. {completedPlantsCount + 1}
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-400 mt-0.5">
            {isGuardian
              ? `${friendsGardens.length} compañeros conectados`
              : isViewingOwnGarden
              ? `${completedPlantsCount} ${completedPlantsCount === 1 ? 'espécimen madurado' : 'especímenes madurados'}`
              : `Acompañando a ${effectiveSubjectName}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Botón info de la especie activa */}
          {activeTab === 'active' && (!isGuardian || friendsGardens.length > 0) && (
            <button
              type="button"
              onClick={() => setShowSpeciesInfo(true)}
              className="w-10 h-10 rounded-2xl bg-white/90 border border-neutral-200/80 text-neutral-600 hover:text-emerald-700 flex items-center justify-center transition-colors shadow-2xs"
              title="Ver propiedades y salud"
            >
              <Info className="w-4.5 h-4.5" />
            </button>
          )}

          {/* Botón de Notificaciones Reutilizable y Más Grande */}
          <NotificationBellButton userId={userId} sizeClasses="w-10 h-10" iconSize="w-5 h-5" />
        </div>
      </header>

      {/* =================================================================== */}
      {/* 2. SELECTOR DE JARDÍN (SUTIL, SIN BORDES PESADOS NI TARJETAS)       */}
      {/* =================================================================== */}

      {/* Rol Guardián: selector horizontal destacado de amigos */}
      {isGuardian && friendsGardens.length > 0 && (
        <div className="px-6 mt-4">
          <div className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar items-center">
            {friendsGardens.map((friend) => {
              const isSelected = selectedGardenId === friend.id
              const daysClean = getDaysClean(friend.smokeFreeSince)

              return (
                <button
                  key={friend.id}
                  type="button"
                  onClick={() => setSelectedGardenId(friend.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl transition-all shrink-0 ${
                    isSelected
                      ? 'bg-neutral-950 text-white shadow-sm scale-102'
                      : 'bg-white/80 text-neutral-700 border border-neutral-200/70 hover:bg-white'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isSelected ? 'bg-white/20 text-white' : `${friend.avatarBg} ${friend.avatarText}`
                    }`}
                  >
                    {friend.initials}
                  </div>
                  <div className="text-left leading-none">
                    <div className="text-xs font-semibold">{friend.name.split(' ')[0]}</div>
                    <div className={`text-[9px] mt-0.5 ${isSelected ? 'text-emerald-400' : 'text-neutral-400'}`}>
                      {daysClean > 0 ? `${daysClean}d libre` : 'En proceso'}
                    </div>
                  </div>
                </button>
              )
            })}

            <button
              type="button"
              onClick={() => router.push('/dashboard/friends')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl border border-dashed border-neutral-300 text-neutral-500 hover:text-neutral-800 bg-white/40 text-xs font-medium shrink-0 transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Añadir</span>
            </button>
          </div>
        </div>
      )}

      {/* Rol Fumador: si tiene amigos conectados, un selector sutil de píldoras */}
      {!isGuardian && friendsGardens.length > 0 && (
        <div className="px-6 mt-3">
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar items-center">
            <button
              type="button"
              onClick={() => setSelectedGardenId('me')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 ${
                isViewingOwnGarden
                  ? 'bg-neutral-950 text-white shadow-2xs'
                  : 'bg-white/70 text-neutral-600 border border-neutral-200/70 hover:bg-white'
              }`}
            >
              🌱 Mi Planta
            </button>

            {friendsGardens.map((friend) => {
              const isSelected = selectedGardenId === friend.id
              return (
                <button
                  key={friend.id}
                  type="button"
                  onClick={() => setSelectedGardenId(friend.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 ${
                    isSelected
                      ? 'bg-neutral-950 text-white shadow-2xs'
                      : 'bg-white/70 text-neutral-600 border border-neutral-200/70 hover:bg-white'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>{friend.name.split(' ')[0]}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ESTADO VACÍO PARA GUARDIÁN SIN AMIGOS */}
      {isGuardian && friendsGardens.length === 0 && (
        <div className="px-6 my-auto text-center space-y-4 py-16">
          <div className="w-16 h-16 rounded-3xl bg-emerald-100/60 text-emerald-800 flex items-center justify-center mx-auto shadow-inner">
            <Users className="w-8 h-8 stroke-[1.7]" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-neutral-950">Acompaña a un amigo</h3>
            <p className="text-xs text-neutral-500 max-w-xs mx-auto leading-relaxed">
              Conecta con personas que estén dejando de fumar para nutrir sus plantas y acompañarlas en su camino.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push('/dashboard/friends')}
            className="inline-flex items-center gap-2 px-5 py-3 bg-neutral-950 text-white text-xs font-semibold rounded-2xl shadow-sm active:scale-95 transition-transform"
          >
            <UserPlus className="w-4 h-4 text-emerald-400" />
            <span>Conectar compañeros</span>
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* 3. SUB-NAVEGACIÓN MINIMALISTA (PLANTA ACTIVA / SANTUARIO)            */}
      {/* =================================================================== */}
      {(!isGuardian || friendsGardens.length > 0) && (
        <div className="px-6 mt-3">
          <div className="flex items-center justify-center p-1 bg-neutral-200/50 rounded-2xl max-w-xs mx-auto">
            <button
              type="button"
              onClick={() => setActiveTab('active')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 ${
                activeTab === 'active'
                  ? 'bg-white text-neutral-950 shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              <Flower2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Planta Viva</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('garden')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 ${
                activeTab === 'garden'
                  ? 'bg-white text-neutral-950 shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              <TreePine className="w-3.5 h-3.5 text-emerald-600" />
              <span>Colección ({completedPlantsCount})</span>
            </button>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 4. CONTENIDO PRINCIPAL ZEN                                          */}
      {/* =================================================================== */}
      {(!isGuardian || friendsGardens.length > 0) && (
        <main className="flex-1 px-6 pt-2 pb-4 flex flex-col justify-between">
          {/* VISTA 1: PLANTA ACTIVA (LIENZO ZEN INTEGRADO) */}
          {activeTab === 'active' && (
            <div className="flex-1 flex flex-col items-center justify-between py-2 animate-in fade-in duration-300">
              {/* TÍTULO E INDICADOR DE PROGRESO DISCRETO */}
              <div className="text-center space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-200/50 px-2.5 py-0.5 rounded-full inline-block">
                  Espécimen #{displayedSpeciesIndex + 1}
                </span>
                <h2 className="text-xl font-bold text-neutral-950 tracking-tight">
                  {displayedSpecies.name}
                </h2>
                <p className="text-xs text-neutral-400 italic font-serif">
                  {displayedSpecies.scientificName}
                </p>
              </div>

              {/* VISUALIZADOR PRINCIPAL CON PEDESTAL / AURA ZEN */}
              <div className="relative my-auto flex flex-col items-center justify-center">
                {/* Halo de respiración sutil */}
                <div
                  className={`absolute w-64 h-64 rounded-full bg-radial from-emerald-100/60 to-transparent blur-xl pointer-events-none transition-all duration-1000 ${
                    isWateringAnim ? 'scale-125 opacity-90' : 'scale-100 opacity-60 animate-pulse'
                  }`}
                  style={{ animationDuration: '4s' }}
                />

                <div className="relative z-10">
                  <GardenPlantVisualizer
                    stage={displayedStage}
                    speciesIndex={displayedSpeciesIndex}
                    isWateringAnim={isWateringAnim}
                    size="lg"
                  />
                </div>

                {/* Micro indicador de vitalidad */}
                <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-neutral-500 bg-white/60 backdrop-blur-xs px-3 py-1 rounded-full border border-neutral-200/50 shadow-2xs">
                  <span className="text-emerald-700">{displayedStage}/30 riegos</span>
                  <span className="text-neutral-300">·</span>
                  <span className="text-neutral-600">{Math.round((displayedStage / 30) * 100)}% maduración</span>
                </div>
              </div>

              {/* BARRA DE PROGRESO INTEGRADA */}
              <div className="w-full max-w-xs mx-auto space-y-1">
                <div className="w-full h-1.5 bg-neutral-200/60 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                    style={{ width: `${(displayedStage / 30) * 100}%` }}
                  />
                </div>
              </div>

              {/* ACCIÓN PRINCIPAL DE RIEGO */}
              <div className="w-full max-w-xs mx-auto pt-4">
                {/* Caso 1: Guardián regando la planta de un amigo con cooldown de 12 horas */}
                {isGuardian && currentSelectedFriend ? (
                  <button
                    type="button"
                    onClick={handleWaterPlant}
                    disabled={isWateringActive || timeRemainingSeconds > 0}
                    className={`w-full h-13 font-semibold text-sm rounded-2xl flex items-center justify-center gap-2.5 transition-all shadow-md active:scale-[0.98] ${
                      timeRemainingSeconds > 0
                        ? 'bg-neutral-100 text-neutral-400 border border-neutral-200/80 shadow-none cursor-not-allowed'
                        : 'bg-emerald-800 hover:bg-emerald-700 text-white shadow-emerald-800/20'
                    }`}
                  >
                    {timeRemainingSeconds > 0 ? (
                      <>
                        <Clock className="w-4 h-4 text-neutral-400" />
                        <span>Próximo riego en {formattedCountdown}</span>
                      </>
                    ) : (
                      <>
                        <Droplets className="w-4 h-4 fill-emerald-300 stroke-[2]" />
                        <span>
                          {isWateringActive
                            ? 'Enviando vitalidad...'
                            : `Regar para apoyar a ${currentSelectedFriend.name.split(' ')[0]} (+1 Vitalidad)`}
                        </span>
                      </>
                    )}
                  </button>
                ) : isViewingOwnGarden ? (
                  /* Caso 2: Fumador en su propia planta */
                  <button
                    type="button"
                    onClick={handleWaterPlant}
                    disabled={isWateringActive || timeRemainingSeconds > 0}
                    className={`w-full h-13 font-semibold text-sm rounded-2xl flex items-center justify-center gap-2.5 transition-all shadow-md active:scale-[0.98] ${
                      timeRemainingSeconds > 0
                        ? 'bg-neutral-100 text-neutral-400 border border-neutral-200/80 shadow-none cursor-not-allowed'
                        : 'bg-emerald-800 hover:bg-emerald-700 text-white shadow-emerald-800/20'
                    }`}
                  >
                    {timeRemainingSeconds > 0 ? (
                      <>
                        <Clock className="w-4 h-4 text-neutral-400" />
                        <span>Próximo riego en {formattedCountdown}</span>
                      </>
                    ) : (
                      <>
                        <Droplets className="w-4 h-4 fill-emerald-300 stroke-[2]" />
                        <span>
                          {isWateringActive ? 'Nutriendo raíces...' : 'Regar mi planta (+1 Crecimiento)'}
                        </span>
                      </>
                    )}
                  </button>
                ) : (
                  /* Caso 3: Fumador mirando el jardín de un amigo */
                  <div className="text-center">
                    <p className="text-xs text-neutral-400 mb-2">
                      Estás visitando el jardín botánico de {effectiveSubjectName}
                    </p>
                    <button
                      type="button"
                      onClick={() => router.push('/dashboard/friends')}
                      className="w-full h-11 bg-white border border-neutral-200 text-neutral-700 font-semibold text-xs rounded-2xl flex items-center justify-center gap-2 hover:bg-neutral-50 transition-colors shadow-2xs"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Enviar mensaje de ánimo</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VISTA 2: COLECCIÓN BOTÁNICA (SANTUARIO LIMPIO Y SIN TARJETAS PESADAS) */}
          {activeTab === 'garden' && (
            <div className="space-y-4 py-2 animate-in fade-in duration-300">
              <div className="text-center space-y-1">
                <h3 className="text-base font-bold text-neutral-950">
                  {isViewingOwnGarden ? 'Tu Santuario Permanente' : `Colección de ${effectiveSubjectName.split(' ')[0]}`}
                </h3>
                <p className="text-xs text-neutral-400">
                  {completedPlantsCount} de 6 especímenes desbloqueados
                </p>
              </div>

              {/* GRID LIMPIO DE ESPECIES */}
              <div className="grid grid-cols-2 gap-3">
                {PLANT_SPECIES.map((species, idx) => {
                  const isHarvested = completedPlantsCount > idx
                  const isCurrentActive = completedPlantsCount === idx
                  const stageForVisualizer = isHarvested ? 30 : isCurrentActive ? currentPlantStage : 0

                  return (
                    <div
                      key={species.id}
                      onClick={() => {
                        if (isHarvested || isCurrentActive) {
                          setInspectedPlant({
                            species,
                            speciesIndex: idx,
                            isHarvested,
                            wateringsCompleted: isHarvested ? 30 : currentPlantStage,
                          })
                        }
                      }}
                      className={`relative rounded-3xl p-3.5 flex flex-col items-center justify-between text-center transition-all cursor-pointer ${
                        isHarvested
                          ? 'bg-white border border-emerald-200/80 shadow-2xs hover:border-emerald-400'
                          : isCurrentActive
                          ? 'bg-white border-2 border-emerald-700/60 shadow-xs ring-2 ring-emerald-500/10'
                          : 'bg-neutral-100/50 border border-neutral-200/40 opacity-45'
                      }`}
                    >
                      {/* Badge de estado discreto */}
                      <div className="w-full flex justify-between items-center mb-1 text-[9px] font-bold">
                        <span className="text-neutral-400">#{idx + 1}</span>
                        {isHarvested ? (
                          <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200/60">
                            Madurada ✓
                          </span>
                        ) : isCurrentActive ? (
                          <span className="text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded-full border border-sky-200/60">
                            En cultivo
                          </span>
                        ) : (
                          <Lock className="w-3 h-3 text-neutral-400" />
                        )}
                      </div>

                      {/* Miniatura visual */}
                      <div className="py-1">
                        <GardenPlantVisualizer
                          stage={stageForVisualizer}
                          speciesIndex={idx}
                          size="sm"
                        />
                      </div>

                      {/* Título de la especie */}
                      <div className="w-full mt-1">
                        <h4 className="text-xs font-bold text-neutral-900 truncate">
                          {species.name}
                        </h4>
                        <p className="text-[10px] text-neutral-400 italic truncate font-serif">
                          {species.scientificName}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* SIMULADOR DEBUG (SOLO VISIBLE CON ?debug=true) */}
          {isDebugParam && (
            <div className="mt-4 pt-4 border-t border-neutral-200/60 text-xs">
              <button
                type="button"
                onClick={() => setIsDemoActive(!isDemoActive)}
                className="text-[10px] text-neutral-400 underline"
              >
                {isDemoActive ? 'Desactivar Simulador' : 'Simulador Dev'}
              </button>
              {isDemoActive && (
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between">
                    <span>Etapa: {demoStage}/30</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="30"
                    value={demoStage}
                    onChange={(e) => setDemoStage(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              )}
            </div>
          )}
        </main>
      )}

      {/* =================================================================== */}
      {/* 5. MODAL DE INFORMACIÓN DE ESPECIE & SALUD PULMONAR (BAJO DEMANDA) */}
      {/* =================================================================== */}
      {showSpeciesInfo && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-neutral-100 animate-in slide-in-from-bottom-4 duration-200">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                  Espécimen #{displayedSpeciesIndex + 1}
                </span>
                <h3 className="text-base font-bold text-neutral-950 mt-1">
                  {displayedSpecies.name}
                </h3>
                <p className="text-xs text-neutral-400 italic font-serif">
                  {displayedSpecies.scientificName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSpeciesInfo(false)}
                className="w-8 h-8 rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-600 leading-relaxed">
              {displayedSpecies.lore}
            </p>

            <div className="p-3.5 bg-emerald-50/80 border border-emerald-200/60 rounded-2xl flex items-start gap-2.5">
              <HeartPulse className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-900 leading-snug">
                <span className="font-semibold">Recuperación pulmonar:</span>{' '}
                {displayedSpecies.healingBenefit}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowSpeciesInfo(false)}
              className="w-full py-2.5 bg-neutral-950 text-white text-xs font-semibold rounded-2xl hover:bg-neutral-800 transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 6. MODAL DE INSPECCIÓN DE PLANTA COSECHADA                         */}
      {/* =================================================================== */}
      {inspectedPlant && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-neutral-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                  Espécimen #{inspectedPlant.speciesIndex + 1}
                </span>
                <h3 className="text-base font-bold text-neutral-950 mt-1">
                  {inspectedPlant.species.name}
                </h3>
                <p className="text-xs text-neutral-400 italic font-serif">
                  {inspectedPlant.species.scientificName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectedPlant(null)}
                className="w-8 h-8 rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-2 flex justify-center">
              <GardenPlantVisualizer
                stage={inspectedPlant.isHarvested ? 30 : inspectedPlant.wateringsCompleted}
                speciesIndex={inspectedPlant.speciesIndex}
                size="md"
              />
            </div>

            <div className="space-y-2 text-xs text-neutral-600">
              <p className="leading-relaxed">{inspectedPlant.species.lore}</p>
              <div className="p-3 bg-emerald-50/80 border border-emerald-200/60 rounded-2xl flex items-start gap-2.5">
                <HeartPulse className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-900 leading-snug">
                  <span className="font-semibold">Beneficio en la salud:</span>{' '}
                  {inspectedPlant.species.healingBenefit}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setInspectedPlant(null)}
              className="w-full py-2.5 bg-neutral-950 text-white text-xs font-semibold rounded-2xl hover:bg-neutral-800 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* BARRA DE NAVEGACIÓN INFERIOR */}
      <BottomNav currentTab="plant" userRole={profile?.role || 'smoker'} />
    </div>
  )
}

export default function PlantPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] w-full bg-gradient-to-b from-[#F0FDF4] to-[#F8FAF9] flex flex-col items-center justify-center max-w-md mx-auto p-6 space-y-4">
          <div className="w-14 h-14 rounded-3xl bg-emerald-900/10 text-emerald-800 flex items-center justify-center animate-pulse">
            <Sprout className="w-7 h-7 stroke-[1.8]" />
          </div>
          <p className="text-xs font-semibold tracking-wider text-neutral-400 uppercase">
            Abriendo Santuario...
          </p>
        </div>
      }
    >
      <PlantPageContent />
    </Suspense>
  )
}
