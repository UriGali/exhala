'use client'

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Bell,
  HeartPulse,
  Droplets,
  Sparkles,
  Clock,
  Check,
  X,
  UserPlus,
  Share2,
  Copy,
  CheckCheck,
  Info,
  Loader2,
  Wind,
  Lock,
  Coins,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import confetti from 'canvas-confetti'
import { supabase } from '@/lib/supabase/client'
import { Profile } from '@/types/database.types'
import { PLANT_SPECIES, PlantSpecies } from '@/components/GardenPlantVisualizer'
import { dispatchPushAlertToFriends } from '@/lib/push-notifications'
import BottomNav from '@/components/BottomNav'

type PlantTab = 'active' | 'garden' | 'earnings'

interface FriendGardenData {
  id: string
  name: string
  initials: string
  role: 'smoker' | 'friend'
  totalWaterings: number
  lastWateredAt: string | null
  lastWateredByMeAt: string | null
  smokeFreeSince?: string | null
  cigsPerDay?: number
  packPrice?: number
  canWater?: boolean
  remainingCooldownSeconds?: number
}

function getInitials(name: string) {
  const parts = name.trim().split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function PlantPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialFriendParam = searchParams.get('friendId')
  const isDebugParam = searchParams.get('debug') === 'true'

  const [activeTab, setActiveTab] = useState<PlantTab>('active')

  // Estado del usuario
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>('Un amigo')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  // Selección de jardín: 'me' o el ID de un amigo
  const [selectedGardenId, setSelectedGardenId] = useState<string>('me')

  // Datos del propio usuario
  const [myWaterings, setMyWaterings] = useState<number>(0)
  const [myLastWateredAt, setMyLastWateredAt] = useState<string | null>(null)
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState<number>(0)

  // Lista de amigos conectados
  const [friendsGardens, setFriendsGardens] = useState<FriendGardenData[]>([])

  // Feedback y animaciones
  const [isWateringActive, setIsWateringActive] = useState<boolean>(false)
  const [isWateringAnim, setIsWateringAnim] = useState<boolean>(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0)

  // Modal para ver información de la especie (Lore & Beneficios de salud)
  const [showSpeciesInfo, setShowSpeciesInfo] = useState<boolean>(false)

  // Modal para añadir / invitar amigo
  const [showAddFriendModal, setShowAddFriendModal] = useState<boolean>(false)
  const [inviteCopied, setInviteCopied] = useState<boolean>(false)

  // Modal inspeccionar espécimen
  const [inspectedPlant, setInspectedPlant] = useState<{
    species: PlantSpecies
    speciesIndex: number
    isHarvested: boolean
    wateringsCompleted: number
  } | null>(null)

  // SOS Crisis State
  const [sosOpen, setSosOpen] = useState<boolean>(false)
  const [sosSending, setSosSending] = useState<boolean>(false)
  const [sosBreathPhase, setSosBreathPhase] = useState<'Inhala' | 'Mantén' | 'Exhala'>('Inhala')
  const [sosBreathTimer, setSosBreathTimer] = useState<number>(60)

  // Modo debug
  const [demoStage, setDemoStage] = useState<number>(7)
  const [isDemoActive, setIsDemoActive] = useState<boolean>(false)

  const isGuardian = profile?.role === 'friend'

  // 1. Cargar datos del usuario y amigos
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
        if (userProfile.full_name) setUserName(userProfile.full_name)

        // 1. Cargar historial propio de riegos de forma sincronizada
        try {
          const res = await fetch(`/api/plant/status?smokerId=${user.id}&viewerId=${user.id}`)
          if (res.ok) {
            const pData = await res.json()
            if (pData.success) {
              setMyWaterings(pData.totalWaterings)
              setMyLastWateredAt(pData.lastWateredAt)
              setTimeRemainingSeconds(pData.remainingCooldownSeconds)
            }
          }
        } catch (e) {
          console.warn('Error fetching own plant status:', e)
        }

        // 2. Cargar amigos conectados y sincronizar su planta
        const { data: friendships } = await supabase
          .from('friendships')
          .select(`
            id,
            smoker_id,
            friend_id,
            status,
            smoker:profiles!friendships_smoker_id_fkey(id, full_name, role, smoke_free_since, cigs_per_day, pack_price),
            friend:profiles!friendships_friend_id_fkey(id, full_name, role, smoke_free_since, cigs_per_day, pack_price)
          `)
          .or(`smoker_id.eq.${user.id},friend_id.eq.${user.id}`)
          .eq('status', 'accepted')

        if (friendships && friendships.length > 0) {
          const rawFriendsList = friendships
            .map((f) => (f.smoker_id === user.id ? (f as any).friend : (f as any).smoker))
            .filter((rawFriend) => rawFriend && rawFriend.id)

          const friendsData: FriendGardenData[] = await Promise.all(
            rawFriendsList.map(async (rawFriend) => {
              let fTotalWaterings = 0
              let fLastWateredAt: string | null = null
              let fRemainingCooldown = 0
              let fCanWater = true

              try {
                const res = await fetch(`/api/plant/status?smokerId=${rawFriend.id}&viewerId=${user.id}`)
                if (res.ok) {
                  const pData = await res.json()
                  if (pData.success) {
                    fTotalWaterings = pData.totalWaterings
                    fLastWateredAt = pData.lastWateredAt
                    fRemainingCooldown = pData.remainingCooldownSeconds
                    fCanWater = pData.canWater
                  }
                }
              } catch (e) {
                console.warn('Error fetching friend plant status:', e)
              }

              const name = rawFriend.full_name || 'Compañero'
              const initials = getInitials(name)

              return {
                id: rawFriend.id,
                name,
                initials,
                role: rawFriend.role || 'smoker',
                totalWaterings: fTotalWaterings,
                lastWateredAt: fLastWateredAt,
                lastWateredByMeAt: null,
                smokeFreeSince: rawFriend.smoke_free_since,
                cigsPerDay: rawFriend.cigs_per_day || 15,
                packPrice: Number(rawFriend.pack_price) || 5.5,
                canWater: fCanWater,
                remainingCooldownSeconds: fRemainingCooldown,
              }
            })
          )

          setFriendsGardens(friendsData)

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
      console.warn('Error checking notifications:', err)
    }
  }, [])

  // Realtime para notificaciones
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
          if (!newAction) return

          // Actualizar riegos propios en tiempo real si nos regaron
          if (newAction.smoker_id === userId) {
            setMyWaterings((prev) => prev + 1)
            if (newAction.friend_id !== userId) {
              setUnreadNotificationsCount((prev) => prev + 1)
              const { data: friendProfile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', newAction.friend_id)
                .maybeSingle()
              const friendName = friendProfile?.full_name?.split(' ')[0] || 'Un amigo'
              setToastMessage(`💧 ¡${friendName} acaba de regar tu planta! (+1 vitalidad)`)
            }
          }

          // Actualizar amigos si alguien regó a un amigo
          setFriendsGardens((prev) =>
            prev.map((f) =>
              f.id === newAction.smoker_id
                ? { ...f, totalWaterings: f.totalWaterings + 1 }
                : f
            )
          )
        }
      )
      .subscribe()

    return () => {
      window.removeEventListener('notifications_read', handleRead)
      window.removeEventListener('storage', handleRead)
      supabase.removeChannel(channel)
    }
  }, [userId, checkUnreadNotifications])

  // Temporizador de cuenta regresiva
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

  // Mini ciclo de respiración SOS
  useEffect(() => {
    if (!sosOpen || sosBreathTimer <= 0) return

    const interval = setInterval(() => {
      setSosBreathTimer((t) => {
        const next = t - 1
        const elapsed = 60 - next
        const cycle = elapsed % 12
        if (cycle < 4) setSosBreathPhase('Inhala')
        else if (cycle < 8) setSosBreathPhase('Mantén')
        else setSosBreathPhase('Exhala')
        return next
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [sosOpen, sosBreathTimer])

  // Determinar jardín seleccionado
  const isViewingOwnGarden = selectedGardenId === 'me'
  const currentSelectedFriend = friendsGardens.find((f) => f.id === selectedGardenId) || null

  const effectiveSubjectName = isViewingOwnGarden
    ? profile?.full_name || 'Bonsái Zen de Jade'
    : currentSelectedFriend?.name || 'Compañero'

  const effectiveTotalWaterings = isViewingOwnGarden
    ? myWaterings
    : currentSelectedFriend?.totalWaterings || 0

  // 30 riegos por espécimen
  const currentPlantIndex = Math.floor(effectiveTotalWaterings / 30)
  const currentPlantStage = effectiveTotalWaterings % 30
  const completedPlantsCount = currentPlantIndex

  // Métricas financieras del sujeto actual (tú o tu amigo seleccionado)
  const currentSubjectSmokeFree = isViewingOwnGarden
    ? profile?.smoke_free_since
    : currentSelectedFriend?.smokeFreeSince

  const currentSubjectCigsPerDay = isViewingOwnGarden
    ? profile?.cigs_per_day || 15
    : currentSelectedFriend?.cigsPerDay || 15

  const currentSubjectPackPrice = isViewingOwnGarden
    ? Number(profile?.pack_price) || 5.5
    : Number(currentSelectedFriend?.packPrice) || 5.5

  const subjectDaysClean = currentSubjectSmokeFree
    ? Math.max(0, Math.floor((Date.now() - new Date(currentSubjectSmokeFree).getTime()) / (1000 * 60 * 60 * 24)))
    : 0

  const subjectCostPerCig = currentSubjectPackPrice / 20
  const subjectDailySavings = currentSubjectCigsPerDay * subjectCostPerCig
  const subjectTotalMoneySaved = subjectDaysClean * subjectDailySavings
  const subjectTotalCigsAvoided = subjectDaysClean * currentSubjectCigsPerDay
  const subjectPacksAvoided = (subjectTotalCigsAvoided / 20).toFixed(1)
  const subjectMonthlyProjected = subjectDailySavings * 30
  const subjectYearlyProjected = subjectDailySavings * 365

  const displayedStage = isDemoActive ? demoStage : currentPlantStage
  const displayedSpeciesIndex = currentPlantIndex
  const displayedSpecies = PLANT_SPECIES[displayedSpeciesIndex % PLANT_SPECIES.length]

  // Porcentaje de maduración
  const progressPercent = Math.min(100, Math.round((displayedStage / 30) * 100))

  // Circunferencia del anillo SVG: r=84 -> C = 2 * PI * 84 = 527.78 ~ 528
  const strokeDashoffset = Math.round(528 - (528 * progressPercent) / 100)

  // Cooldown activo según si vemos nuestro jardín o el de un amigo
  const activeCooldownSeconds = isViewingOwnGarden
    ? timeRemainingSeconds
    : currentSelectedFriend?.remainingCooldownSeconds || 0

  // Acción de regar
  const handleWaterPlant = async () => {
    if (isWateringActive || !userId) return
    if (activeCooldownSeconds > 0) {
      const hours = Math.floor(activeCooldownSeconds / 3600)
      const minutes = Math.floor((activeCooldownSeconds % 3600) / 60)
      setToastMessage(`Próximo riego disponible en ${hours}h ${minutes}m ⏳`)
      setTimeout(() => setToastMessage(null), 3000)
      return
    }

    setIsWateringActive(true)
    setIsWateringAnim(true)

    try {
      const nowIso = new Date().toISOString()
      const targetSmokerId = isViewingOwnGarden ? userId : currentSelectedFriend?.id

      if (!targetSmokerId) return

      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/plant/water', {
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

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        if (errJson?.cooldown) {
          setToastMessage('⏳ Debes esperar 12 horas entre riegos para esta planta.')
          setTimeout(() => setToastMessage(null), 3500)
          setIsWateringAnim(false)
          setIsWateringActive(false)
          return
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
                    canWater: false,
                    remainingCooldownSeconds: 12 * 60 * 60,
                  }
                : f
            )
          )
          setToastMessage(
            `💧 ¡Has regado la planta de ${currentSelectedFriend.name.split(' ')[0]}! (${nextFriendWaterings} riegos · Etapa ${nextFriendWaterings % 30}/30)`
          )
        } else {
          const nextTotal = myWaterings + 1
          setMyWaterings(nextTotal)
          setMyLastWateredAt(nowIso)
          setTimeRemainingSeconds(12 * 60 * 60)

          if (nextTotal % 30 === 0) {
            setToastMessage('🎉 ¡Planta madurada con éxito! Sumada a tu Colección.')
          } else {
            setToastMessage(`¡Planta regada! ${nextTotal % 30}/30 riegos 🌱`)
          }
        }

        try {
          confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.65 },
            colors: ['#E8B75E', '#A9BBA4', '#52B788', '#F1EEE2'],
          })
        } catch {}
      }, 700)

      setTimeout(() => {
        setIsWateringAnim(false)
        setIsWateringActive(false)
      }, 1800)

      setTimeout(() => {
        setToastMessage(null)
      }, 3500)
    } catch (err) {
      console.error('Error watering:', err)
      setIsWateringAnim(false)
      setIsWateringActive(false)
    }
  }

  // Activar SOS de emergencia
  const handleTriggerSOS = async () => {
    setSosOpen(true)
    setSosSending(true)
    setSosBreathTimer(60)

    try {
      if (userId) {
        const { data: friendships } = await supabase
          .from('friendships')
          .select('friend_id, smoker_id')
          .or(`smoker_id.eq.${userId},friend_id.eq.${userId}`)
          .eq('status', 'accepted')

        const friendIds = (friendships || []).map((f) =>
          f.smoker_id === userId ? f.friend_id : f.smoker_id
        )
        const uniqueFriendIds = Array.from(new Set(friendIds))

        if (uniqueFriendIds.length > 0) {
          const notifications = uniqueFriendIds.map((targetId) => ({
            smoker_id: userId,
            friend_id: targetId,
            message: `${userName} necesita apoyo urgente. ¡Tiene un momento de antojo!`,
          }))

          await supabase.from('sos_notifications').insert(notifications)

          try {
            await dispatchPushAlertToFriends(userId, userName)
          } catch (e) {
            console.warn('Push error:', e)
          }
        }
      }

      try {
        confetti({
          particleCount: 30,
          spread: 60,
          origin: { y: 0.7 },
          colors: ['#E8547C', '#FF7B98', '#E8B75E'],
        })
      } catch {}
    } catch (err) {
      console.error('Error in SOS:', err)
    } finally {
      setSosSending(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4" style={{ background: 'radial-gradient(120% 90% at 50% -10%, #223729 0%, #16241C 45%, #0F1913 100%)' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full border-2 border-[#E8B75E]/30 border-t-[#E8B75E] animate-spin" />
          <p className="font-fraunces text-sm text-[#A9BBA4]">Abriendo Jardín...</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen w-full flex justify-center py-0 sm:py-7 antialiased select-none"
      style={{
        background: 'radial-gradient(120% 90% at 50% -10%, #223729 0%, #16241C 45%, #0F1913 100%)',
        fontFamily: "'Work Sans', sans-serif",
        color: '#F1EEE2',
      }}
    >
      {/* PANTALLA CONTENEDORA MÓVIL (390px) */}
      <div
        className="w-full sm:w-[390px] min-h-screen sm:min-h-[820px] relative flex flex-col sm:rounded-[34px] overflow-hidden sm:border sm:border-[rgba(232,183,94,0.08)] sm:shadow-[0_40px_80px_rgba(0,0,0,0.5)] pb-[110px]"
        style={{
          background: 'radial-gradient(120% 90% at 50% -10%, #223729 0%, #16241C 45%, #0F1913 100%)',
        }}
      >
        {/* TEXTURA SUTIL DE HOJAS Y LUZ */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 15% 8%, rgba(232,183,94,0.07), transparent 40%), radial-gradient(circle at 85% 92%, rgba(169,187,164,0.06), transparent 45%)',
          }}
        />

        {/* TOAST DE FEEDBACK */}
        {toastMessage && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-xs bg-[#16241C]/95 border border-[rgba(232,183,94,0.25)] text-[#F1EEE2] text-xs py-3 px-4 rounded-2xl shadow-xl flex items-center gap-2.5 backdrop-blur-md animate-in fade-in slide-in-from-top-3">
            <span className="text-[#E8B75E] text-sm shrink-0">✨</span>
            <span className="font-medium leading-tight">{toastMessage}</span>
          </div>
        )}

        {/* =================================================================== */}
        {/* 1. CABECERA                                                         */}
        {/* =================================================================== */}
        <header className="pt-[22px] px-[26px] pb-0 relative z-10 flex items-center justify-between">
          <h1 className="font-fraunces font-medium text-[19px] text-[#F1EEE2] tracking-tight">
            Jardín
          </h1>

          {/* CAMPANA DE NOTIFICACIONES */}
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                localStorage.setItem('last_read_notifications_at', new Date().toISOString())
                window.dispatchEvent(new Event('notifications_read'))
              }
              setUnreadNotificationsCount(0)
              router.push('/dashboard/notifications')
            }}
            aria-label="Notificaciones"
            className="w-[32px] h-[32px] rounded-full border border-[rgba(232,183,94,0.18)] bg-[rgba(230,240,227,0.03)] flex items-center justify-center text-[14px] text-[#A9BBA4] hover:text-[#E8B75E] hover:border-[rgba(232,183,94,0.4)] transition-all cursor-pointer relative"
          >
            🔔
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-[#E8547C] rounded-full border border-[#16241C] animate-pulse" />
            )}
          </button>
        </header>

        {/* =================================================================== */}
        {/* 2. TIRA DE JARDINES (FRIEND GARDEN STRIP)                            */}
        {/* =================================================================== */}
        <div className="flex gap-[14px] pt-[18px] px-[26px] pb-[4px] overflow-x-auto relative z-10 no-scrollbar">
          {/* Avatar 'Tú' */}
          <div
            onClick={() => setSelectedGardenId('me')}
            className={`flex flex-col items-center gap-[6px] shrink-0 w-[54px] cursor-pointer group`}
          >
            <div
              className={`w-[50px] h-[50px] rounded-full flex items-center justify-center text-[12.5px] font-semibold transition-all ${
                selectedGardenId === 'me'
                  ? 'border-2 border-[#E8B75E] shadow-[0_0_0_3px_rgba(232,183,94,0.12)] scale-102'
                  : 'border-2 border-transparent hover:border-[#E8B75E]/40'
              }`}
              style={{
                background: 'radial-gradient(circle at 35% 30%, #EFC471, #E8B75E)',
                color: '#2B1C08',
              }}
            >
              Tú
            </div>
            <span
              className={`text-[11px] transition-colors ${
                selectedGardenId === 'me' ? 'text-[#F1EEE2] font-medium' : 'text-[#7C9481]'
              }`}
            >
              Tú
            </span>
          </div>

          {/* Amigos conectados */}
          {friendsGardens.map((friend) => {
            const isActive = selectedGardenId === friend.id
            return (
              <div
                key={friend.id}
                onClick={() => setSelectedGardenId(friend.id)}
                className="flex flex-col items-center gap-[6px] shrink-0 w-[54px] cursor-pointer group"
              >
                <div
                  className={`w-[50px] h-[50px] rounded-full flex items-center justify-center text-[12.5px] font-semibold transition-all ${
                    isActive
                      ? 'border-2 border-[#E8B75E] shadow-[0_0_0_3px_rgba(232,183,94,0.12)] scale-102'
                      : 'border-2 border-transparent hover:border-[#E8B75E]/40'
                  }`}
                  style={{
                    background: 'linear-gradient(145deg, #3B5240, #22321F)',
                    color: '#E8B75E',
                  }}
                >
                  {friend.initials}
                </div>
                <span
                  className={`text-[11px] truncate max-w-[52px] text-center transition-colors ${
                    isActive ? 'text-[#F1EEE2] font-medium' : 'text-[#7C9481]'
                  }`}
                >
                  {friend.name.split(' ')[0]}
                </span>
              </div>
            )
          })}

          {/* Botón 'Añadir' */}
          <div
            onClick={() => setShowAddFriendModal(true)}
            className="flex flex-col items-center gap-[6px] shrink-0 w-[54px] cursor-pointer group"
          >
            <div
              className="w-[50px] h-[50px] rounded-full flex items-center justify-center text-[16px] text-[#7C9481] border-[1.5px] border-dashed border-[rgba(169,187,164,0.3)] hover:border-[#E8B75E] hover:text-[#E8B75E] transition-all bg-transparent"
            >
              +
            </div>
            <span className="text-[11px] text-[#7C9481] group-hover:text-[#E8B75E] transition-colors">
              Añadir
            </span>
          </div>
        </div>

        {/* =================================================================== */}
        {/* 3. PESTAÑAS (TABS CON SUBRAYADO QUIETO Y ELEGANTE)                   */}
        {/* =================================================================== */}
        <div className="flex gap-[18px] pt-[18px] px-[24px] pb-0 border-b border-[rgba(232,183,94,0.1)] relative z-10 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('active')}
            className={`text-[13.5px] font-medium pb-[12px] relative transition-colors cursor-pointer shrink-0 ${
              activeTab === 'active' ? 'text-[#E8B75E]' : 'text-[#7C9481] hover:text-[#F1EEE2]'
            }`}
          >
            Planta viva
            {activeTab === 'active' && (
              <span className="absolute left-0 right-0 bottom-[-1px] h-[2px] bg-[#E8B75E] rounded-full" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('garden')}
            className={`text-[13.5px] font-medium pb-[12px] relative transition-colors cursor-pointer shrink-0 ${
              activeTab === 'garden' ? 'text-[#E8B75E]' : 'text-[#7C9481] hover:text-[#F1EEE2]'
            }`}
          >
            Jardines ({completedPlantsCount})
            {activeTab === 'garden' && (
              <span className="absolute left-0 right-0 bottom-[-1px] h-[2px] bg-[#E8B75E] rounded-full" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('earnings')}
            className={`text-[13.5px] font-medium pb-[12px] relative transition-colors cursor-pointer shrink-0 ${
              activeTab === 'earnings' ? 'text-[#E8B75E]' : 'text-[#7C9481] hover:text-[#F1EEE2]'
            }`}
          >
            Ganancias
            {activeTab === 'earnings' && (
              <span className="absolute left-0 right-0 bottom-[-1px] h-[2px] bg-[#E8B75E] rounded-full" />
            )}
          </button>
        </div>

        {/* =================================================================== */}
        {/* 4. CONTENIDO PRINCIPAL                                              */}
        {/* =================================================================== */}
        <main className="flex-1 flex flex-col justify-between relative z-10 px-0">
          {activeTab === 'active' ? (
            /* =============================================================== */
            /* TARJETA HERO TERRARIUM                                          */
            /* =============================================================== */
            <div className="flex-1 flex flex-col justify-between">
              <div
                className="mx-[20px] mt-[22px] rounded-[28px] p-[22px_22px_26px] relative overflow-hidden z-10 border border-[rgba(232,183,94,0.14)]"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(232,183,94,0.05), rgba(255,255,255,0.02))',
                }}
              >
                {/* ETIQUETA DEL ESPÉCIMEN */}
                <div className="flex justify-between items-start">
                  <div>
                    <div
                      onClick={() => setShowSpeciesInfo(true)}
                      className="font-fraunces font-medium text-[22px] text-[#F1EEE2] leading-tight flex items-center gap-1.5 cursor-pointer hover:text-[#E8B75E] transition-colors"
                      title="Ver información botánica"
                    >
                      <span>{displayedSpecies.name}</span>
                      <Info className="w-3.5 h-3.5 text-[#7C9481] shrink-0" />
                    </div>
                    <div className="font-fraunces italic text-[13.5px] text-[#7C9481] mt-[2px]">
                      {displayedSpecies.scientificName}
                    </div>
                  </div>

                  <div className="text-right text-[12px] text-[#7C9481] leading-[1.4]">
                    Espécimen
                    <b className="block text-[15px] text-[#E8B75E] font-fraunces font-medium">
                      N.º {displayedSpeciesIndex + 1}
                    </b>
                  </div>
                </div>

                {/* ESCENARIO DE LA PLANTA (PLANT STAGE) */}
                <div className="relative h-[300px] mt-[6px] flex items-end justify-center">
                  {/* HALO DE RESPIRACIÓN ORGÁNICO */}
                  <div
                    className="absolute bottom-[60px] left-1/2 -translate-x-1/2 w-[220px] h-[220px] pointer-events-none rounded-full animate-breathe"
                    style={{
                      background:
                        'radial-gradient(circle, rgba(232,183,94,0.28) 0%, rgba(232,183,94,0) 70%)',
                      filter: 'blur(2px)',
                    }}
                  />

                  {/* ANILLO DE CRECIMIENTO CIRCULAR (GROW RING SVG) */}
                  <svg
                    className="absolute bottom-[18px] left-1/2 -translate-x-1/2 w-[190px] h-[190px] pointer-events-none"
                    viewBox="0 0 190 190"
                  >
                    {/* Anillo de fondo */}
                    <circle
                      cx="95"
                      cy="95"
                      r="84"
                      fill="none"
                      stroke="rgba(232,183,94,0.12)"
                      strokeWidth="6"
                    />
                    {/* Anillo de progreso activo */}
                    <circle
                      cx="95"
                      cy="95"
                      r="84"
                      fill="none"
                      stroke="#E8B75E"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray="528"
                      strokeDashoffset={strokeDashoffset}
                      transform="rotate(-90 95 95)"
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>

                  {/* ANIMACIÓN DE RIEGO FLOTANTE */}
                  {isWateringAnim && (
                    <div className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center">
                      <div className="absolute -top-2 right-8 animate-in fade-in slide-in-from-top-3 duration-500">
                        <svg
                          viewBox="0 0 100 80"
                          className="w-20 h-20 -rotate-25 transform drop-shadow-lg"
                          fill="none"
                        >
                          <path
                            d="M30 45 C30 35, 38 28, 50 28 L72 28 C80 28, 86 35, 86 45 L84 68 C84 73, 78 76, 72 76 L44 76 C38 76, 32 73, 32 68 Z"
                            fill="#E8B75E"
                            stroke="#8B5E3C"
                            strokeWidth="2"
                          />
                          <path d="M50 28 C50 14, 76 14, 76 28" stroke="#E8B75E" strokeWidth="3" />
                          <path d="M40 50 L10 26" stroke="#8B5E3C" strokeWidth="4" strokeLinecap="round" />
                        </svg>
                      </div>
                      <div className="absolute top-16 left-1/2 -translate-x-1/2 flex gap-3 text-cyan-300 text-lg animate-bounce">
                        <span>💧</span>
                        <span className="delay-100">💧</span>
                        <span className="delay-200">💧</span>
                      </div>
                    </div>
                  )}

                  {/* ILUSTRACIÓN BOTÁNICA SVG VIVA */}
                  <svg
                    className="relative z-10 drop-shadow-sm select-none"
                    width="180"
                    height="230"
                    viewBox="0 0 180 230"
                    fill="none"
                  >
                    {/* Maceta cerámica / greda */}
                    <path d="M55 185 L125 185 L118 224 Q90 231 62 224 Z" fill="#3D2A1A" />
                    <path d="M55 185 L125 185 L121 197 L59 197 Z" fill="#523823" />
                    <ellipse cx="90" cy="185" rx="35" ry="7" fill="#6B4A2E" />
                    <ellipse cx="90" cy="183" rx="30" ry="5.5" fill="#2E4A34" />

                    {/* Tallos orgánicos adaptados a la especie */}
                    <path
                      d="M90 183 C88 150 78 130 60 108"
                      stroke={displayedSpecies.colorTheme.primary}
                      strokeWidth={Math.max(3, 3.5 + (displayedStage / 30) * 1.5)}
                      strokeLinecap="round"
                      fill="none"
                    />
                    <path
                      d="M90 183 C92 148 96 122 90 88"
                      stroke={displayedSpecies.colorTheme.primary}
                      strokeWidth={Math.max(3.5, 4 + (displayedStage / 30) * 1.8)}
                      strokeLinecap="round"
                      fill="none"
                    />
                    <path
                      d="M90 183 C93 152 108 132 128 112"
                      stroke={displayedSpecies.colorTheme.primary}
                      strokeWidth={Math.max(3, 3.5 + (displayedStage / 30) * 1.5)}
                      strokeLinecap="round"
                      fill="none"
                    />

                    {/* Follaje: Racimos de hojas con escala adaptada a la etapa */}
                    <g className="transition-all duration-700 origin-bottom" style={{ transform: `scale(${Math.max(0.6, 0.6 + (displayedStage / 30) * 0.45)})`, transformOrigin: '90px 140px' }}>
                      {/* Rama izquierda */}
                      <g>
                        <ellipse cx="52" cy="98" rx="17" ry="11" fill={displayedSpecies.colorTheme.secondary} transform="rotate(-25 52 98)" />
                        <ellipse cx="66" cy="92" rx="15" ry="10" fill={displayedSpecies.colorTheme.accent} transform="rotate(10 66 92)" />
                      </g>

                      {/* Copa central */}
                      <g>
                        <ellipse cx="88" cy="76" rx="18" ry="12" fill={displayedSpecies.colorTheme.secondary} transform="rotate(-5 88 76)" />
                        <ellipse cx="102" cy="88" rx="15" ry="10" fill={displayedSpecies.colorTheme.accent} transform="rotate(30 102 88)" />
                        <ellipse cx="76" cy="88" rx="14" ry="9" fill={displayedSpecies.colorTheme.bud} transform="rotate(-30 76 88)" />
                      </g>

                      {/* Rama derecha */}
                      <g>
                        <ellipse cx="132" cy="102" rx="17" ry="11" fill={displayedSpecies.colorTheme.secondary} transform="rotate(20 132 102)" />
                        <ellipse cx="120" cy="94" rx="14" ry="9" fill={displayedSpecies.colorTheme.accent} transform="rotate(-15 120 94)" />
                      </g>

                      {/* Floración o brotes si etapa >= 15 */}
                      {displayedStage >= 15 && (
                        <g className="animate-pulse">
                          <circle cx="88" cy="66" r="4.5" fill={displayedSpecies.colorTheme.bloom} />
                          <circle cx="56" cy="86" r="3.5" fill={displayedSpecies.colorTheme.bloom} />
                          <circle cx="124" cy="90" r="3.5" fill={displayedSpecies.colorTheme.bloom} />
                          <circle cx="88" cy="66" r="2.2" fill={displayedSpecies.colorTheme.bud} />
                        </g>
                      )}

                      {/* Gotas de rocío / puntos de luz */}
                      <circle cx="60" cy="95" r="2" fill="#E8F3DE" opacity="0.7" />
                      <circle cx="92" cy="73" r="2.2" fill="#E8F3DE" opacity="0.8" />
                      <circle cx="128" cy="99" r="2" fill="#E8F3DE" opacity="0.6" />
                    </g>
                  </svg>
                </div>

                {/* TEXTO DE PROGRESO */}
                <div className="text-center mt-[4px]">
                  <div className="font-fraunces text-[15px] text-[#E8B75E]">
                    {progressPercent}% de maduración
                  </div>
                  <div className="text-[12.5px] text-[#7C9481] mt-[2px]">
                    {displayedStage} de 30 riegos ·{' '}
                    {activeCooldownSeconds > 0
                      ? `Próximo riego en ${Math.floor(activeCooldownSeconds / 3600)}h ${Math.floor(
                          (activeCooldownSeconds % 3600) / 60
                        )}m`
                      : 'Listo para nutrir hoy'}
                  </div>
                </div>

                {/* BOTÓN FLOTANTE DE RIEGO (WATER FAB) */}
                <button
                  type="button"
                  onClick={handleWaterPlant}
                  disabled={isWateringActive}
                  aria-label="Regar hoy"
                  className="absolute right-[22px] bottom-[22px] w-[50px] h-[50px] rounded-full flex items-center justify-center text-[19px] z-20 transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-[0_8px_18px_rgba(0,0,0,0.2)] hover:shadow-[0_10px_24px_rgba(232,183,94,0.25)]"
                  style={{
                    background: 'rgba(232, 183, 94, 0.12)',
                    backdropFilter: 'blur(6px)',
                    color: '#E8B75E',
                    border: '1px solid rgba(232, 183, 94, 0.3)',
                  }}
                  title={
                    activeCooldownSeconds > 0
                      ? 'Cooldown de 12h activo'
                      : 'Regar planta'
                  }
                >
                  💧
                </button>
              </div>

              {/* SIMULADOR DEV (SOLO CON ?debug=true) */}
              {isDebugParam && (
                <div className="px-6 py-2 border-t border-[rgba(232,183,94,0.1)] text-xs text-[#7C9481]">
                  <div className="flex justify-between items-center mb-1">
                    <button
                      type="button"
                      onClick={() => setIsDemoActive(!isDemoActive)}
                      className="underline text-[#E8B75E]"
                    >
                      {isDemoActive ? 'Desactivar Simulador' : 'Simulador Dev'}
                    </button>
                    <span>Etapa: {demoStage}/30</span>
                  </div>
                  {isDemoActive && (
                    <input
                      type="range"
                      min="0"
                      max="30"
                      value={demoStage}
                      onChange={(e) => setDemoStage(Number(e.target.value))}
                      className="w-full accent-[#E8B75E]"
                    />
                  )}
                </div>
              )}
            </div>
          ) : activeTab === 'garden' ? (
            /* =============================================================== */
            /* VISTA DE JARDINES BOTÁNICOS COSECHADOS                          */
            /* =============================================================== */
            <div className="px-[20px] py-[16px] space-y-3 flex-1 overflow-y-auto no-scrollbar">
              <div className="text-center space-y-0.5 mb-2">
                <h3 className="font-fraunces text-base text-[#F1EEE2]">
                  {isViewingOwnGarden ? 'Tus Jardines Cosechados' : `Jardines de ${effectiveSubjectName}`}
                </h3>
                <p className="text-xs text-[#7C9481]">
                  {completedPlantsCount} de {PLANT_SPECIES.length} especímenes cosechados
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {PLANT_SPECIES.map((species, idx) => {
                  const isHarvested = completedPlantsCount > idx
                  const isCurrentActive = completedPlantsCount === idx

                  return (
                    <div
                      key={species.id}
                      onClick={() => {
                        setInspectedPlant({
                          species,
                          speciesIndex: idx,
                          isHarvested,
                          wateringsCompleted: isHarvested ? 30 : currentPlantStage,
                        })
                      }}
                      className={`relative rounded-[22px] p-3.5 flex flex-col items-center justify-between text-center transition-all cursor-pointer border ${
                        isHarvested
                          ? 'border-[rgba(232,183,94,0.35)] bg-[rgba(232,183,94,0.06)] hover:border-[#E8B75E]'
                          : isCurrentActive
                          ? 'border-2 border-[#E8B75E] bg-[rgba(232,183,94,0.08)] shadow-[0_0_16px_rgba(232,183,94,0.15)]'
                          : 'border-[rgba(232,183,94,0.08)] bg-[rgba(255,255,255,0.02)] opacity-40 hover:opacity-60'
                      }`}
                    >
                      <div className="w-full flex justify-between items-center text-[9px] font-bold text-[#7C9481] mb-1">
                        <span>#{idx + 1}</span>
                        {isHarvested ? (
                          <span className="text-[#E8B75E] bg-[#E8B75E]/10 px-1.5 py-0.5 rounded-full">
                            Madurado ✓
                          </span>
                        ) : isCurrentActive ? (
                          <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                            En curso
                          </span>
                        ) : (
                          <Lock className="w-3 h-3 text-[#7C9481]" />
                        )}
                      </div>

                      <div className="py-2 text-3xl">
                        {idx === 0 ? '🪴' : idx === 1 ? '🌸' : idx === 2 ? '🌿' : idx === 3 ? '🌹' : idx === 4 ? '🌻' : '🌳'}
                      </div>

                      <div className="w-full mt-1">
                        <h4 className="font-fraunces text-xs font-medium text-[#F1EEE2] truncate">
                          {species.name}
                        </h4>
                        <p className="font-fraunces italic text-[10px] text-[#7C9481] truncate">
                          {species.scientificName}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            /* =============================================================== */
            /* VISTA DE RESUMEN DE GANANCIAS POR ABSTINENCIA                   */
            /* =============================================================== */
            <div className="px-[20px] py-[16px] space-y-4 flex-1 overflow-y-auto no-scrollbar">
              <div className="text-center space-y-0.5 mb-1">
                <h3 className="font-fraunces text-base text-[#F1EEE2]">
                  {isViewingOwnGarden ? 'Tus Ganancias por Abstinencia' : `Ganancias de ${effectiveSubjectName}`}
                </h3>
                <p className="text-xs text-[#7C9481]">
                  Dinero no gastado en tabaco y salud acumulada
                </p>
              </div>

              {/* TARJETA HERO DE GANANCIAS */}
              <div
                className="rounded-[26px] p-[22px] border border-[rgba(232,183,94,0.18)] space-y-4 shadow-xl relative overflow-hidden"
                style={{
                  background: 'radial-gradient(120% 90% at 50% -10%, rgba(232,183,94,0.12) 0%, rgba(22,36,28,0.75) 50%, rgba(15,25,19,0.92) 100%)',
                }}
              >
                <div className="flex items-center justify-between pb-3 border-b border-[rgba(232,183,94,0.1)]">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[rgba(232,183,94,0.12)] border border-[rgba(232,183,94,0.25)] flex items-center justify-center text-[#E8B75E]">
                      <Coins className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-fraunces font-medium text-[15.5px] text-[#F1EEE2] leading-tight">
                        Ahorro Acumulado
                      </h4>
                      <span className="text-[10.5px] text-[#7C9481]">
                        {isViewingOwnGarden ? 'Dinero retenido en tu bolsillo' : `Beneficio neto de ${effectiveSubjectName}`}
                      </span>
                    </div>
                  </div>

                  <span className="text-[10px] font-semibold tracking-wider text-[#52B788] bg-[rgba(82,183,136,0.12)] border border-[rgba(82,183,136,0.25)] px-2 py-0.5 rounded-full">
                    AHORRO REAL
                  </span>
                </div>

                {/* HERO STAT */}
                <div className="text-center py-2 space-y-1">
                  <span className="text-[11px] text-[#A9BBA4] uppercase tracking-wider font-medium">
                    {isViewingOwnGarden ? 'Has retenido en tu bolsillo' : `${effectiveSubjectName} ha retenido`}
                  </span>
                  <div className="font-fraunces font-bold text-[38px] text-[#E8B75E] tracking-tight drop-shadow-[0_2px_12px_rgba(232,183,94,0.25)]">
                    +{subjectTotalMoneySaved.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                  </div>
                  <p className="text-[12px] text-[#7C9481]">
                    En <strong className="text-[#F1EEE2] font-semibold">{subjectDaysClean} {subjectDaysClean === 1 ? 'día' : 'días'}</strong> sin fumar
                  </p>
                </div>

                {/* 3 MÉTRICAS */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div className="p-2.5 rounded-xl bg-black/30 border border-[rgba(232,183,94,0.1)] text-center">
                    <span className="text-[10px] text-[#7C9481] block truncate">No fumados</span>
                    <span className="font-fraunces font-semibold text-[15px] text-[#F1EEE2] block mt-0.5">
                      {subjectTotalCigsAvoided.toLocaleString('es-ES')}
                    </span>
                    <span className="text-[9.5px] text-[#A9BBA4]">cigarrillos</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-black/30 border border-[rgba(232,183,94,0.1)] text-center">
                    <span className="text-[10px] text-[#7C9481] block truncate">Ahorro / día</span>
                    <span className="font-fraunces font-semibold text-[15px] text-[#E8B75E] block mt-0.5">
                      {subjectDailySavings.toFixed(2)} €
                    </span>
                    <span className="text-[9.5px] text-[#A9BBA4]">cada día</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-black/30 border border-[rgba(232,183,94,0.1)] text-center">
                    <span className="text-[10px] text-[#7C9481] block truncate">Cajetillas</span>
                    <span className="font-fraunces font-semibold text-[15px] text-[#52B788] block mt-0.5">
                      {subjectPacksAvoided}
                    </span>
                    <span className="text-[9.5px] text-[#A9BBA4]">evitadas</span>
                  </div>
                </div>

                {/* PROYECCIÓN */}
                <div className="p-3.5 rounded-2xl bg-[rgba(255,255,255,0.02)] border border-[rgba(232,183,94,0.12)] space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs text-[#A9BBA4] font-medium">
                    <TrendingUp className="w-3.5 h-3.5 text-[#52B788]" />
                    <span>Proyección de dinero en libertad</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded-xl bg-black/35 border border-white/5 flex flex-col justify-between">
                      <span className="text-[10px] text-[#7C9481]">En 1 mes (30 días)</span>
                      <span className="font-fraunces font-bold text-[17px] text-[#F1EEE2] mt-1">
                        +{subjectMonthlyProjected.toFixed(0)} €
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-black/35 border border-white/5 flex flex-col justify-between">
                      <span className="text-[10px] text-[#7C9481]">En 1 año (365 días)</span>
                      <span className="font-fraunces font-bold text-[17px] text-[#E8B75E] mt-1">
                        +{subjectYearlyProjected.toFixed(0)} €
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-[#7C9481] text-center italic pt-0.5 leading-relaxed">
                    🌿 Cada día limpio es salud para tus pulmones y libertad financiera para tu vida.
                  </p>
                </div>
              </div>
            </div>
          )}
          <div className="h-8 shrink-0 pointer-events-none" />
        </main>

        {/* =================================================================== */}
        {/* 5. BOTÓN FLOTANTE SOS (SOS FAB)                                     */}
        {/* =================================================================== */}
        <button
          type="button"
          onClick={handleTriggerSOS}
          aria-label="Activar alerta SOS"
          className="fixed bottom-[64px] right-[max(16px,calc(50%-175px))] w-[46px] h-[46px] rounded-full flex items-center justify-center text-[18px] z-50 cursor-pointer shadow-[0_8px_24px_rgba(0,0,0,0.45)] transition-transform hover:scale-105 active:scale-90"
          style={{
            background: 'rgba(232, 84, 124, 0.14)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(232, 84, 124, 0.45)',
            color: '#E8547C',
          }}
        >
          ♥
          {/* Anillo de pulso continuo */}
          <span className="absolute -inset-[5px] rounded-full border-[1.5px] border-[rgba(232,84,124,0.28)] animate-pulse-ring pointer-events-none" />
        </button>

        {/* =================================================================== */}
        {/* 6. BARRA DE NAVEGACIÓN INFERIOR (3 MENÚS)                           */}
        {/* =================================================================== */}
        <BottomNav currentTab="home" unreadFriendsCount={0} />
      </div>

      {/* =================================================================== */}
      {/* 6. MODAL SOS: RESPIRACIÓN EN CAJA DE 60s Y ALERTA A AMIGOS         */}
      {/* =================================================================== */}
      {sosOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div
            className="w-full max-w-sm rounded-[28px] p-6 space-y-5 border border-[rgba(232,84,124,0.3)] relative text-center"
            style={{
              background: 'radial-gradient(circle at 50% 0%, #2A171D, #16241C)',
              color: '#F1EEE2',
            }}
          >
            <button
              type="button"
              onClick={() => setSosOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 text-[#A9BBA4] hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#E8547C]">
                Asistencia Inmediata
              </span>
              <h3 className="font-fraunces text-xl font-medium text-[#F1EEE2]">
                ¡No estás solo! Respira conmigo
              </h3>
              <p className="text-xs text-[#A9BBA4]">
                {sosSending
                  ? 'Avisando a tus amigos de apoyo...'
                  : 'Tus amigos han recibido una notificación push de auxilio.'}
              </p>
            </div>

            {/* CÍRCULO GUIADO DE RESPIRACIÓN EN CAJA */}
            <div className="relative w-44 h-44 mx-auto flex items-center justify-center">
              <div
                className={`absolute inset-0 rounded-full border-4 transition-all duration-1000 ${
                  sosBreathPhase === 'Inhala'
                    ? 'scale-110 border-[#E8B75E] bg-[#E8B75E]/10'
                    : sosBreathPhase === 'Mantén'
                    ? 'scale-105 border-cyan-400 bg-cyan-400/10'
                    : 'scale-90 border-[#E8547C] bg-[#E8547C]/10'
                }`}
              />
              <div className="text-center z-10 space-y-1">
                <div className="font-fraunces text-2xl text-[#F1EEE2]">
                  {sosBreathPhase}
                </div>
                <div className="text-xs text-[#A9BBA4]">{sosBreathTimer}s</div>
              </div>
            </div>

            <p className="text-xs text-[#A9BBA4] italic max-w-xs mx-auto leading-relaxed">
              El impulso agudo de nicotina dura menos de 3 minutos. Tu mente es más fuerte que la sustancia.
            </p>

            <button
              type="button"
              onClick={() => setSosOpen(false)}
              className="w-full py-3 bg-[rgba(232,183,94,0.15)] hover:bg-[rgba(232,183,94,0.25)] border border-[rgba(232,183,94,0.3)] text-[#E8B75E] text-xs font-semibold rounded-2xl transition-colors"
            >
              Me siento más tranquilo
            </button>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 7. MODAL INFO DE LA ESPECIE & BENEFICIOS DE SALUD                  */}
      {/* =================================================================== */}
      {showSpeciesInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div
            className="w-full max-w-sm rounded-[28px] p-6 space-y-4 border border-[rgba(232,183,94,0.2)] relative"
            style={{
              background: 'linear-gradient(180deg, #1C2E24, #121D16)',
              color: '#F1EEE2',
            }}
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#E8B75E] bg-[#E8B75E]/10 px-2 py-0.5 rounded-md">
                  Espécimen #{displayedSpeciesIndex + 1}
                </span>
                <h3 className="font-fraunces text-lg font-medium text-[#F1EEE2] mt-1">
                  {displayedSpecies.name}
                </h3>
                <p className="font-fraunces italic text-xs text-[#7C9481]">
                  {displayedSpecies.scientificName}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowSpeciesInfo(false)}
                className="w-8 h-8 rounded-full bg-white/10 text-[#A9BBA4] hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#A9BBA4] leading-relaxed">
              {displayedSpecies.lore}
            </p>

            <div className="p-3.5 rounded-2xl bg-[rgba(232,183,94,0.06)] border border-[rgba(232,183,94,0.18)] flex items-start gap-2.5">
              <HeartPulse className="w-4 h-4 text-[#E8B75E] shrink-0 mt-0.5" />
              <p className="text-xs text-[#F1EEE2] leading-snug">
                <span className="font-semibold text-[#E8B75E]">Beneficio clínico:</span>{' '}
                {displayedSpecies.healingBenefit}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowSpeciesInfo(false)}
              className="w-full py-2.5 bg-[#E8B75E] text-[#2B1C08] font-semibold text-xs rounded-2xl hover:bg-[#E8B75E]/90 transition-colors"
            >
              Comprendido
            </button>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 8. MODAL AÑADIR AMIGO / COMPARTIR CÓDIGO                            */}
      {/* =================================================================== */}
      {showAddFriendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div
            className="w-full max-w-sm rounded-[28px] p-6 space-y-4 border border-[rgba(232,183,94,0.2)] relative"
            style={{
              background: 'linear-gradient(180deg, #1C2E24, #121D16)',
              color: '#F1EEE2',
            }}
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-fraunces text-lg font-medium text-[#F1EEE2]">
                  Conectar con un amigo
                </h3>
                <p className="text-xs text-[#7C9481] mt-0.5">
                  Comparte tu código para que riegue tu planta y te asista
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddFriendModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 text-[#A9BBA4] hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 bg-black/20 rounded-2xl border border-[rgba(232,183,94,0.12)] space-y-2 text-center">
              <div className="text-[10px] uppercase tracking-wider text-[#7C9481]">
                Tu identificador de jardín
              </div>
              <div className="font-mono text-xs text-[#E8B75E] select-all break-all">
                {userId}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (navigator?.clipboard && userId) {
                    navigator.clipboard.writeText(userId)
                    setInviteCopied(true)
                    setTimeout(() => setInviteCopied(false), 2000)
                  }
                }}
                className="flex-1 py-2.5 bg-[rgba(232,183,94,0.15)] border border-[rgba(232,183,94,0.3)] text-[#E8B75E] text-xs font-semibold rounded-2xl flex items-center justify-center gap-1.5 hover:bg-[rgba(232,183,94,0.25)] transition-colors"
              >
                {inviteCopied ? <CheckCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{inviteCopied ? 'Copiado' : 'Copiar ID'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowAddFriendModal(false)
                  router.push('/dashboard/friends')
                }}
                className="flex-1 py-2.5 bg-[#E8B75E] text-[#2B1C08] text-xs font-semibold rounded-2xl flex items-center justify-center gap-1.5 hover:bg-[#E8B75E]/90 transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                <span>Buscar amigos</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 9. MODAL INSPECCIÓN DE ESPÉCIMEN COSECHADO                         */}
      {/* =================================================================== */}
      {inspectedPlant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div
            className="w-full max-w-sm rounded-[28px] p-6 space-y-4 border border-[rgba(232,183,94,0.2)] relative text-center"
            style={{
              background: 'linear-gradient(180deg, #1C2E24, #121D16)',
              color: '#F1EEE2',
            }}
          >
            <button
              type="button"
              onClick={() => setInspectedPlant(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 text-[#A9BBA4] hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-4xl py-2">
              {inspectedPlant.speciesIndex === 0 ? '🪴' : inspectedPlant.speciesIndex === 1 ? '🌸' : inspectedPlant.speciesIndex === 2 ? '🌿' : inspectedPlant.speciesIndex === 3 ? '🌹' : inspectedPlant.speciesIndex === 4 ? '🌻' : '🌳'}
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#E8B75E] bg-[#E8B75E]/10 px-2 py-0.5 rounded-md">
                Espécimen #{inspectedPlant.speciesIndex + 1}
              </span>
              <h3 className="font-fraunces text-xl font-medium text-[#F1EEE2] mt-1">
                {inspectedPlant.species.name}
              </h3>
              <p className="font-fraunces italic text-xs text-[#7C9481]">
                {inspectedPlant.species.scientificName}
              </p>
            </div>

            <p className="text-xs text-[#A9BBA4] leading-relaxed">
              {inspectedPlant.species.lore}
            </p>

            <div className="p-3 rounded-2xl bg-[rgba(232,183,94,0.06)] border border-[rgba(232,183,94,0.18)] text-left flex items-start gap-2.5">
              <HeartPulse className="w-4 h-4 text-[#E8B75E] shrink-0 mt-0.5" />
              <p className="text-xs text-[#F1EEE2] leading-snug">
                <span className="font-semibold text-[#E8B75E]">Salud pulmonar:</span>{' '}
                {inspectedPlant.species.healingBenefit}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setInspectedPlant(null)}
              className="w-full py-2.5 bg-[#E8B75E] text-[#2B1C08] font-semibold text-xs rounded-2xl hover:bg-[#E8B75E]/90 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PlantPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen w-full flex items-center justify-center p-4"
          style={{ background: 'radial-gradient(120% 90% at 50% -10%, #223729 0%, #16241C 45%, #0F1913 100%)' }}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full border-2 border-[#E8B75E]/30 border-t-[#E8B75E] animate-spin" />
            <p className="font-fraunces text-sm text-[#A9BBA4]">Abriendo Jardín...</p>
          </div>
        </div>
      }
    >
      <PlantPageContent />
    </Suspense>
  )
}
