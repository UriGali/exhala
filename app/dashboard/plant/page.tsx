'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
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
  Sliders,
  Share2,
  X,
  HeartPulse,
  Award,
  Wind,
  Sun,
  ShieldCheck,
  Check,
} from 'lucide-react'
import confetti from 'canvas-confetti'
import { supabase } from '@/lib/supabase/client'
import { Profile } from '@/types/database.types'
import BottomNav from '@/components/BottomNav'
import GardenPlantVisualizer, { PLANT_SPECIES, PlantSpecies } from '@/components/GardenPlantVisualizer'

type PlantTab = 'active' | 'garden'

export default function PlantPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<PlantTab>('active')

  // Estado del usuario y datos
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  // Sistema de riego
  const [totalWaterings, setTotalWaterings] = useState<number>(0)
  const [lastWateredAt, setLastWateredAt] = useState<string | null>(null)
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState<number>(0)
  const [isWateringActive, setIsWateringActive] = useState<boolean>(false)
  const [isWateringAnim, setIsWateringAnim] = useState<boolean>(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Modo interactivo / Demo slider para previsualizar todas las etapas
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false)
  const [demoStage, setDemoStage] = useState<number>(0)
  const [demoSpeciesIndex, setDemoSpeciesIndex] = useState<number>(0)

  // Modal para inspeccionar planta del jardín
  const [inspectedPlant, setInspectedPlant] = useState<{
    species: PlantSpecies
    speciesIndex: number
    isHarvested: boolean
    wateringsCompleted: number
    harvestDate?: string
  } | null>(null)

  // Cargar perfil y acciones de riego
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
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

        // Obtener historial de riegos
        const { data: waterActions, count } = await supabase
          .from('plant_actions')
          .select('created_at', { count: 'exact' })
          .eq('smoker_id', user.id)
          .eq('action_type', 'water')
          .order('created_at', { ascending: false })

        const total = count || 0
        setTotalWaterings(total)

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
      }
    } catch (err) {
      console.error('Error loading plant data:', err)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    loadData()
  }, [loadData])

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
    const seconds = timeRemainingSeconds % 60
    return `${hours.toString().padStart(2, '0')}h ${minutes
      .toString()
      .padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`
  }, [timeRemainingSeconds])

  // Cálculos del Jardín:
  // Cada planta requiere 30 riegos para completarse y pasar al jardín
  const currentPlantIndex = Math.floor(totalWaterings / 30)
  const currentPlantStage = totalWaterings % 30
  const completedPlantsCount = currentPlantIndex

  const activeSpecies = PLANT_SPECIES[currentPlantIndex % PLANT_SPECIES.length]

  // En modo demo usamos el estado del slider
  const displayedStage = isDemoMode ? demoStage : currentPlantStage
  const displayedSpeciesIndex = isDemoMode ? demoSpeciesIndex : currentPlantIndex
  const displayedSpecies = PLANT_SPECIES[displayedSpeciesIndex % PLANT_SPECIES.length]

  // Riego interactivo
  const handleWaterPlant = async () => {
    if (timeRemainingSeconds > 0 || isWateringActive || !userId) return
    setIsWateringActive(true)
    setIsWateringAnim(true)

    try {
      const nowIso = new Date().toISOString()

      const { error } = await supabase.from('plant_actions').insert({
        smoker_id: userId,
        friend_id: userId,
        action_type: 'water',
        created_at: nowIso,
      })

      if (error) throw error

      setTimeout(() => {
        const nextTotal = totalWaterings + 1
        setTotalWaterings(nextTotal)
        setLastWateredAt(nowIso)
        setTimeRemainingSeconds(12 * 60 * 60)

        // Si completó 30 riegos (múltiplo de 30) -> Cosecha al jardín
        if (nextTotal % 30 === 0) {
          setToastMessage('🎉 ¡Felicidades! Planta madurada y añadida a tu Jardín Botánico.')
          try {
            confetti({
              particleCount: 90,
              spread: 90,
              origin: { y: 0.5 },
              colors: ['#10B981', '#F59E0B', '#EC4899', '#3B82F6', '#8B5CF6'],
            })
          } catch {}
        } else {
          setToastMessage(`¡Planta regada! Crecimiento: ${nextTotal % 30}/30 riegos 🌱`)
          try {
            confetti({
              particleCount: 35,
              spread: 60,
              origin: { y: 0.6 },
              colors: ['#10B981', '#34D399', '#38BDF8'],
            })
          } catch {}
        }
      }, 1000)

      setTimeout(() => {
        setIsWateringAnim(false)
        setIsWateringActive(false)
      }, 2200)

      setTimeout(() => {
        setToastMessage(null)
      }, 4000)
    } catch (err) {
      console.error('Error watering plant:', err)
      setIsWateringAnim(false)
      setIsWateringActive(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-[100dvh] w-full bg-white flex flex-col items-center justify-center max-w-md mx-auto p-6 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-950 flex items-center justify-center animate-pulse">
          <Sprout className="w-6 h-6 text-emerald-400" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
          Cargando tu Jardín Botánico...
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] w-full bg-neutral-50/50 text-neutral-900 flex flex-col justify-between max-w-md mx-auto relative antialiased select-none pb-24">
      {/* NOTIFICACIÓN TOAST */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-sm bg-neutral-950 text-white text-xs py-3 px-4 rounded-2xl shadow-xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top duration-300">
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Check className="w-3.5 h-3.5" />
          </div>
          <span className="font-medium leading-tight">{toastMessage}</span>
        </div>
      )}

      {/* HEADER PRINCIPAL */}
      <header className="pt-6 px-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
            <Sprout className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-neutral-950 leading-tight">Planta & Jardín</h1>
            <p className="text-[11px] text-neutral-400 font-medium">
              {completedPlantsCount > 0
                ? `${completedPlantsCount} ${completedPlantsCount === 1 ? 'planta cosechada' : 'plantas cosechadas'}`
                : 'Tu primer espécimen en cultivo'}
            </p>
          </div>
        </div>

        {/* Badge de nivel del Jardín */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200/70 rounded-full">
          <TreePine className="w-3.5 h-3.5 text-emerald-700" />
          <span className="text-xs font-semibold text-emerald-900">
            Nivel {completedPlantsCount + 1}
          </span>
        </div>
      </header>

      {/* TABS DE SUB-NAVEGACIÓN: PLANTA ACTUAL / MI JARDÍN */}
      <div className="px-6 mt-4">
        <div className="grid grid-cols-2 p-1 bg-neutral-200/70 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveTab('active')}
            className={`py-2 text-xs font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 ${
              activeTab === 'active'
                ? 'bg-white text-neutral-950 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Flower2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Planta Activa</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('garden')}
            className={`py-2 text-xs font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 ${
              activeTab === 'garden'
                ? 'bg-white text-neutral-950 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <TreePine className="w-3.5 h-3.5 text-emerald-600" />
            <span>Mi Jardín ({completedPlantsCount})</span>
          </button>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 px-6 py-4 space-y-4">
        {/* =================================================================== */}
        {/* VISTA 1: PLANTA ACTIVA (CUIDADO, RIEGO Y CRECIMIENTO EN VIVO)      */}
        {/* =================================================================== */}
        {activeTab === 'active' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* CARD HERO DE LA PLANTA */}
            <div className="bg-white rounded-3xl p-5 border border-neutral-100 shadow-xs relative overflow-hidden">
              {/* Título de la especie y número de espécimen */}
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                    Espécimen #{displayedSpeciesIndex + 1}
                  </span>
                  <h2 className="text-lg font-bold text-neutral-950 mt-1">
                    {displayedSpecies.name}
                  </h2>
                  <p className="text-xs text-neutral-400 italic font-serif">
                    {displayedSpecies.scientificName}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-2xl font-light text-neutral-950 font-sans">
                    {displayedStage}
                  </span>
                  <span className="text-xs text-neutral-400 font-medium">/30</span>
                  <p className="text-[10px] text-neutral-500 font-medium">Riegos</p>
                </div>
              </div>

              {/* VISUALIZADOR SVG PRINCIPAL */}
              <div className="py-2">
                <GardenPlantVisualizer
                  stage={displayedStage}
                  speciesIndex={displayedSpeciesIndex}
                  isWateringAnim={isWateringAnim}
                  size="lg"
                  showStageBadge={false}
                />
              </div>

              {/* BARRA DE PROGRESO DE MADUREZ (0 a 30) */}
              <div className="mt-2 space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-neutral-700">
                  <span>Madurez botánica</span>
                  <span className="text-emerald-700">
                    {Math.round((displayedStage / 30) * 100)}%
                  </span>
                </div>
                <div className="w-full h-2.5 bg-neutral-100 rounded-full overflow-hidden p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-700"
                    style={{ width: `${Math.max(4, (displayedStage / 30) * 100)}%` }}
                  />
                </div>
                <p className="text-[11px] text-neutral-400 text-center font-medium">
                  {30 - displayedStage === 0
                    ? '¡Planta lista para pasar permanentemente a tu Jardín!'
                    : `Faltan ${30 - displayedStage} riegos para completar y cosechar esta planta`}
                </p>
              </div>

              {/* BOTÓN DE ACCIÓN: REGAR PLANTA (CADA 12H) */}
              <div className="mt-4 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={handleWaterPlant}
                  disabled={timeRemainingSeconds > 0 || isWateringActive}
                  className={`w-full h-13 rounded-2xl font-medium text-sm flex items-center justify-center gap-2.5 transition-all shadow-xs ${
                    timeRemainingSeconds > 0
                      ? 'bg-neutral-100 text-neutral-400 border border-neutral-200 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.98]'
                  }`}
                >
                  <Droplets className={`w-4 h-4 ${timeRemainingSeconds > 0 ? 'text-neutral-400' : 'text-emerald-200 animate-bounce'}`} />
                  {timeRemainingSeconds > 0 ? (
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-neutral-400" />
                      <span>Próximo riego en {formattedCountdown}</span>
                    </div>
                  ) : (
                    <span>Regar Planta (+1 Riego)</span>
                  )}
                </button>
              </div>
            </div>

            {/* CARD DE BENEFICIO BIOLÓGICO Y CURIOSIDAD BOTÁNICA */}
            <div className="bg-emerald-50/70 border border-emerald-200/60 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-emerald-950 font-semibold text-xs">
                <HeartPulse className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Salud Pulmonar en esta Etapa</span>
              </div>
              <p className="text-xs text-emerald-900/80 leading-relaxed">
                {displayedSpecies.healingBenefit}
              </p>
              <div className="pt-2 border-t border-emerald-200/40 text-[11px] text-emerald-700/90 italic">
                "{displayedSpecies.lore}"
              </div>
            </div>

            {/* MODAL/SECCIÓN INTERACTIVA: MODO DEMOSTRACIÓN / SIMULADOR */}
            <div className="bg-white rounded-2xl p-4 border border-neutral-100 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-neutral-600" />
                  <span className="text-xs font-semibold text-neutral-900">
                    Modo Simulador de Crecimiento
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDemoMode(!isDemoMode)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                    isDemoMode
                      ? 'bg-emerald-600 text-white'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  {isDemoMode ? 'Activo' : 'Probar'}
                </button>
              </div>

              {isDemoMode && (
                <div className="space-y-3 pt-2 animate-in fade-in duration-200">
                  <div>
                    <div className="flex justify-between text-xs text-neutral-600 mb-1">
                      <span>Probar Riego (0 a 30):</span>
                      <span className="font-bold text-neutral-900">{demoStage}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="30"
                      value={demoStage}
                      onChange={(e) => setDemoStage(Number(e.target.value))}
                      className="w-full accent-emerald-600 h-2 bg-neutral-200 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-neutral-600 mb-1">
                      Cambiar Especie:
                    </label>
                    <select
                      value={demoSpeciesIndex}
                      onChange={(e) => setDemoSpeciesIndex(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900 focus:outline-none focus:border-neutral-900"
                    >
                      {PLANT_SPECIES.map((sp, idx) => (
                        <option key={sp.id} value={idx}>
                          {idx + 1}. {sp.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* VISTA 2: MI JARDÍN BOTÁNICO (COLECCIÓN DE PLANTAS COMPLETADAS)     */}
        {/* =================================================================== */}
        {activeTab === 'garden' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* ESTADÍSTICAS DEL JARDÍN */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="bg-white p-3 rounded-2xl border border-neutral-100 text-center shadow-xs">
                <span className="text-xl font-light text-neutral-950 block">
                  {completedPlantsCount}
                </span>
                <span className="text-[10px] text-neutral-400 font-medium uppercase tracking-tight">
                  Cosechadas
                </span>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-neutral-100 text-center shadow-xs">
                <span className="text-xl font-light text-neutral-950 block">
                  {totalWaterings}
                </span>
                <span className="text-[10px] text-neutral-400 font-medium uppercase tracking-tight">
                  Riegos Totales
                </span>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-neutral-100 text-center shadow-xs">
                <span className="text-xl font-light text-emerald-600 block">
                  {(totalWaterings * 1.5).toFixed(0)}L
                </span>
                <span className="text-[10px] text-neutral-400 font-medium uppercase tracking-tight">
                  O₂ Generado
                </span>
              </div>
            </div>

            {/* BOTANICAL GREENHOUSE GRID */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Colección Botánica
              </h3>

              <div className="grid grid-cols-2 gap-3">
                {PLANT_SPECIES.map((species, idx) => {
                  const isHarvested = idx < completedPlantsCount
                  const isCurrent = idx === completedPlantsCount
                  const isLocked = idx > completedPlantsCount

                  return (
                    <div
                      key={species.id}
                      onClick={() =>
                        setInspectedPlant({
                          species,
                          speciesIndex: idx,
                          isHarvested,
                          wateringsCompleted: isHarvested ? 30 : isCurrent ? currentPlantStage : 0,
                        })
                      }
                      className={`relative bg-white rounded-3xl p-3.5 border transition-all cursor-pointer ${
                        isHarvested
                          ? 'border-emerald-200/80 shadow-xs hover:border-emerald-400'
                          : isCurrent
                          ? 'border-emerald-400 ring-2 ring-emerald-500/20'
                          : 'border-neutral-100 opacity-60'
                      }`}
                    >
                      {/* Estado superior */}
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-tight">
                          #{idx + 1}
                        </span>
                        {isHarvested && (
                          <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </span>
                        )}
                        {isCurrent && (
                          <span className="px-1.5 py-0.5 bg-emerald-600 text-white rounded text-[9px] font-semibold">
                            Cultivando
                          </span>
                        )}
                        {isLocked && (
                          <span className="w-5 h-5 rounded-full bg-neutral-100 text-neutral-400 flex items-center justify-center">
                            <Lock className="w-3 h-3" />
                          </span>
                        )}
                      </div>

                      {/* Miniatura de la planta */}
                      <div className="h-28 flex items-center justify-center">
                        <GardenPlantVisualizer
                          stage={isHarvested ? 30 : isCurrent ? currentPlantStage : 0}
                          speciesIndex={idx}
                          size="sm"
                        />
                      </div>

                      {/* Info de la planta */}
                      <div className="text-center mt-1">
                        <h4 className="text-xs font-bold text-neutral-900 truncate">
                          {species.name}
                        </h4>
                        <p className="text-[10px] text-neutral-400 truncate">
                          {isHarvested
                            ? 'Florecida en Jardín 🌸'
                            : isCurrent
                            ? `${currentPlantStage}/30 riegos`
                            : `Desbloquea en ${(idx) * 30} riegos`}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL DE INSPECCIÓN DE PLANTA DEL JARDÍN */}
      {inspectedPlant && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 space-y-4 animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                  Espécimen #{inspectedPlant.speciesIndex + 1}
                </span>
                <h3 className="text-lg font-bold text-neutral-950 mt-1">
                  {inspectedPlant.species.name}
                </h3>
                <p className="text-xs text-neutral-400 italic">
                  {inspectedPlant.species.scientificName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectedPlant(null)}
                className="text-neutral-400 hover:text-neutral-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-2">
              <GardenPlantVisualizer
                stage={inspectedPlant.isHarvested ? 30 : inspectedPlant.wateringsCompleted}
                speciesIndex={inspectedPlant.speciesIndex}
                size="md"
              />
            </div>

            <div className="space-y-2 text-xs text-neutral-600 bg-neutral-50 p-3.5 rounded-2xl border border-neutral-200/60">
              <p className="font-medium text-neutral-900">
                {inspectedPlant.species.lore}
              </p>
              <p className="text-emerald-800">
                🌿 <span className="font-semibold">Beneficio clínico:</span>{' '}
                {inspectedPlant.species.healingBenefit}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setInspectedPlant(null)}
              className="w-full h-11 bg-neutral-950 text-white font-medium text-xs rounded-2xl"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* BARRA DE NAVEGACIÓN INFERIOR UNIFICADA */}
      <BottomNav currentTab="plant" />
    </div>
  )
}
