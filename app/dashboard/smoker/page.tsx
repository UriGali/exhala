'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  Home,
  Users,
  Award,
  User,
  X,
  AlertCircle,
  Sparkles,
  HeartPulse,
  Settings,
  Calendar,
  DollarSign,
  Cigarette,
  Check,
  Loader2,
  TrendingUp,
  Droplets,
  Clock,
  Sprout,
  TreePine,
  Leaf,
} from 'lucide-react'
import confetti from 'canvas-confetti'
import { supabase } from '@/lib/supabase/client'
import { Profile } from '@/types/database.types'
import BottomNav from '@/components/BottomNav'

// Props para la ilustración de la planta orgánica multi-fase
interface OrganicPlantProps {
  growthPhase: number // 1: Brote, 2: Tallo joven, 3: Arbusto, 4: Árbol maduro
  healthScore: number
  isWithering: boolean
  isWateringAnim: boolean
}

function OrganicPlant({ growthPhase, healthScore, isWithering, isWateringAnim }: OrganicPlantProps) {
  const strokeColor = isWithering ? '#A3A3A3' : '#2D6A4F'
  const leafColor = isWithering ? '#D4D4D4' : '#52B788'
  const accentColor = isWithering ? '#E5E5E5' : '#74C69D'
  const budColor = isWithering ? '#E5E5E5' : '#34D399'

  // Escala según fase de crecimiento
  const scaleClass =
    growthPhase === 1
      ? 'scale-90'
      : growthPhase === 2
      ? 'scale-100'
      : growthPhase === 3
      ? 'scale-110'
      : 'scale-120'

  return (
    <div className="relative w-64 h-64 mx-auto flex items-center justify-center">
      {/* Halo de respiración o destello de absorción verde esmeralda */}
      <div
        className={`absolute inset-0 rounded-full transition-all duration-1000 ${
          isWithering
            ? 'bg-neutral-100/50 scale-95'
            : isWateringAnim
            ? 'bg-emerald-200/50 scale-110 ring-8 ring-emerald-300/40 animate-pulse'
            : 'bg-emerald-50/70 scale-100 animate-pulse'
        }`}
        style={{ animationDuration: isWateringAnim ? '0.8s' : '4s' }}
      />

      {/* ======================================================== */}
      {/* ANIMACIÓN INTERACTIVA: REGADERA Y GOTAS DE AGUA FLOTANTES */}
      {/* ======================================================== */}
      {isWateringAnim && (
        <div className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center">
          {/* Regadera flotante inclinada */}
          <div className="absolute -top-3 right-6 transition-transform duration-700 animate-in fade-in slide-in-from-top-4">
            <svg
              viewBox="0 0 100 80"
              className="w-24 h-24 drop-shadow-md text-emerald-800 -rotate-25 transform origin-bottom-left transition-transform duration-500"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Cuerpo de la regadera */}
              <path
                d="M30 45 C30 35, 38 28, 50 28 L72 28 C80 28, 86 35, 86 45 L84 68 C84 73, 78 76, 72 76 L44 76 C38 76, 32 73, 32 68 Z"
                fill="#065F46"
                stroke="#022C22"
                strokeWidth="2"
              />
              {/* Asa superior */}
              <path
                d="M50 28 C50 14, 76 14, 76 28"
                stroke="#047857"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              {/* Asa lateral */}
              <path
                d="M84 38 C94 40, 94 62, 82 66"
                stroke="#047857"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              {/* Caño de vertido */}
              <path
                d="M36 50 L14 36 L12 40 L34 58"
                fill="#047857"
                stroke="#022C22"
                strokeWidth="1.5"
              />
              {/* Cabezal rociador */}
              <ellipse
                cx="12"
                cy="36"
                rx="4"
                ry="7"
                transform="rotate(-20 12 36)"
                fill="#10B981"
                stroke="#022C22"
                strokeWidth="1.2"
              />
            </svg>
          </div>

          {/* Chorrito / Gotas de agua animadas cayendo hacia el centro */}
          <div className="absolute top-16 right-20 flex flex-col items-center gap-1.5 pointer-events-none">
            <span className="w-2 h-3.5 bg-sky-400 rounded-full animate-bounce delay-75 shadow-xs" />
            <span className="w-1.5 h-3 bg-sky-300 rounded-full animate-bounce delay-150 shadow-xs" />
            <span className="w-2 h-3.5 bg-blue-400 rounded-full animate-bounce delay-300 shadow-xs" />
          </div>

          {/* Badge flotante de vitalidad */}
          <div className="absolute bottom-4 flex items-center justify-center animate-in fade-in slide-in-from-bottom-2 duration-300">
            <span className="text-xs font-semibold text-emerald-900 bg-white/95 border border-emerald-200 px-3.5 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 backdrop-blur-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              ¡Agua absorbida! +1 Vitalidad 🌱
            </span>
          </div>
        </div>
      )}

      <svg
        viewBox="0 0 200 200"
        className={`w-52 h-52 transition-all duration-700 ${scaleClass} ${
          isWithering ? 'opacity-60 rotate-3' : 'opacity-100'
        }`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Tallo central */}
        <path
          d={
            growthPhase === 1
              ? 'M100 170 C 100 140, 98 120, 100 80'
              : 'M100 170 C 100 130, 98 100, 100 35'
          }
          stroke={strokeColor}
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Hoja superior */}
        <path
          d={
            growthPhase === 1
              ? 'M100 80 C 92 65, 108 65, 100 80'
              : 'M100 35 C 92 20, 108 20, 100 35'
          }
          fill={leafColor}
          stroke={strokeColor}
          strokeWidth="1.5"
        />

        {/* Fase 1+: Hojas primarias */}
        <path
          d="M99 135 C 75 125, 60 100, 52 82"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M52 82 C 45 68, 62 70, 70 79 C 78 88, 59 95, 52 82 Z"
          fill={leafColor}
          fillOpacity={healthScore > 20 ? 0.95 : 0.4}
          stroke={strokeColor}
          strokeWidth="1.2"
        />

        <path
          d="M101 125 C 125 115, 140 92, 148 76"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M148 76 C 155 62, 138 64, 130 73 C 122 82, 141 89, 148 76 Z"
          fill={leafColor}
          fillOpacity={healthScore > 40 ? 0.95 : 0.4}
          stroke={strokeColor}
          strokeWidth="1.2"
        />

        {/* Fase 2+: Hojas intermedias y brotes */}
        {growthPhase >= 2 && (
          <>
            <path
              d="M75 110 C 60 105, 55 90, 62 82 C 69 74, 80 92, 75 110 Z"
              fill={accentColor}
              fillOpacity={healthScore > 50 ? 0.85 : 0.3}
              stroke={strokeColor}
              strokeWidth="1.2"
            />
            <path
              d="M125 102 C 140 97, 145 82, 138 74 C 131 66, 120 84, 125 102 Z"
              fill={accentColor}
              fillOpacity={healthScore > 70 ? 0.85 : 0.3}
              stroke={strokeColor}
              strokeWidth="1.2"
            />
          </>
        )}

        {/* Fase 3+: Ramas densas */}
        {growthPhase >= 3 && (
          <>
            <path
              d="M100 70 C 88 58, 85 45, 93 42 C 101 39, 106 55, 100 70 Z"
              fill={budColor}
              stroke={strokeColor}
              strokeWidth="1.2"
            />
            <path
              d="M100 65 C 112 53, 115 40, 107 37 C 99 34, 94 50, 100 65 Z"
              fill={leafColor}
              stroke={strokeColor}
              strokeWidth="1.2"
            />
            <path
              d="M85 95 C 70 85, 72 70, 80 75 Z"
              fill={accentColor}
              stroke={strokeColor}
              strokeWidth="1"
            />
            <path
              d="M115 90 C 130 80, 128 65, 120 70 Z"
              fill={budColor}
              stroke={strokeColor}
              strokeWidth="1"
            />
          </>
        )}

        {/* Fase 4: Floraciones y follaje majestuoso */}
        {growthPhase >= 4 && (
          <>
            <circle cx="100" cy="35" r="4" fill="#F59E0B" />
            <circle cx="62" cy="82" r="3" fill="#F59E0B" />
            <circle cx="138" cy="74" r="3" fill="#F59E0B" />
            <path
              d="M100 35 C 95 15, 105 15, 100 35 Z"
              fill="#FDE047"
              stroke="#D97706"
              strokeWidth="0.8"
            />
          </>
        )}

        {/* Base / maceta minimalista */}
        <path d="M80 170 C 80 178, 120 178, 120 170 Z" fill="#171717" />
      </svg>
    </div>
  )
}

type TabType = 'home' | 'friends' | 'badges' | 'profile'
type BreathPhase = 'Inhala' | 'Mantén' | 'Exhala'

export default function SmokerDashboard() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabType>('home')
  
  // Estado de autenticación y carga de datos reales
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loadingProfile, setLoadingProfile] = useState<boolean>(true)

  // Estados de modales
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false)
  const [showSOSModal, setShowSOSModal] = useState<boolean>(false)
  const [showRelapseModal, setShowRelapseModal] = useState<boolean>(false)
  const [isWithering, setIsWithering] = useState<boolean>(false)

  // Sistema de riego de 12 horas & vitalidad
  const [totalWaterings, setTotalWaterings] = useState<number>(0)
  const [lastWateredAt, setLastWateredAt] = useState<string | null>(null)
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState<number>(0)
  const [isWateringActive, setIsWateringActive] = useState<boolean>(false)
  const [isWateringAnim, setIsWateringAnim] = useState<boolean>(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Formulario de configuración inicial / perfil
  const [formFullName, setFormFullName] = useState<string>('')
  const [formSmokeFreeSince, setFormSmokeFreeSince] = useState<string>('')
  const [formCigsPerDay, setFormCigsPerDay] = useState<number>(15)
  const [formPackPrice, setFormPackPrice] = useState<number>(5.5)
  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false)
  const [configError, setConfigError] = useState<string | null>(null)

  // Estado de recaída
  const [relapseReason, setRelapseReason] = useState<string>('')
  const [isSubmittingRelapse, setIsSubmittingRelapse] = useState<boolean>(false)
  const penaltyPerRelapse = Number(profile?.penalty_amount) || 1.0

  // Estado de respiración guiada SOS
  const [breathPhase, setBreathPhase] = useState<BreathPhase>('Inhala')
  const [breathTimer, setBreathTimer] = useState<number>(60)
  const [isBreathingActive, setIsBreathingActive] = useState<boolean>(false)

  // Cargar usuario autenticado, perfil y riegos desde Supabase
  const loadUserData = useCallback(async () => {
    setLoadingProfile(true)
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        router.push('/')
        return
      }

      setUserId(user.id)

      // Obtener perfil desde la tabla profiles
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (profileError) {
        console.error('Error fetching profile:', profileError)
      }

      if (userProfile) {
        if (!userProfile.smoke_free_since) {
          router.push('/onboarding')
          return
        }

        setProfile(userProfile)
        setFormFullName(userProfile.full_name || '')
        setFormCigsPerDay(userProfile.cigs_per_day || 15)
        setFormPackPrice(Number(userProfile.pack_price) || 5.5)
        
        const dt = new Date(userProfile.smoke_free_since)
        const localIso = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16)
        setFormSmokeFreeSince(localIso)

        // Consultar riegos totales y último riego
        const { data: waterActions, count } = await supabase
          .from('plant_actions')
          .select('created_at', { count: 'exact' })
          .eq('smoker_id', user.id)
          .eq('action_type', 'water')
          .order('created_at', { ascending: false })

        setTotalWaterings(count || 0)

        if (waterActions && waterActions.length > 0) {
          const lastDate = waterActions[0].created_at
          setLastWateredAt(lastDate)
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
      } else {
        router.push('/onboarding')
        return
      }
    } catch (err) {
      console.error('Error in loadUserData:', err)
    } finally {
      setLoadingProfile(false)
    }
  }, [router])

  useEffect(() => {
    loadUserData()
  }, [loadUserData])

  // Timer de 12h cuenta regresiva
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

  // Formato para mostrar horas y minutos restantes
  const formattedCountdown = useMemo(() => {
    if (timeRemainingSeconds <= 0) return null
    const hours = Math.floor(timeRemainingSeconds / 3600)
    const minutes = Math.floor((timeRemainingSeconds % 3600) / 60)
    const seconds = timeRemainingSeconds % 60
    return `${hours.toString().padStart(2, '0')}h ${minutes
      .toString()
      .padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`
  }, [timeRemainingSeconds])

  // Fase de crecimiento de la planta basada en riegos + días limpios
  const growthPhase = useMemo(() => {
    const points = totalWaterings
    if (points >= 15) return 4 // Árbol floreciente
    if (points >= 8) return 3  // Arbusto frondoso
    if (points >= 3) return 2  // Tallo joven
    return 1                   // Brote tierno
  }, [totalWaterings])

  const growthPhaseName = useMemo(() => {
    if (growthPhase === 4) return 'Árbol Majestuoso 🌸'
    if (growthPhase === 3) return 'Arbusto Frondoso 🌿'
    if (growthPhase === 2) return 'Planta Joven 🌱'
    return 'Brote Inicial 🌱'
  }, [growthPhase])

  // Manejar acción de regar planta cada 12h con animación de regadera
  const handleWaterPlant = async () => {
    if (timeRemainingSeconds > 0 || isWateringActive || !userId) return
    setIsWateringActive(true)
    setIsWateringAnim(true)

    try {
      const nowIso = new Date().toISOString()

      // Registrar en Supabase tras iniciar el vertido de agua
      const { error } = await supabase.from('plant_actions').insert({
        smoker_id: userId,
        friend_id: userId,
        action_type: 'water',
        created_at: nowIso,
      })

      if (error) throw error

      // Sincronizar el destello de absorción a los 1100ms
      setTimeout(() => {
        setTotalWaterings((prev) => prev + 1)
        setLastWateredAt(nowIso)
        setTimeRemainingSeconds(12 * 60 * 60) // 12 horas en segundos

        setToastMessage('¡Planta regada con éxito! +1 Nivel de Vitalidad 🌱')

        // Confeti suave de celebración
        try {
          confetti({
            particleCount: 40,
            spread: 70,
            origin: { y: 0.62 },
            colors: ['#10B981', '#34D399', '#38BDF8', '#74C69D'],
            disableForReducedMotion: true,
          })
        } catch {}
      }, 1100)

      // Finalizar animación a los 2200ms
      setTimeout(() => {
        setIsWateringAnim(false)
        setIsWateringActive(false)
      }, 2200)

      setTimeout(() => {
        setToastMessage(null)
      }, 3800)
    } catch (err) {
      console.error('Error watering plant:', err)
      setIsWateringAnim(false)
      setIsWateringActive(false)
    }
  }

  // Temporizador de respiración SOS
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null
    if (showSOSModal && isBreathingActive && breathTimer > 0) {
      interval = setInterval(() => {
        setBreathTimer((prev) => prev - 1)
        const cycle = (60 - breathTimer) % 12
        if (cycle < 4) {
          setBreathPhase('Inhala')
        } else if (cycle < 8) {
          setBreathPhase('Mantén')
        } else {
          setBreathPhase('Exhala')
        }
      }, 1000)
    } else if (breathTimer === 0) {
      setIsBreathingActive(false)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [showSOSModal, isBreathingActive, breathTimer])

  // CÁLCULOS REALES EN TIEMPO REAL
  const metrics = useMemo(() => {
    if (!profile?.smoke_free_since) {
      return {
        days: 0,
        hours: 0,
        moneySaved: 0,
        cigsAvoided: 0,
        healthScore: 20,
      }
    }

    const quitTime = new Date(profile.smoke_free_since).getTime()
    const now = Date.now()
    const diffMs = Math.max(0, now - quitTime)
    
    const totalHours = diffMs / (1000 * 60 * 60)
    const days = Math.floor(totalHours / 24)
    const hours = Math.floor(totalHours % 24)
    const daysFraction = totalHours / 24

    const cigsPerDay = profile.cigs_per_day || 15
    const packPrice = Number(profile.pack_price) || 5.5
    const pricePerCig = packPrice / 20

    const cigsAvoided = Math.floor(daysFraction * cigsPerDay)
    const moneySaved = Number((cigsAvoided * pricePerCig).toFixed(2))

    let health = 20
    if (daysFraction >= 30) {
      health = 100
    } else if (daysFraction >= 14) {
      health = Math.min(98, Math.round(80 + ((daysFraction - 14) / 16) * 18))
    } else if (daysFraction >= 7) {
      health = Math.min(80, Math.round(60 + ((daysFraction - 7) / 7) * 20))
    } else if (daysFraction >= 1) {
      health = Math.min(60, Math.round(35 + ((daysFraction - 1) / 6) * 25))
    } else {
      health = Math.min(35, Math.round(20 + daysFraction * 15))
    }

    return {
      days,
      hours,
      moneySaved,
      cigsAvoided,
      healthScore: health,
    }
  }, [profile])

  // Guardar configuración del perfil
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return

    setIsSavingConfig(true)
    setConfigError(null)

    try {
      const smokeFreeDate = formSmokeFreeSince
        ? new Date(formSmokeFreeSince).toISOString()
        : new Date().toISOString()

      const payload = {
        id: userId,
        role: 'smoker' as const,
        full_name: formFullName.trim() || 'Compañero',
        smoke_free_since: smokeFreeDate,
        cigs_per_day: Number(formCigsPerDay) || 15,
        pack_price: Number(formPackPrice) || 5.5,
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('profiles')
        .upsert(payload)
        .select()
        .single()

      if (error) throw error

      setProfile(data)
      setShowConfigModal(false)
    } catch (err: any) {
      console.error('Error saving profile:', err)
      setConfigError(err.message || 'No se pudieron guardar los datos. Inténtalo de nuevo.')
    } finally {
      setIsSavingConfig(false)
    }
  }

  // Registrar recaída en Supabase y reiniciar racha
  const handleConfirmRelapse = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return

    setIsSubmittingRelapse(true)

    try {
      const nowIso = new Date().toISOString()

      await supabase.from('relapses').insert({
        smoker_id: userId,
        date: nowIso,
        penalty_amount: penaltyPerRelapse,
        notes: relapseReason.trim() || null,
      })

      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update({
          smoke_free_since: nowIso,
          updated_at: nowIso,
        })
        .eq('id', userId)
        .select()
        .single()

      if (!updateError && updatedProfile) {
        setProfile(updatedProfile)
      }

      setIsWithering(true)
      setShowRelapseModal(false)
      setRelapseReason('')

      setTimeout(() => {
        setIsWithering(false)
      }, 4000)
    } catch (err) {
      console.error('Error registering relapse:', err)
    } finally {
      setIsSubmittingRelapse(false)
    }
  }

  const handleOpenSOS = () => {
    setBreathTimer(60)
    setBreathPhase('Inhala')
    setIsBreathingActive(true)
    setShowSOSModal(true)
  }

  // Pantalla de carga inicial
  if (loadingProfile) {
    return (
      <div className="min-h-[100dvh] w-full bg-white flex flex-col items-center justify-center max-w-md mx-auto p-6 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-neutral-900 flex items-center justify-center animate-pulse">
          <HeartPulse className="w-6 h-6 text-emerald-400" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
          Cargando tu progreso...
        </p>
      </div>
    )
  }

  const userName = profile?.full_name || 'Compañero'

  return (
    <div className="min-h-[100dvh] w-full bg-white text-neutral-900 flex flex-col justify-between max-w-md mx-auto relative antialiased select-none pb-24">
      {/* NOTIFICACIÓN TOAST */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-sm bg-neutral-950 text-white text-xs py-3 px-4 rounded-2xl shadow-sm flex items-center gap-2.5 animate-in fade-in slide-in-from-top duration-300">
          <div className="w-4 h-4 rounded-full bg-blue-400/20 text-blue-400 flex items-center justify-center shrink-0">
            <Check className="w-3 h-3" />
          </div>
          <span className="font-medium leading-tight">{toastMessage}</span>
        </div>
      )}

      {/* HEADER SUPERIOR CON LOGO OFICIAL */}
      <header className="pt-6 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative w-32 h-10 shrink-0">
            <Image
              src="/logo-wordmark.png"
              alt="Exhala"
              fill
              sizes="128px"
              className="object-contain object-left"
            />
          </div>
        </div>

        {/* Botón Configuración / Indicador de Racha */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowConfigModal(true)}
            className="w-8 h-8 rounded-full bg-neutral-100 text-neutral-600 hover:text-neutral-950 flex items-center justify-center transition-colors"
            title="Ajustar datos de consumo y fecha"
          >
            <Settings className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1.5 px-3 py-1 bg-neutral-100 rounded-full">
            <div className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            <span className="text-xs font-medium text-neutral-700">En racha</span>
          </div>
        </div>
      </header>

      {/* CONTENIDO CENTRAL */}
      <main className="flex-1 flex flex-col justify-around px-6 py-4 space-y-4">
        {/* MÉTRICA PRINCIPAL: DÍAS SIN FUMAR */}
        <section className="text-center my-1">
          <div className="flex items-baseline justify-center gap-1.5">
            <span className="text-6xl font-light tracking-tight text-neutral-950 font-sans">
              {metrics.days}
            </span>
            <span className="text-xl text-neutral-500 font-normal">
              {metrics.days === 1 ? 'día' : 'días'}
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1 uppercase tracking-wider font-medium">
            {metrics.hours > 0 ? `${metrics.hours}h adicionales libres de humo` : 'Libre de humo'}
          </p>
        </section>

        {/* PROTAGONISTA CENTRAL: PLANTA ORGÁNICA MULTI-FASE */}
        <section className="my-1 flex flex-col items-center">
          <OrganicPlant
            growthPhase={growthPhase}
            healthScore={metrics.healthScore}
            isWithering={isWithering}
            isWateringAnim={isWateringAnim}
          />
          
          {/* Badge de Fase de Crecimiento y Enlace a Jardín */}
          <div className="mt-2 flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-neutral-900 bg-neutral-100 px-3 py-1 rounded-full border border-neutral-200/60">
                Fase: {growthPhaseName}
              </span>
              <span className="text-xs text-neutral-400">
                • {totalWaterings} {totalWaterings === 1 ? 'riego' : 'riegos'}
              </span>
            </div>
            <Link
              href="/dashboard/plant"
              className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/80 px-3 py-1 rounded-full flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <Sprout className="w-3.5 h-3.5 text-emerald-600" />
              <span>Ver Crecimiento en Jardín ({totalWaterings % 30}/30) →</span>
            </Link>
          </div>
        </section>

        {/* BOTÓN / SISTEMA DE RIEGO DE 12 HORAS */}
        <section className="bg-white border border-neutral-200/80 rounded-3xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-100">
                <Droplets className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-neutral-900 block leading-tight">
                  Cuidado & Riego
                </span>
                <span className="text-[10px] text-neutral-400">
                  Cada 12 horas para nutrir tu planta
                </span>
              </div>
            </div>

            {timeRemainingSeconds > 0 ? (
              <span className="text-[11px] font-mono text-neutral-500 bg-neutral-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                <Clock className="w-3 h-3 text-neutral-400" />
                {formattedCountdown}
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 rounded-full">
                Disponible ahora
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleWaterPlant}
            disabled={timeRemainingSeconds > 0 || isWateringActive}
            className={`w-full h-12 rounded-2xl font-medium text-xs flex items-center justify-between px-4 transition-all duration-200 active:scale-[0.98] ${
              timeRemainingSeconds > 0
                ? 'bg-neutral-100 text-neutral-400 border border-neutral-200/60 cursor-not-allowed'
                : 'bg-neutral-950 hover:bg-neutral-900 text-white shadow-xs group'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
                  timeRemainingSeconds > 0
                    ? 'bg-neutral-200 text-neutral-400'
                    : 'bg-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500/30'
                }`}
              >
                <Droplets className="w-3.5 h-3.5" />
              </div>
              <span className="font-medium text-xs">
                {timeRemainingSeconds > 0
                  ? 'En reposo de hidratación'
                  : isWateringActive
                  ? 'Regando tu planta...'
                  : 'Regar mi planta (+1 Vitalidad)'}
              </span>
            </div>

            {timeRemainingSeconds > 0 ? (
              <span className="text-[10px] text-neutral-400 font-mono">
                {formattedCountdown}
              </span>
            ) : (
              <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                <span>Regar 💧</span>
              </span>
            )}
          </button>
        </section>

        {/* MÉTRICAS SECUNDARIAS REALES */}
        <section className="grid grid-cols-2 gap-4 pt-3 border-t border-neutral-100">
          <div className="flex flex-col items-center text-center">
            <span className="text-2xl font-normal text-neutral-900">
              {metrics.moneySaved.toFixed(2)}€
            </span>
            <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-medium mt-0.5">
              Ahorrado ({metrics.cigsAvoided} cigs)
            </span>
          </div>

          <div className="flex flex-col items-center text-center border-l border-neutral-100">
            <span className="text-2xl font-normal text-emerald-800">
              {metrics.healthScore}%
            </span>
            <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-medium mt-0.5">
              Salud recuperada
            </span>
          </div>
        </section>

        {/* ACCIONES DIRECTAS */}
        <section className="space-y-2.5 pt-1">
          <button
            type="button"
            onClick={() => setShowRelapseModal(true)}
            className="w-full h-11 bg-white border border-neutral-200 text-neutral-600 font-medium text-xs rounded-2xl flex items-center justify-center transition-transform active:scale-[0.98] active:bg-neutral-50"
          >
            <span>He fumado un cigarrillo</span>
          </button>
        </section>
      </main>

      {/* MODAL: CONFIGURACIÓN INICIAL / AJUSTES DEL PERFIL */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 space-y-4 animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold text-neutral-950">
                  Ajustar datos
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Calculamos tu ahorro y salud con tus datos reales.
                </p>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 hover:text-neutral-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {configError && (
              <div className="p-3 bg-red-50 text-red-700 rounded-2xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{configError}</span>
              </div>
            )}

            <form onSubmit={handleSaveConfig} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">
                  Tu nombre
                </label>
                <input
                  type="text"
                  value={formFullName}
                  onChange={(e) => setFormFullName(e.target.value)}
                  placeholder="Tu nombre"
                  required
                  className="w-full h-12 px-3.5 bg-white border border-neutral-200 rounded-2xl text-sm text-neutral-900 focus:outline-none focus:border-neutral-900 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1 flex items-center justify-between">
                  <span>Fecha y hora de inicio</span>
                  <span className="text-[10px] text-neutral-400">Último cigarrillo</span>
                </label>
                <input
                  type="datetime-local"
                  value={formSmokeFreeSince}
                  onChange={(e) => setFormSmokeFreeSince(e.target.value)}
                  required
                  className="w-full h-12 px-3.5 bg-white border border-neutral-200 rounded-2xl text-sm text-neutral-900 focus:outline-none focus:border-neutral-900 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1">
                    Cigarrillos / día
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={formCigsPerDay}
                    onChange={(e) => setFormCigsPerDay(Number(e.target.value))}
                    required
                    className="w-full h-12 px-3.5 bg-white border border-neutral-200 rounded-2xl text-sm text-neutral-900 focus:outline-none focus:border-neutral-900 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1">
                    Precio paquete (€)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.5"
                    max="50"
                    value={formPackPrice}
                    onChange={(e) => setFormPackPrice(Number(e.target.value))}
                    required
                    className="w-full h-12 px-3.5 bg-white border border-neutral-200 rounded-2xl text-sm text-neutral-900 focus:outline-none focus:border-neutral-900 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSavingConfig}
                className="w-full h-12 bg-neutral-950 text-white font-medium text-sm rounded-2xl flex items-center justify-center gap-2 transition-transform active:scale-[0.98] disabled:opacity-50 mt-2"
              >
                {isSavingConfig ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span>Guardar Cambios</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: REGISTRO DE RECAÍDA */}
      {showRelapseModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 space-y-5 animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold text-neutral-950">
                  Registrar tropiezo
                </h3>
                <p className="text-xs text-neutral-500 mt-1">
                  Un desliz no borra tu esfuerzo. Sé honesto contigo.
                </p>
              </div>
              <button
                onClick={() => setShowRelapseModal(false)}
                className="text-neutral-400 hover:text-neutral-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-neutral-700 text-xs">
                <AlertCircle className="w-4 h-4 text-neutral-500" />
                <span>Aporte acordado con tu amigo:</span>
              </div>
              <span className="text-sm font-semibold text-neutral-950">
                +{penaltyPerRelapse.toFixed(2)}€
              </span>
            </div>

            <form onSubmit={handleConfirmRelapse} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1.5">
                  ¿Qué causó las ganas? (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={relapseReason}
                  onChange={(e) => setRelapseReason(e.target.value)}
                  placeholder="Estrés, fiesta, hábito después de comer..."
                  className="w-full p-3 bg-white border border-neutral-200 rounded-2xl text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900 transition-colors resize-none"
                />
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingRelapse}
                  className="w-full h-12 bg-neutral-950 text-white font-medium text-sm rounded-2xl transition-transform active:scale-[0.98] disabled:opacity-50"
                >
                  {isSubmittingRelapse ? 'Actualizando...' : 'Confirmar y reiniciar racha'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRelapseModal(false)}
                  className="w-full h-10 text-neutral-500 font-medium text-xs hover:text-neutral-900"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BARRA DE NAVEGACIÓN INFERIOR */}
      <BottomNav currentTab="home" />
    </div>
  )
}
