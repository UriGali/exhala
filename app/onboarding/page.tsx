'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  Sprout,
  TreePine,
  Leaf,
  Flower2,
  Cigarette,
  Flame,
  Zap,
  HeartPulse,
  PiggyBank,
  Users,
  TrendingUp,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  Copy,
  CheckCheck,
  Calendar,
  Trophy,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react'
import confetti from 'canvas-confetti'
import { supabase } from '@/lib/supabase/client'

// Tipos de datos del Onboarding
export type PlantArchetype = 'monstera' | 'olivo' | 'lavanda' | 'aloe' | 'pino' | 'poto'
export type HabitFormat = 'traditional' | 'rolling' | 'vape' | 'weed'
export type MotivationType = 'health' | 'money' | 'family' | 'sport' | 'aesthetic'

interface PlantOption {
  id: PlantArchetype
  name: string
  subtitle: string
  description: string
  tag: string
}

const PLANT_OPTIONS: PlantOption[] = [
  {
    id: 'monstera',
    name: 'Monstera Luminosa',
    subtitle: 'Crecimiento & Expansión',
    description: 'Hojas amplias que buscan la luz y purifican el ambiente con cada respiración.',
    tag: 'Purificación activa',
  },
  {
    id: 'olivo',
    name: 'Olivo de la Paz',
    subtitle: 'Resiliencia & Longevidad',
    description: 'Símbolo milenario de serenidad, raíces profundas y fortaleza que nunca se quiebra.',
    tag: 'Fuerza interior',
  },
  {
    id: 'lavanda',
    name: 'Lavanda Silvestre',
    subtitle: 'Calma & Claridad Mental',
    description: 'Aroma relajante y flores aromáticas que sosiegan el sistema nervioso ante cualquier impulso.',
    tag: 'Anti-ansiedad',
  },
  {
    id: 'aloe',
    name: 'Aloe Vital',
    subtitle: 'Sanación Profunda',
    description: 'Poder regenerativo natural que restaura y limpia las vías respiratorias día a día.',
    tag: 'Regeneración celular',
  },
  {
    id: 'pino',
    name: 'Pino de Montaña',
    subtitle: 'Firmeza & Aire Puro',
    description: 'Perenne, robusto y majestuoso. Evoca la frescura inigualable del bosque alpino.',
    tag: 'Oxígeno puro',
  },
  {
    id: 'poto',
    name: 'Poto de Verano',
    subtitle: 'Adaptabilidad Constante',
    description: 'Follaje colgante verde dorado que prospera y se multiplica con tu constancia.',
    tag: 'Progreso diario',
  },
]

// Ilustración artística SVG de la planta seleccionada
function PlantHeroIllustration({ plantId }: { plantId: PlantArchetype }) {
  switch (plantId) {
    case 'monstera':
      return (
        <svg viewBox="0 0 160 160" className="w-24 h-24 drop-shadow-sm" fill="none">
          <circle cx="80" cy="80" r="72" fill="#ECFDF5" />
          <path d="M80 135 C 80 100, 78 70, 80 35" stroke="#047857" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M80 55 C 60 40, 45 60, 52 75 C 60 90, 75 75, 80 55 Z" fill="#10B981" stroke="#047857" strokeWidth="1.5" />
          <path d="M80 75 C 105 60, 118 75, 112 92 C 104 105, 88 92, 80 75 Z" fill="#34D399" stroke="#047857" strokeWidth="1.5" />
          <path d="M80 40 C 70 25, 90 25, 80 40 Z" fill="#6EE7B7" stroke="#047857" strokeWidth="1.5" />
          <ellipse cx="80" cy="138" rx="20" ry="6" fill="#064E3B" opacity="0.8" />
        </svg>
      )
    case 'olivo':
      return (
        <svg viewBox="0 0 160 160" className="w-24 h-24 drop-shadow-sm" fill="none">
          <circle cx="80" cy="80" r="72" fill="#F7FEE7" />
          <path d="M80 135 C 80 95, 85 75, 80 35" stroke="#4D7C0F" strokeWidth="3" strokeLinecap="round" />
          <ellipse cx="62" cy="65" rx="14" ry="7" transform="rotate(-30 62 65)" fill="#65A30D" stroke="#365314" strokeWidth="1.2" />
          <ellipse cx="98" cy="72" rx="14" ry="7" transform="rotate(30 98 72)" fill="#84CC16" stroke="#365314" strokeWidth="1.2" />
          <ellipse cx="68" cy="95" rx="12" ry="6" transform="rotate(-20 68 95)" fill="#A3E635" stroke="#365314" strokeWidth="1.2" />
          <circle cx="95" cy="88" r="5" fill="#3F6212" />
          <ellipse cx="80" cy="138" rx="20" ry="6" fill="#1C1917" opacity="0.8" />
        </svg>
      )
    case 'lavanda':
      return (
        <svg viewBox="0 0 160 160" className="w-24 h-24 drop-shadow-sm" fill="none">
          <circle cx="80" cy="80" r="72" fill="#FAF5FF" />
          <path d="M80 135 L 80 45" stroke="#7E22CE" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M70 135 C 72 105, 68 75, 65 55" stroke="#9333EA" strokeWidth="2" strokeLinecap="round" />
          <path d="M90 135 C 88 105, 92 75, 95 55" stroke="#9333EA" strokeWidth="2" strokeLinecap="round" />
          <ellipse cx="80" cy="40" rx="6" ry="12" fill="#A855F7" />
          <ellipse cx="80" cy="55" rx="7" ry="10" fill="#C084FC" />
          <ellipse cx="65" cy="50" rx="5" ry="9" fill="#A855F7" />
          <ellipse cx="95" cy="50" rx="5" ry="9" fill="#A855F7" />
          <ellipse cx="80" cy="138" rx="22" ry="6" fill="#1E1B4B" opacity="0.8" />
        </svg>
      )
    case 'aloe':
      return (
        <svg viewBox="0 0 160 160" className="w-24 h-24 drop-shadow-sm" fill="none">
          <circle cx="80" cy="80" r="72" fill="#F0FDFA" />
          <path d="M80 135 C 80 90, 80 50, 80 30 C 80 50, 82 90, 80 135 Z" fill="#0D9488" stroke="#115E59" strokeWidth="1.5" />
          <path d="M80 135 C 75 95, 50 75, 45 55 C 58 75, 75 105, 80 135 Z" fill="#14B8A6" stroke="#115E59" strokeWidth="1.5" />
          <path d="M80 135 C 85 95, 110 75, 115 55 C 102 75, 85 105, 80 135 Z" fill="#2DD4BF" stroke="#115E59" strokeWidth="1.5" />
          <ellipse cx="80" cy="138" rx="20" ry="6" fill="#134E4A" opacity="0.8" />
        </svg>
      )
    case 'pino':
      return (
        <svg viewBox="0 0 160 160" className="w-24 h-24 drop-shadow-sm" fill="none">
          <circle cx="80" cy="80" r="72" fill="#F0F9FF" />
          <path d="M80 135 L 80 105" stroke="#78350F" strokeWidth="5" strokeLinecap="round" />
          <polygon points="80,25 50,70 110,70" fill="#0369A1" />
          <polygon points="80,50 45,95 115,95" fill="#0284C7" />
          <polygon points="80,75 40,115 120,115" fill="#38BDF8" />
          <ellipse cx="80" cy="138" rx="22" ry="6" fill="#082F49" opacity="0.8" />
        </svg>
      )
    case 'poto':
      return (
        <svg viewBox="0 0 160 160" className="w-24 h-24 drop-shadow-sm" fill="none">
          <circle cx="80" cy="80" r="72" fill="#FFFBEB" />
          <path d="M80 60 C 80 90, 75 115, 60 130" stroke="#B45309" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M80 60 C 80 90, 85 115, 100 130" stroke="#B45309" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M60 90 C 45 80, 50 65, 65 72 C 75 80, 68 95, 60 90 Z" fill="#D97706" stroke="#92400E" strokeWidth="1.2" />
          <path d="M100 95 C 115 85, 110 70, 95 77 C 85 85, 92 100, 100 95 Z" fill="#F59E0B" stroke="#92400E" strokeWidth="1.2" />
          <path d="M60 130 C 50 120, 52 108, 62 112 Z" fill="#FBBF24" />
          <path d="M100 130 C 110 120, 108 108, 98 112 Z" fill="#FBBF24" />
          <rect x="65" y="45" width="30" height="20" rx="6" fill="#78350F" />
        </svg>
      )
  }
}

// Opciones de Formato de Hábito
interface HabitMeta {
  id: HabitFormat
  label: string
  icon: React.ComponentType<{ className?: string }>
  unitsTitle: string
  unitsUnit: string
  defaultUnits: number
  unitsMax: number
  priceTitle: string
  priceSubtitle: string
  defaultPrice: number
  unitsPerPack: number // unidades por paquete para calcular coste por unidad
}

const HABIT_DEFINITIONS: Record<HabitFormat, HabitMeta> = {
  traditional: {
    id: 'traditional',
    label: 'Cigarrillos',
    icon: Cigarette,
    unitsTitle: 'Cigarrillos al día',
    unitsUnit: 'cigs/día',
    defaultUnits: 15,
    unitsMax: 40,
    priceTitle: 'Precio por cajetilla',
    priceSubtitle: 'Cajetilla de 20 uds.',
    defaultPrice: 5.5,
    unitsPerPack: 20,
  },
  rolling: {
    id: 'rolling',
    label: 'Tabaco de Liar',
    icon: Flame,
    unitsTitle: 'Cigarrillos liados al día',
    unitsUnit: 'cigs/día',
    defaultUnits: 12,
    unitsMax: 40,
    priceTitle: 'Precio por bolsa/paquete',
    priceSubtitle: 'Bolsa de picadura (~40 uds.)',
    defaultPrice: 6.0,
    unitsPerPack: 40,
  },
  vape: {
    id: 'vape',
    label: 'Vape / IQOS',
    icon: Zap,
    unitsTitle: 'Recargas o pods al día',
    unitsUnit: 'pods o cajetillas/día',
    defaultUnits: 1,
    unitsMax: 10,
    priceTitle: 'Precio por pod / recarga',
    priceSubtitle: 'Coste por pod o paquete de heets',
    defaultPrice: 5.0,
    unitsPerPack: 1,
  },
  weed: {
    id: 'weed',
    label: 'Marihuana / Porros',
    icon: Sprout,
    unitsTitle: 'Porros o dosis al día',
    unitsUnit: 'porros/día',
    defaultUnits: 2,
    unitsMax: 20,
    priceTitle: 'Coste estimado por porro / gramo',
    priceSubtitle: 'Gasto por porro o consumo diario',
    defaultPrice: 5.0,
    unitsPerPack: 1,
  },
}

const MOTIVATION_OPTIONS: { id: MotivationType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'health', label: 'Salud y Pulmones', icon: HeartPulse },
  { id: 'money', label: 'Ahorro Financiero', icon: PiggyBank },
  { id: 'family', label: 'Familia & Pareja', icon: Users },
  { id: 'sport', label: 'Rendimiento Físico', icon: TrendingUp },
  { id: 'aesthetic', label: 'Dientes, Piel y Olor', icon: Sparkles },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<number>(1)
  const totalSteps = 5

  // Estado del usuario autenticado
  const [userId, setUserId] = useState<string | null>(null)
  const [loadingUser, setLoadingUser] = useState<boolean>(true)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  // PASO 1: Identidad & Semilla
  const [fullName, setFullName] = useState<string>('')
  const [selectedPlant, setSelectedPlant] = useState<PlantArchetype>('monstera')

  // PASO 2: Radiografía de tus Hábitos (Multiselección & Duplicación Dinámica)
  const [selectedHabits, setSelectedHabits] = useState<HabitFormat[]>(['traditional'])
  const [habitValues, setHabitValues] = useState<Record<HabitFormat, { units: number; price: number }>>({
    traditional: { units: 15, price: 5.5 },
    rolling: { units: 12, price: 6.0 },
    vape: { units: 1, price: 5.0 },
    weed: { units: 2, price: 5.0 },
  })
  const [smokeFreeDate, setSmokeFreeDate] = useState<string>('')

  // PASO 3: Motivación & Sueño de Ahorro
  const [selectedMotivations, setSelectedMotivations] = useState<MotivationType[]>(['health', 'money'])
  const [savingsGoal, setSavingsGoal] = useState<string>('Viaje soñado')

  // PASO 4: Pacto Social & Multas
  const [penaltyAmount, setPenaltyAmount] = useState<number>(1.0)
  const [squadCode, setSquadCode] = useState<string>('')
  const [copiedCode, setCopiedCode] = useState<boolean>(false)

  // Inicializar usuario y fecha
  useEffect(() => {
    async function initUser() {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) {
          router.push('/')
          return
        }
        setUserId(user.id)

        // Generar código aleatorio de squad
        const randomCode = 'EXHALA-' + Math.random().toString(36).substring(2, 7).toUpperCase()
        setSquadCode(randomCode)

        // Fecha actual por defecto en formato YYYY-MM-DD
        const todayIso = new Date().toISOString().slice(0, 10)
        setSmokeFreeDate(todayIso)

        // Comprobar si ya tiene datos en profiles
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, smoke_free_since, cigs_per_day, pack_price, penalty_amount')
          .eq('id', user.id)
          .maybeSingle()

        if (profile) {
          if (profile.full_name) setFullName(profile.full_name)
          if (profile.penalty_amount) setPenaltyAmount(Number(profile.penalty_amount))
          if (profile.smoke_free_since) {
            setSmokeFreeDate(profile.smoke_free_since.slice(0, 10))
          }
          if (profile.cigs_per_day) {
            setHabitValues((prev) => ({
              ...prev,
              traditional: {
                units: profile.cigs_per_day,
                price: Number(profile.pack_price) || 5.5,
              },
            }))
          }
        }
      } catch (err) {
        console.error('Error initializing onboarding:', err)
      } finally {
        setLoadingUser(false)
      }
    }

    initUser()
  }, [router])

  // Manejo de multiselección de hábitos
  const toggleHabit = (habitId: HabitFormat) => {
    setSelectedHabits((prev) => {
      if (prev.includes(habitId)) {
        if (prev.length === 1) return prev // Mantener al menos 1 seleccionado
        return prev.filter((h) => h !== habitId)
      } else {
        return [...prev, habitId]
      }
    })
  }

  const updateHabitUnits = (habitId: HabitFormat, units: number) => {
    setHabitValues((prev) => ({
      ...prev,
      [habitId]: { ...prev[habitId], units },
    }))
  }

  const updateHabitPrice = (habitId: HabitFormat, price: number) => {
    setHabitValues((prev) => ({
      ...prev,
      [habitId]: { ...prev[habitId], price },
    }))
  }

  // Cálculos consolidados de todos los hábitos activos
  const totals = useMemo(() => {
    let dailyCost = 0
    let dailyUnits = 0

    selectedHabits.forEach((habitId) => {
      const def = HABIT_DEFINITIONS[habitId]
      const val = habitValues[habitId]
      const costPerUnit = val.price / def.unitsPerPack
      dailyCost += val.units * costPerUnit
      dailyUnits += val.units
    })

    const yearlySavings = Number((dailyCost * 365).toFixed(2))
    const yearlyUnits = dailyUnits * 365
    // Cada unidad evitada ahorra aprox. 11 minutos de vida
    const daysOfLifeGained = Math.round((yearlyUnits * 11) / (60 * 24))

    return {
      dailyCost,
      dailyUnits,
      yearlySavings,
      yearlyUnits,
      daysOfLifeGained,
    }
  }, [selectedHabits, habitValues])

  // Toggle de motivaciones
  const toggleMotivation = (id: MotivationType) => {
    setSelectedMotivations((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    )
  }

  // Copiar código de amigo
  const handleCopySquadCode = () => {
    navigator.clipboard.writeText(squadCode)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  // Validaciones para avanzar paso
  const canAdvance = () => {
    if (currentStep === 1) {
      return fullName.trim().length > 0 && Boolean(selectedPlant)
    }
    if (currentStep === 2) {
      return selectedHabits.length > 0 && smokeFreeDate.length > 0
    }
    if (currentStep === 3) {
      return selectedMotivations.length > 0
    }
    if (currentStep === 4) {
      return penaltyAmount > 0
    }
    return true
  }

  // Siguiente paso
  const handleNextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep((prev) => prev + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Paso anterior
  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Finalizar Onboarding y Guardar en Supabase
  const handleCompleteOnboarding = async () => {
    if (!userId) return
    setIsSubmitting(true)

    try {
      try {
        confetti({
          particleCount: 80,
          spread: 75,
          origin: { y: 0.6 },
          colors: ['#10B981', '#0EA5E9', '#F59E0B', '#A855F7', '#14B8A6'],
        })
      } catch {}

      // Convertir la fecha seleccionada a ISO timestamp
      const dateIso = smokeFreeDate
        ? new Date(smokeFreeDate + 'T00:00:00').toISOString()
        : new Date().toISOString()

      // Calcular precio ponderado por paquete de 20 uds equivalente para cálculos consistentes
      const effectiveCigsPerDay = Math.max(1, totals.dailyUnits)
      const effectivePackPrice = totals.dailyUnits > 0
        ? Number(((totals.dailyCost / totals.dailyUnits) * 20).toFixed(2))
        : 5.5

      // Guardar en la tabla profiles
      const profilePayload = {
        id: userId,
        role: 'smoker' as const,
        full_name: fullName.trim() || 'Compañero',
        smoke_free_since: dateIso,
        cigs_per_day: effectiveCigsPerDay,
        pack_price: effectivePackPrice,
        penalty_amount: Number(penaltyAmount) || 1.0,
        updated_at: new Date().toISOString(),
      }

      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert(profilePayload)

      if (upsertError) throw upsertError

      setTimeout(() => {
        router.push('/dashboard/smoker')
      }, 1200)
    } catch (err: any) {
      console.error('Error completing onboarding:', err)
      alert('Error al guardar tu perfil. Inténtalo de nuevo.')
      setIsSubmitting(false)
    }
  }

  const currentPlantData = PLANT_OPTIONS.find((p) => p.id === selectedPlant) || PLANT_OPTIONS[0]

  if (loadingUser) {
    return (
      <div className="min-h-[100dvh] w-full bg-[#F8FAF9] text-neutral-800 flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-white border border-neutral-200 shadow-sm flex items-center justify-center animate-pulse">
          <Sprout className="w-6 h-6 text-emerald-600" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
          Preparando tu espacio...
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] w-full bg-[#F8FAF9] text-neutral-900 flex flex-col justify-between max-w-md mx-auto relative antialiased select-none px-6 py-6 sm:py-8 overflow-x-hidden">
      
      {/* HALOS AMBIENTALES LUMINOSOS Y CALMANTES */}
      <div className="fixed top-8 -left-20 w-80 h-80 bg-emerald-100/60 rounded-full blur-[100px] pointer-events-none" />
      <div className="fixed top-1/3 -right-20 w-80 h-80 bg-sky-100/50 rounded-full blur-[100px] pointer-events-none" />
      <div className="fixed bottom-12 left-1/2 -translate-x-1/2 w-96 h-96 bg-teal-50/70 rounded-full blur-[120px] pointer-events-none" />

      {/* HEADER SUPERIOR: LOGO & BARRA DE PROGRESO */}
      <header className="relative z-10 space-y-3">
        <div className="flex items-center justify-between">
          <div className="relative w-28 h-8">
            <Image
              src="/logo-wordmark.png"
              alt="Exhala"
              fill
              sizes="112px"
              className="object-contain object-left"
            />
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 bg-white border border-neutral-200/80 rounded-full shadow-xs">
            <span className="text-[11px] font-medium text-neutral-400">Paso</span>
            <span className="text-xs font-semibold text-emerald-700">{currentStep}</span>
            <span className="text-[11px] font-medium text-neutral-400">/ {totalSteps}</span>
          </div>
        </div>

        {/* Barra de progreso luminosa */}
        <div className="w-full h-1.5 bg-neutral-200/70 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>
      </header>

      {/* CONTENEDOR PRINCIPAL: WIZARD DE PASOS */}
      <main className="relative z-10 flex-1 my-5 flex flex-col justify-center">

        {/* ======================================================== */}
        {/* PASO 1: IDENTIDAD & CATÁLOGO DE 6 PLANTAS */}
        {/* ======================================================== */}
        {currentStep === 1 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full">
                Tu Comienzo
              </span>
              <h2 className="text-2xl font-semibold tracking-tight text-neutral-950 mt-1.5">
                Siembra tu nueva vida
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">
                Elige la planta compañera que florecerá con cada respiración pura.
              </p>
            </div>

            {/* Input Nombre Limpio */}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-neutral-600">
                Tu nombre
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Tu nombre o apodo"
                className="w-full h-12 px-4 bg-white border border-neutral-200 focus:border-neutral-900 rounded-2xl text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none transition-colors shadow-xs"
              />
            </div>

            {/* Tarjeta de Previsualización Hero */}
            <div className="bg-white border border-neutral-200/80 rounded-3xl p-4 shadow-xs flex items-center gap-4 relative overflow-hidden">
              <div className="relative shrink-0 flex items-center justify-center">
                <PlantHeroIllustration plantId={selectedPlant} />
              </div>

              <div className="flex-1 pr-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-neutral-950">
                    {currentPlantData.name}
                  </h3>
                </div>
                <span className="inline-block text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md mt-0.5">
                  {currentPlantData.tag}
                </span>
                <p className="text-[11px] text-neutral-500 mt-1 leading-snug">
                  {currentPlantData.description}
                </p>
              </div>
            </div>

            {/* Catálogo de 6 Plantas (Grid 2 Columnas) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-neutral-600">
                Selecciona tu especie guía
              </label>

              <div className="grid grid-cols-2 gap-2">
                {PLANT_OPTIONS.map((plant) => {
                  const isSelected = selectedPlant === plant.id
                  return (
                    <button
                      key={plant.id}
                      type="button"
                      onClick={() => setSelectedPlant(plant.id)}
                      className={`text-left p-3 rounded-2xl border transition-all duration-200 flex flex-col justify-between min-h-[92px] relative active:scale-[0.98] ${
                        isSelected
                          ? 'bg-white border-neutral-950 shadow-sm ring-1 ring-neutral-950'
                          : 'bg-white/80 border-neutral-200/70 hover:border-neutral-300 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between w-full">
                        <span className="text-xs font-semibold text-neutral-950 line-clamp-1">
                          {plant.name}
                        </span>
                        {isSelected ? (
                          <div className="w-4 h-4 rounded-full bg-neutral-950 text-white flex items-center justify-center shrink-0 ml-1">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-neutral-300 shrink-0 ml-1" />
                        )}
                      </div>

                      <div className="mt-2">
                        <span className="text-[10px] text-emerald-800 font-medium block line-clamp-1">
                          {plant.subtitle}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* PASO 2: RADIOGRAFÍA DE HÁBITOS (MULTISELECCIÓN + DUPLICACIÓN) */}
        {/* ======================================================== */}
        {currentStep === 2 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full">
                Hábitos & Consumo
              </span>
              <h2 className="text-2xl font-semibold tracking-tight text-neutral-950 mt-1.5">
                ¿Qué formato consumes?
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">
                Selecciona uno o varios. Adaptaremos los cálculos a tu consumo combinado.
              </p>
            </div>

            {/* 1. Selector Multiselección de Hábitos (4 opciones en Grid 2x2) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-neutral-600">
                Formatos habituales (Selección múltiple)
              </label>

              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(HABIT_DEFINITIONS) as HabitFormat[]).map((key) => {
                  const item = HABIT_DEFINITIONS[key]
                  const Icon = item.icon
                  const isSelected = selectedHabits.includes(key)

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleHabit(key)}
                      className={`p-3 rounded-2xl border text-left flex items-center justify-between transition-all active:scale-[0.98] ${
                        isSelected
                          ? 'bg-white border-neutral-950 text-neutral-950 font-semibold shadow-xs ring-1 ring-neutral-950'
                          : 'bg-white/80 border-neutral-200 text-neutral-600 hover:bg-white hover:border-neutral-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                            isSelected ? 'bg-neutral-950 text-white' : 'bg-neutral-100 text-neutral-500'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs">{item.label}</span>
                      </div>

                      <div
                        className={`w-4 h-4 rounded-full flex items-center justify-center border transition-colors ${
                          isSelected
                            ? 'bg-neutral-950 border-neutral-950 text-white'
                            : 'border-neutral-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 2. Bloques Duplicados Dinámicamente para cada formato seleccionado */}
            <div className="space-y-3 pt-1">
              {selectedHabits.map((habitId) => {
                const def = HABIT_DEFINITIONS[habitId]
                const Icon = def.icon
                const val = habitValues[habitId]

                return (
                  <div
                    key={habitId}
                    className="bg-white border border-neutral-200/90 rounded-3xl p-4 space-y-3.5 shadow-xs animate-in fade-in slide-in-from-bottom-2 duration-200"
                  >
                    {/* Cabecera del bloque */}
                    <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <h3 className="text-sm font-semibold text-neutral-950">{def.label}</h3>
                      </div>

                      <span className="text-[10px] uppercase font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md">
                        Configuración
                      </span>
                    </div>

                    {/* Slider de Consumo Diario */}
                    <div className="space-y-2">
                      <div className="flex items-baseline justify-between">
                        <label className="text-xs font-medium text-neutral-600">
                          {def.unitsTitle}
                        </label>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-bold text-neutral-950 font-sans">
                            {val.units}
                          </span>
                          <span className="text-xs text-neutral-400">{def.unitsUnit}</span>
                        </div>
                      </div>

                      <input
                        type="range"
                        min="1"
                        max={def.unitsMax}
                        step="1"
                        value={val.units}
                        onChange={(e) => updateHabitUnits(habitId, Number(e.target.value))}
                        className="w-full h-2 bg-neutral-150 rounded-lg appearance-none cursor-pointer accent-neutral-950"
                      />
                    </div>

                    {/* Campo de Precio / Coste */}
                    <div className="flex items-center justify-between pt-1">
                      <div>
                        <label className="block text-xs font-medium text-neutral-700">
                          {def.priceTitle}
                        </label>
                        <span className="text-[10px] text-neutral-400">{def.priceSubtitle}</span>
                      </div>
                      <div className="flex items-center gap-1.5 w-24">
                        <input
                          type="number"
                          step="0.10"
                          min="0.5"
                          max="100"
                          value={val.price}
                          onChange={(e) => updateHabitPrice(habitId, Number(e.target.value))}
                          className="w-full h-10 px-2.5 text-right bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-semibold text-neutral-950 focus:outline-none focus:border-neutral-900"
                        />
                        <span className="text-sm font-semibold text-neutral-600">€</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 3. Selector Simplificado de Fecha (sin hora) */}
            <div className="bg-white border border-neutral-200 rounded-2xl p-4 space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-neutral-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                  Fecha de tu último consumo
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const todayIso = new Date().toISOString().slice(0, 10)
                    setSmokeFreeDate(todayIso)
                  }}
                  className="text-xs text-emerald-700 hover:underline font-semibold bg-emerald-50 px-2.5 py-0.5 rounded-full"
                >
                  Hoy 📅
                </button>
              </div>

              <input
                type="date"
                value={smokeFreeDate}
                onChange={(e) => setSmokeFreeDate(e.target.value)}
                className="w-full h-11 px-3.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-neutral-900 font-medium focus:outline-none focus:border-neutral-900 transition-colors"
              />
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* PASO 3: TU MOTIVACIÓN & META DE AHORRO */}
        {/* ======================================================== */}
        {currentStep === 3 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full">
                Motivación
              </span>
              <h2 className="text-2xl font-semibold tracking-tight text-neutral-950 mt-1.5">
                Tu motor de cambio
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">
                Tus motivos clave para recordar en los momentos de antojo o estrés.
              </p>
            </div>

            {/* Selección múltiple de motivaciones */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-neutral-600">
                ¿Qué te impulsa a dar el paso?
              </label>

              <div className="grid grid-cols-1 gap-2">
                {MOTIVATION_OPTIONS.map((item) => {
                  const Icon = item.icon
                  const isSelected = selectedMotivations.includes(item.id)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleMotivation(item.id)}
                      className={`w-full p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
                        isSelected
                          ? 'bg-white border-neutral-950 text-neutral-950 font-semibold shadow-xs ring-1 ring-neutral-950'
                          : 'bg-white/80 border-neutral-200 text-neutral-600 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                            isSelected ? 'bg-neutral-950 text-white' : 'bg-neutral-100 text-neutral-500'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-sm">{item.label}</span>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center border transition-colors ${
                          isSelected
                            ? 'bg-neutral-950 border-neutral-950 text-white'
                            : 'border-neutral-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Campo Sueño / Meta de Ahorro */}
            <div className="space-y-1 pt-1">
              <label className="block text-xs font-medium text-neutral-600">
                ¿En qué sueño invertirás el dinero ahorrado?
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={savingsGoal}
                  onChange={(e) => setSavingsGoal(e.target.value)}
                  placeholder="Tu meta de recompensa"
                  className="w-full h-12 pl-11 pr-4 bg-white border border-neutral-200 focus:border-neutral-900 rounded-2xl text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none transition-colors shadow-xs"
                />
                <Trophy className="w-4 h-4 text-amber-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <p className="text-[11px] text-neutral-400">
                Visualizar una meta tangible aumenta tu tasa de éxito en un 64%.
              </p>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* PASO 4: EL PACTO SOCIAL (SQUAD & MULTAS) */}
        {/* ======================================================== */}
        {currentStep === 4 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full">
                Comunidad
              </span>
              <h2 className="text-2xl font-semibold tracking-tight text-neutral-950 mt-1.5">
                El pacto con tus amigos
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">
                El compromiso mutuo fortalece la constancia. Si tropiezas, aportas al bote para celebrar juntos.
              </p>
            </div>

            {/* Selector de multa simbólica */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-neutral-600">
                Aporte al bote por recaída
              </label>

              <div className="grid grid-cols-4 gap-2">
                {[1.0, 3.0, 5.0, 10.0].map((amount) => {
                  const isSelected = penaltyAmount === amount
                  return (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setPenaltyAmount(amount)}
                      className={`py-3 px-2 rounded-2xl border text-center transition-all ${
                        isSelected
                          ? 'bg-white border-neutral-950 text-neutral-950 font-bold shadow-xs ring-1 ring-neutral-950'
                          : 'bg-white/80 border-neutral-200 text-neutral-600 hover:bg-white'
                      }`}
                    >
                      <span className="text-base">{amount}€</span>
                      {amount === 1.0 && (
                        <span className="block text-[9px] text-emerald-700 font-semibold mt-0.5">Recomendado</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Código de enlace de Squad */}
            <div className="bg-white border border-neutral-200 rounded-2xl p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-700" />
                  <span className="text-xs font-semibold text-neutral-950">Tu Código de Guardián</span>
                </div>
                <span className="text-[10px] text-neutral-400 uppercase font-mono">1 Amigo</span>
              </div>

              <div className="flex items-center justify-between bg-neutral-50 border border-neutral-200 rounded-xl p-2.5">
                <span className="font-mono text-sm font-bold tracking-wider text-neutral-950 px-2">
                  {squadCode}
                </span>

                <button
                  type="button"
                  onClick={handleCopySquadCode}
                  className="px-3 py-1.5 bg-neutral-950 hover:bg-neutral-800 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  {copiedCode ? (
                    <>
                      <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-[11px] text-neutral-500 leading-relaxed">
                Tus amigos podrán regar tu planta cuando tengas antojos y motivarte en tu racha.
              </p>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* PASO 5: REVELACIÓN DE IMPACTO CONSOLIDADO */}
        {/* ======================================================== */}
        {currentStep === 5 && (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300 text-center">
            {/* Ilustración de la planta seleccionada */}
            <div className="flex justify-center pt-1">
              <div className="relative">
                <div className="w-24 h-24 rounded-3xl bg-white border border-neutral-200/90 shadow-sm flex items-center justify-center">
                  <PlantHeroIllustration plantId={selectedPlant} />
                </div>
                <div className="absolute -bottom-2 -right-2 bg-neutral-950 text-white p-1.5 rounded-full shadow-md">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                </div>
              </div>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-800 bg-emerald-100/80 px-3 py-1 rounded-full">
                Todo listo, {fullName || 'Compañero'}
              </span>
              <h2 className="text-2xl font-semibold tracking-tight text-neutral-950 mt-1.5">
                Tu proyección a 1 año libre
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5 max-w-xs mx-auto">
                El impacto real de tu decisión en tu economía y bienestar:
              </p>
            </div>

            {/* Tarjetas de Impacto Proyectado */}
            <div className="grid grid-cols-2 gap-3 text-left">
              {/* Dinero recuperado */}
              <div className="bg-white border border-emerald-200/80 rounded-2xl p-4 space-y-1 shadow-xs">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center mb-1">
                  <PiggyBank className="w-4 h-4" />
                </div>
                <span className="text-[10px] uppercase font-semibold text-neutral-400">Ahorro proyectado</span>
                <p className="text-lg font-bold text-neutral-950 font-sans">
                  +{totals.yearlySavings.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€
                </p>
                <span className="text-[10px] text-neutral-500 block truncate">
                  Meta: {savingsGoal || 'Tu sueño'}
                </span>
              </div>

              {/* Salud / Unidades evitadas */}
              <div className="bg-white border border-sky-200/80 rounded-2xl p-4 space-y-1 shadow-xs">
                <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center mb-1">
                  <HeartPulse className="w-4 h-4" />
                </div>
                <span className="text-[10px] uppercase font-semibold text-neutral-400">Dosis / cigs evitados</span>
                <p className="text-lg font-bold text-neutral-950 font-sans">
                  {totals.yearlyUnits.toLocaleString('es-ES')}
                </p>
                <span className="text-[10px] text-emerald-700 block font-medium">
                  +{totals.daysOfLifeGained} días de vida ganados
                </span>
              </div>
            </div>

            <p className="text-[11px] text-neutral-400 max-w-xs mx-auto leading-relaxed">
              Tu {currentPlantData.name} crecerá contigo a partir de hoy.
            </p>
          </div>
        )}
      </main>

      {/* FOOTER: CONTROLES DE NAVEGACIÓN */}
      <footer className="relative z-10 pt-2 flex items-center gap-3">
        {currentStep > 1 && (
          <button
            type="button"
            onClick={handlePrevStep}
            disabled={isSubmitting}
            className="h-12 px-4 bg-white hover:bg-neutral-50 text-neutral-700 font-medium text-sm rounded-2xl flex items-center justify-center gap-1.5 transition-colors border border-neutral-200 shadow-xs disabled:opacity-40"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Atrás</span>
          </button>
        )}

        {currentStep < totalSteps ? (
          <button
            type="button"
            onClick={handleNextStep}
            disabled={!canAdvance()}
            className="flex-1 h-12 bg-neutral-950 hover:bg-neutral-800 text-white font-medium text-sm rounded-2xl flex items-center justify-center gap-2 transition-transform active:scale-[0.98] shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span>Continuar</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleCompleteOnboarding}
            disabled={isSubmitting}
            className="flex-1 h-12 bg-emerald-800 hover:bg-emerald-700 text-white font-semibold text-sm rounded-2xl flex items-center justify-center gap-2 transition-transform active:scale-[0.98] shadow-md shadow-emerald-800/20 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Plantando tu libertad...</span>
              </>
            ) : (
              <>
                <Sprout className="w-4 h-4" />
                <span>Plantar mi libertad 🌿</span>
              </>
            )}
          </button>
        )}
      </footer>
    </div>
  )
}
