'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Home,
  Users,
  Award,
  User,
  Sparkles,
  Lock,
  CheckCircle2,
  Clock,
  Flame,
  ShieldCheck,
  Moon,
  HeartPulse,
  PiggyBank,
  Droplets,
  Trophy,
  Share2,
  X,
  Target,
  Info,
  Check,
} from 'lucide-react'
import confetti from 'canvas-confetti'
import { supabase } from '@/lib/supabase/client'
import { Profile } from '@/types/database.types'
import BottomNav from '@/components/BottomNav'

export type BadgeCategory = 'all' | 'time' | 'behavior' | 'unlocked'

export interface EnhancedBadgeItem {
  id: string
  key: string
  title: string
  subtitle: string
  requirement: string
  clinicalReason: string
  rewardBenefit: string
  category: 'time' | 'behavior'
  rarity: 'Común' | 'Rara' | 'Épica' | 'Legendaria'
  icon: React.ComponentType<{ className?: string }>
  isUnlocked: boolean
  unlockedAt?: string
  progress?: {
    current: number
    target: number
    unit: string
  }
}

export default function AchievementsDashboard() {
  const router = useRouter()
  const [activeTab] = useState<'home' | 'friends' | 'badges' | 'profile'>('badges')
  const [selectedCategory, setSelectedCategory] = useState<BadgeCategory>('all')
  const [selectedBadge, setSelectedBadge] = useState<EnhancedBadgeItem | null>(null)

  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [waterCount, setWaterCount] = useState<number>(0)
  const [relapsesCount, setRelapsesCount] = useState<number>(0)

  // Modal de celebración interactivo
  const [showCelebrationModal, setShowCelebrationModal] = useState(false)
  const [isSimulatedUnlocked, setIsSimulatedUnlocked] = useState(false)
  const [copiedShare, setCopiedShare] = useState(false)

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
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
          if (userProfile.role === 'friend') {
            router.push('/dashboard/friends')
            return
          }

          setProfile(userProfile)

          const { count: relapses } = await supabase
            .from('relapses')
            .select('*', { count: 'exact', head: true })
            .eq('smoker_id', user.id)

          setRelapsesCount(relapses || 0)

          const { count: waters } = await supabase
            .from('plant_actions')
            .select('*', { count: 'exact', head: true })
            .eq('smoker_id', user.id)
            .eq('action_type', 'water')

          setWaterCount(waters || 0)
        }
      } catch (err) {
        console.error('Error loading achievements:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router])

  // Días reales sin fumar
  const realDaysClean = useMemo(() => {
    if (!profile?.smoke_free_since) return 0
    const diffMs = Math.max(0, Date.now() - new Date(profile.smoke_free_since).getTime())
    return Math.floor(diffMs / (1000 * 60 * 60 * 24))
  }, [profile])

  // Lista detallada de medallas con requisitos claros
  const badgesList: EnhancedBadgeItem[] = useMemo(() => {
    const days = isSimulatedUnlocked ? Math.max(30, realDaysClean) : realDaysClean

    return [
      // 1. Temporales
      {
        id: 'badge-1',
        key: 'first-24h',
        title: 'Primeras 24 Horas',
        subtitle: 'El umbral de la desintoxicación',
        requirement: 'Completar las primeras 24 horas sin encender ningún cigarrillo ni consumir nicotina.',
        clinicalReason: 'El nivel de monóxido de carbono en sangre se normaliza y el oxígeno celular alcanza niveles óptimos.',
        rewardBenefit: 'Nivel de oxígeno restaurado y pulso cardíaco estable',
        category: 'time',
        rarity: 'Común',
        icon: Clock,
        isUnlocked: days >= 1,
        unlockedAt: days >= 1 ? 'Conseguido' : undefined,
      },
      {
        id: 'badge-2',
        key: 'one-week-clean',
        title: '1 Semana Limpia',
        subtitle: 'Superación del síndrome agudo',
        requirement: 'Mantenerte 7 días consecutivos (168 horas) libre de humo.',
        clinicalReason: 'El cuerpo elimina la totalidad de la nicotina residual. Las terminaciones nerviosas del gusto y olfato comienzan a regenerarse.',
        rewardBenefit: 'Gusto y olfato agudizados (+45€ ahorrados)',
        category: 'time',
        rarity: 'Rara',
        icon: Flame,
        isUnlocked: days >= 7,
        unlockedAt: days >= 7 ? 'Conseguido' : undefined,
        progress: days < 7 ? { current: days, target: 7, unit: 'días' } : undefined,
      },
      {
        id: 'badge-3',
        key: 'one-month-pure',
        title: '1 Mes de Aire Puro',
        subtitle: 'Hito Mayor de Libertad',
        requirement: 'Superar los 30 días seguidos sin fumar.',
        clinicalReason: 'Los cilios bronquiales recuperan su movimiento limpiador, expulsando mucosidad y reduciendo drásticamente la tos y la fatiga.',
        rewardBenefit: 'Capacidad pulmonar +25% y ahorro consolidado',
        category: 'time',
        rarity: 'Épica',
        icon: Trophy,
        isUnlocked: days >= 30,
        unlockedAt: days >= 30 ? '¡Hito Conquistado!' : undefined,
        progress: days < 30 ? { current: days, target: 30, unit: 'días' } : undefined,
      },
      {
        id: 'badge-4',
        key: 'hundred-days',
        title: '100 Días de Acero',
        subtitle: 'Nueva identidad consolidada',
        requirement: 'Alcanzar 100 días consecutivos de constancia.',
        clinicalReason: 'La neuroadaptación a la dopamina se reequilibra por completo; el hábito de no fumar ya es tu nuevo estándar natural.',
        rewardBenefit: 'Riesgo cardiovascular disminuido en un 50%',
        category: 'time',
        rarity: 'Legendaria',
        icon: ShieldCheck,
        isUnlocked: days >= 100,
        unlockedAt: days >= 100 ? '¡Leyenda!' : undefined,
        progress: days < 100 ? { current: days, target: 100, unit: 'días' } : undefined,
      },

      // 2. Comportamiento
      {
        id: 'badge-5',
        key: 'party-night-survived',
        title: 'Noche de Fiesta',
        subtitle: 'Entorno social dominado',
        requirement: 'Salir de fiesta o reunión social con fumadores y mantener tu decisión intacta sin fumar.',
        clinicalReason: 'Desacopla el reflejo condicionado entre alcohol/ocio social y el tabaco, creando una nueva memoria de resistencia.',
        rewardBenefit: 'Refuerzo de la autoconfianza social',
        category: 'behavior',
        rarity: 'Rara',
        icon: Moon,
        isUnlocked: days >= 3,
        unlockedAt: days >= 3 ? 'Desbloqueada' : undefined,
      },
      {
        id: 'badge-6',
        key: 'sos-success',
        title: 'SOS con Éxito',
        subtitle: 'Ansiedad desactivada',
        requirement: 'Completar 1 minuto de respiración guiada durante un pico de ansiedad sin ceder a la recaída.',
        clinicalReason: 'La respiración profunda activa el sistema parasimpático y reduce el cortisol en menos de 90 segundos.',
        rewardBenefit: 'Dominio de la técnica de autorregulación',
        category: 'behavior',
        rarity: 'Común',
        icon: HeartPulse,
        isUnlocked: days >= 1,
        unlockedAt: days >= 1 ? 'Desbloqueada' : undefined,
      },
      {
        id: 'badge-7',
        key: 'intact-pot',
        title: 'Bote Intacto',
        subtitle: 'Compromiso impecable',
        requirement: 'Llegar a la primera semana o mes con 0€ aportados en penalizaciones por recaída.',
        clinicalReason: 'El compromiso financiero y la rendición de cuentas con amigos multiplican por 3 la adherencia.',
        rewardBenefit: 'Bote intacto y respeto de tu círculo',
        category: 'behavior',
        rarity: 'Rara',
        icon: PiggyBank,
        isUnlocked: relapsesCount === 0 && days >= 7,
        unlockedAt: relapsesCount === 0 && days >= 7 ? 'Impecable' : undefined,
      },
      {
        id: 'badge-8',
        key: 'friendship-guardian',
        title: 'Vínculo de Apoyo',
        subtitle: 'Fuerza compartida',
        requirement: 'Recibir más de 3 riegos de apoyo de tus guardianes y amigos.',
        clinicalReason: 'El apoyo emocional reduce el aislamiento y la vulnerabilidad psicológica.',
        rewardBenefit: 'Planta fortalecida y racha protegida',
        category: 'behavior',
        rarity: 'Rara',
        icon: Droplets,
        isUnlocked: waterCount >= 3,
        progress: waterCount < 3 ? { current: waterCount, target: 3, unit: 'riegos' } : undefined,
        unlockedAt: waterCount >= 3 ? 'Apoyo Activo' : undefined,
      },
    ]
  }, [realDaysClean, isSimulatedUnlocked, relapsesCount, waterCount])

  // Próximo gran hito
  const nextMilestone = useMemo(() => {
    const days = isSimulatedUnlocked ? 30 : realDaysClean
    if (days < 30) {
      return {
        title: '30 Días sin humo',
        target: 30,
        current: days,
        reward: 'Medalla 1 Mes 🏆',
        benefit: 'Alcanzarás el mes libre de tabaco: gran salto en capacidad pulmonar.',
      }
    } else if (days < 100) {
      return {
        title: '100 Días de acero',
        target: 100,
        current: days,
        reward: 'Insignia Centenaria 🛡️',
        benefit: 'Consolidación total del nuevo estilo de vida.',
      }
    } else {
      return {
        title: '1 Año de Libertad',
        target: 365,
        current: days,
        reward: 'Corona de Oro 👑',
        benefit: 'El riesgo coronario se reduce a la mitad.',
      }
    }
  }, [realDaysClean, isSimulatedUnlocked])

  const progressPercent = Math.min(
    100,
    Math.round((nextMilestone.current / nextMilestone.target) * 100)
  )
  const daysRemaining = Math.max(0, nextMilestone.target - nextMilestone.current)

  // Disparar confeti vistoso multicapa
  const triggerGrandConfetti = () => {
    try {
      // Cañón central
      confetti({
        particleCount: 80,
        spread: 90,
        origin: { y: 0.6 },
        colors: ['#10B981', '#34D399', '#F59E0B', '#0EA5E9', '#A855F7'],
        disableForReducedMotion: true,
      })

      // Cañón izquierdo
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 60,
          origin: { x: 0.1, y: 0.65 },
          colors: ['#10B981', '#38BDF8', '#FBBF24'],
        })
      }, 150)

      // Cañón derecho
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 60,
          origin: { x: 0.9, y: 0.65 },
          colors: ['#059669', '#6366F1', '#F59E0B'],
        })
      }, 300)
    } catch {}
  }

  const handleSimulateMilestone = () => {
    setIsSimulatedUnlocked(true)
    setShowCelebrationModal(true)
    triggerGrandConfetti()
  }

  const filteredBadges = badgesList.filter((badge) => {
    if (selectedCategory === 'all') return true
    if (selectedCategory === 'unlocked') return badge.isUnlocked
    if (selectedCategory === 'time') return badge.category === 'time'
    if (selectedCategory === 'behavior') return badge.category === 'behavior'
    return true
  })

  const unlockedCount = badgesList.filter((b) => b.isUnlocked).length

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: '¡Hito desbloqueado en Exhala!',
        text: `¡Llevo ${realDaysClean} días libre de humo con la app Exhala! 🌿🏆`,
        url: window.location.origin,
      }).catch(() => {})
    } else {
      setCopiedShare(true)
      setTimeout(() => setCopiedShare(false), 2500)
    }
  }

  const getRarityBadge = (rarity: EnhancedBadgeItem['rarity']) => {
    switch (rarity) {
      case 'Legendaria':
        return 'bg-amber-100 text-amber-900 border-amber-300'
      case 'Épica':
        return 'bg-purple-100 text-purple-900 border-purple-300'
      case 'Rara':
        return 'bg-sky-100 text-sky-900 border-sky-300'
      default:
        return 'bg-neutral-100 text-neutral-800 border-neutral-200'
    }
  }

  if (loading) {
    return (
      <div className="min-h-[100dvh] w-full bg-[#F8FAF9] flex flex-col items-center justify-center max-w-md mx-auto p-6 space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-neutral-900 flex items-center justify-center animate-pulse">
          <Award className="w-6 h-6 text-white" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
          Cargando tus logros...
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] w-full bg-[#F8FAF9] text-neutral-900 flex flex-col justify-between max-w-md mx-auto relative antialiased select-none pb-24">
      {/* HEADER SUPERIOR */}
      <header className="pt-6 px-6 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
            Gamificación & Hitos
          </span>
          <h1 className="text-xl font-medium tracking-tight text-neutral-950">
            Insignias y Logros
          </h1>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 bg-white border border-neutral-200 rounded-full shadow-xs">
          <Award className="w-3.5 h-3.5 text-neutral-900" />
          <span className="text-xs font-semibold text-neutral-800">
            {unlockedCount} / {badgesList.length}
          </span>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 flex flex-col px-6 py-4 space-y-6">
        
        {/* 1. SECCIÓN DESTACADA: PRÓXIMO GRAN HITO */}
        <section className="bg-neutral-950 text-white rounded-3xl p-5 relative overflow-hidden shadow-sm">
          <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -left-6 -top-6 w-24 h-24 bg-white/5 rounded-full blur-xl pointer-events-none" />

          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-[10px] uppercase tracking-wider font-semibold text-emerald-400">
                Próximo Gran Hito
              </span>
              <span className="text-xs text-neutral-400 font-mono">
                {daysRemaining === 0 ? '¡Completado!' : `${daysRemaining} días restantes`}
              </span>
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-1">
                <h2 className="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
                  {nextMilestone.title}
                  {daysRemaining === 0 && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 inline" />
                  )}
                </h2>
                <span className="text-xs text-neutral-300 font-medium">
                  {nextMilestone.current} / {nextMilestone.target} d
                </span>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                {nextMilestone.benefit}
              </p>
            </div>

            {/* Barra de progreso */}
            <div className="space-y-1.5">
              <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[11px] text-neutral-400 font-medium">
                <span>{progressPercent}% completado</span>
                <span>Premio: {nextMilestone.reward}</span>
              </div>
            </div>

            {/* Botón interactivo de prueba */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleSimulateMilestone}
                className="w-full h-11 bg-white text-neutral-950 hover:bg-neutral-100 font-medium text-xs rounded-2xl flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
              >
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>
                  {isSimulatedUnlocked ? 'Revivir Celebración del Hito 🎉' : 'Simular Hito (Test Gran Confeti & Modal)'}
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* 2. FILTROS DE CATEGORÍAS */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
              Colección de Medallas
            </span>
            <span className="text-xs text-neutral-400 font-normal">
              Toca para ver requisitos
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {[
              { id: 'all', label: 'Todas' },
              { id: 'time', label: 'Temporales' },
              { id: 'behavior', label: 'Comportamiento' },
              { id: 'unlocked', label: 'Desbloqueadas' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id as BadgeCategory)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-neutral-950 text-white shadow-xs'
                    : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </section>

        {/* 3. SISTEMA DE MEDALLAS / INSIGNIAS: GRID 2 COLUMNAS */}
        <section className="grid grid-cols-2 gap-3">
          {filteredBadges.map((badge) => {
            const isUnlocked = badge.isUnlocked
            const IconComp = badge.icon

            return (
              <button
                key={badge.id}
                type="button"
                onClick={() => setSelectedBadge(badge)}
                className={`group text-left p-4 rounded-3xl border transition-all duration-200 relative flex flex-col justify-between min-h-[175px] active:scale-[0.98] ${
                  isUnlocked
                    ? 'bg-white border-neutral-200 shadow-xs hover:border-neutral-300'
                    : 'bg-neutral-50/80 border-neutral-200/60 hover:border-neutral-300 opacity-75'
                }`}
              >
                {/* Cabecera de la tarjeta: Icono y Badge de Rareza */}
                <div className="flex items-start justify-between w-full">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105 ${
                      isUnlocked
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                        : 'bg-neutral-100 text-neutral-400 border border-neutral-200/50'
                    }`}
                  >
                    <IconComp className="w-5 h-5" />
                  </div>

                  <span
                    className={`text-[9px] font-semibold px-2 py-0.5 rounded-md border ${getRarityBadge(
                      badge.rarity
                    )}`}
                  >
                    {badge.rarity}
                  </span>
                </div>

                {/* Info de la medalla */}
                <div className="mt-3 w-full">
                  <h3
                    className={`text-sm font-semibold tracking-tight line-clamp-1 ${
                      isUnlocked ? 'text-neutral-950' : 'text-neutral-600'
                    }`}
                  >
                    {badge.title}
                  </h3>
                  <p className="text-[11px] text-neutral-500 line-clamp-1 mt-0.5">
                    {badge.subtitle}
                  </p>

                  {/* Estado / Progreso */}
                  <div className="mt-2.5 pt-2 border-t border-neutral-100 flex items-center justify-between text-[10px]">
                    {isUnlocked ? (
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <Check className="w-3 h-3 stroke-[3]" />
                        {badge.unlockedAt || 'Desbloqueada'}
                      </span>
                    ) : badge.progress ? (
                      <div className="w-full">
                        <div className="flex justify-between text-neutral-400 font-medium mb-1">
                          <span>Progreso</span>
                          <span>
                            {badge.progress.current}/{badge.progress.target} {badge.progress.unit}
                          </span>
                        </div>
                        <div className="w-full h-1 bg-neutral-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-neutral-400 rounded-full"
                            style={{
                              width: `${Math.min(100, (badge.progress.current / badge.progress.target) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-neutral-400 font-medium flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Bloqueada
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </section>
      </main>

      {/* MODAL 1: CELEBRACIÓN CONMEMORATIVA CON GRAN CONFETI */}
      {showCelebrationModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-5 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 text-center space-y-5 relative shadow-xl animate-in zoom-in-95 duration-300">
            <button
              type="button"
              onClick={() => setShowCelebrationModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 hover:text-neutral-900"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="pt-2 flex justify-center">
              <div className="relative">
                <div
                  className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-lg shadow-emerald-600/20 transform rotate-3 animate-bounce"
                  style={{ animationDuration: '2s' }}
                >
                  <Trophy className="w-12 h-12" />
                </div>
                <div className="absolute -bottom-2 -right-2 bg-neutral-950 text-white p-1.5 rounded-full border-2 border-white shadow-sm">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
                ¡Hito Conquistado!
              </span>
              <h3 className="text-2xl font-bold tracking-tight text-neutral-950 pt-1">
                {nextMilestone.title}
              </h3>
              <p className="text-xs text-neutral-500 leading-relaxed max-w-xs mx-auto">
                Has alcanzado tu meta libre de tabaco. Tu organismo y tus pulmones te lo agradecen.
              </p>
            </div>

            <div className="bg-neutral-50 border border-neutral-100 rounded-2xl p-3.5 grid grid-cols-2 gap-2 text-left">
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-semibold text-neutral-400">Racha lograda</span>
                <p className="text-sm font-semibold text-neutral-950">{nextMilestone.target} Días</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-semibold text-neutral-400">Capacidad pulmonar</span>
                <p className="text-sm font-semibold text-emerald-700">+25% Mejorada</p>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleShare}
                className="w-full h-12 bg-neutral-950 text-white font-medium text-sm rounded-2xl flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
              >
                <Share2 className="w-4 h-4 text-neutral-300" />
                <span>{copiedShare ? '¡Enlace copiado!' : 'Compartir con mis amigos'}</span>
              </button>

              <button
                type="button"
                onClick={triggerGrandConfetti}
                className="w-full h-10 bg-neutral-100 text-neutral-700 hover:text-neutral-950 font-medium text-xs rounded-2xl flex items-center justify-center gap-1.5 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>¡Lanzar más confeti!</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: DETALLE COMPLETO DE MEDALLA (REQUISITOS & BENEFICIOS) */}
      {selectedBadge && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 space-y-4 animate-in slide-in-from-bottom duration-300">
            {/* Header del modal */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                    selectedBadge.isUnlocked
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                      : 'bg-neutral-100 text-neutral-400'
                  }`}
                >
                  <selectedBadge.icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-neutral-950">
                    {selectedBadge.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={`text-[9px] font-semibold px-2 py-0.5 rounded-md border ${getRarityBadge(
                        selectedBadge.rarity
                      )}`}
                    >
                      {selectedBadge.rarity}
                    </span>
                    <span className="text-xs text-neutral-400 font-medium">
                      {selectedBadge.category === 'time' ? 'Hito Temporal' : 'Hito de Hábito'}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedBadge(null)}
                className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 hover:text-neutral-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 1. Requisito exacto */}
            <div className="bg-neutral-50 border border-neutral-200/80 rounded-2xl p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-neutral-700 font-semibold text-xs">
                <Target className="w-3.5 h-3.5 text-emerald-600" />
                <span>¿Cómo conseguirla? (Requisito)</span>
              </div>
              <p className="text-xs text-neutral-600 leading-relaxed">
                {selectedBadge.requirement}
              </p>
            </div>

            {/* 2. Por qué importa clínicamente */}
            <div className="bg-sky-50/60 border border-sky-200/70 rounded-2xl p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-sky-900 font-semibold text-xs">
                <Info className="w-3.5 h-3.5 text-sky-600" />
                <span>Beneficio para tu salud</span>
              </div>
              <p className="text-xs text-sky-800 leading-relaxed">
                {selectedBadge.clinicalReason}
              </p>
            </div>

            {/* Estado actual */}
            <div className="flex items-center justify-between py-2 border-t border-neutral-100 text-xs">
              <span className="text-neutral-400">Estado</span>
              {selectedBadge.isUnlocked ? (
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {selectedBadge.unlockedAt || 'Desbloqueada'}
                </span>
              ) : selectedBadge.progress ? (
                <span className="text-neutral-600 font-medium">
                  En progreso ({selectedBadge.progress.current}/{selectedBadge.progress.target} {selectedBadge.progress.unit})
                </span>
              ) : (
                <span className="text-neutral-500 font-medium flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Bloqueada
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSelectedBadge(null)}
              className="w-full h-11 bg-neutral-950 text-white font-medium text-xs rounded-2xl transition-transform active:scale-[0.98]"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* 4. BARRA DE NAVEGACIÓN INFERIOR */}
      <BottomNav currentTab="badges" />
    </div>
  )
}
