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
  Users,
  UserPlus,
} from 'lucide-react'
import confetti from 'canvas-confetti'
import { supabase } from '@/lib/supabase/client'
import { Profile } from '@/types/database.types'
import BottomNav from '@/components/BottomNav'
import GardenPlantVisualizer, { PLANT_SPECIES, PlantSpecies } from '@/components/GardenPlantVisualizer'

type PlantTab = 'active' | 'garden'

interface SupportedFriendGarden {
  id: string
  name: string
  initials: string
  avatarBg: string
  avatarText: string
  totalWaterings: number
  lastWateredAt: string | null
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

export default function PlantPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<PlantTab>('active')

  // Estado del usuario y datos
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  // Datos para Guardián (amigos apoyados)
  const [supportedFriends, setSupportedFriends] = useState<SupportedFriendGarden[]>([])
  const [selectedFriendIndex, setSelectedFriendIndex] = useState<number>(0)

  // Sistema de riego para fumador
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

  const isGuardian = profile?.role === 'friend'

  // Cargar perfil y datos de plantas
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

        if (userProfile.role === 'friend') {
          // --- MODO GUARDIÁN: Cargar plantas y jardines de los amigos apoyados ---
          const { data: friendships } = await supabase
            .from('friendships')
            .select(`
              smoker_id,
              smoker:profiles!friendships_smoker_id_fkey(id, full_name, role, smoke_free_since)
            `)
            .eq('friend_id', user.id)
            .eq('status', 'accepted')

          if (friendships && friendships.length > 0) {
            const friendsData: SupportedFriendGarden[] = []

            for (const f of friendships) {
              const smoker = (f as any).smoker
              if (!smoker || !smoker.id) continue

              const { count: waterCount, data: lastWater } = await supabase
                .from('plant_actions')
                .select('created_at', { count: 'exact' })
                .eq('smoker_id', smoker.id)
                .eq('action_type', 'water')
                .order('created_at', { ascending: false })
                .limit(1)

              const name = smoker.full_name || 'Compañero'
              const color = getAvatarColor(name)
              const initials = getInitials(name)

              friendsData.push({
                id: smoker.id,
                name,
                initials,
                avatarBg: color.bg,
                avatarText: color.text,
                totalWaterings: waterCount || 0,
                lastWateredAt: lastWater?.[0]?.created_at || null,
              })
            }

            setSupportedFriends(friendsData)
          }
        } else {
          // --- MODO FUMADOR: Cargar su propio historial de riegos ---
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

  // Temporizador de 12 horas (para fumadores)
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

  // Amigo actualmente seleccionado (en modo guardián)
  const currentSelectedFriend = isGuardian && supportedFriends.length > 0
    ? supportedFriends[selectedFriendIndex] || supportedFriends[0]
    : null

  // Cálculos del Jardín:
  // Cada planta requiere 30 riegos para completarse y pasar al jardín
  const effectiveTotalWaterings = isGuardian
    ? currentSelectedFriend?.totalWaterings || 0
    : totalWaterings

  const currentPlantIndex = Math.floor(effectiveTotalWaterings / 30)
  const currentPlantStage = effectiveTotalWaterings % 30
  const completedPlantsCount = currentPlantIndex

  const activeSpecies = PLANT_SPECIES[currentPlantIndex % PLANT_SPECIES.length]

  // En modo demo usamos el estado del slider
  const displayedStage = isDemoMode ? demoStage : currentPlantStage
  const displayedSpeciesIndex = isDemoMode ? demoSpeciesIndex : currentPlantIndex
  const displayedSpecies = PLANT_SPECIES[displayedSpeciesIndex % PLANT_SPECIES.length]

  // Riego interactivo (propio si es fumador, o a un amigo si es guardián)
  const handleWaterPlant = async () => {
    if (isWateringActive || !userId) return

    if (!isGuardian && timeRemainingSeconds > 0) return

    setIsWateringActive(true)
    setIsWateringAnim(true)

    try {
      const nowIso = new Date().toISOString()
      const targetSmokerId = isGuardian && currentSelectedFriend ? currentSelectedFriend.id : userId

      const { error } = await supabase.from('plant_actions').insert({
        smoker_id: targetSmokerId,
        friend_id: userId,
        action_type: 'water',
        created_at: nowIso,
      })

      if (error) throw error

      setTimeout(() => {
        if (isGuardian && currentSelectedFriend) {
          const nextFriendWaterings = currentSelectedFriend.totalWaterings + 1
          setSupportedFriends((prev) =>
            prev.map((f, i) =>
              i === selectedFriendIndex ? { ...f, totalWaterings: nextFriendWaterings } : f
            )
          )
          setToastMessage(`💧 ¡Has regado la planta de ${currentSelectedFriend.name}! (+1 vitalidad)`)
        } else {
          const nextTotal = totalWaterings + 1
          setTotalWaterings(nextTotal)
          setLastWateredAt(nowIso)
          setTimeRemainingSeconds(12 * 60 * 60)

          if (nextTotal % 30 === 0) {
            setToastMessage('🎉 ¡Felicidades! Planta madurada y añadida a tu Jardín Botánico.')
          } else {
            setToastMessage(`¡Planta regada! Crecimiento: ${nextTotal % 30}/30 riegos 🌱`)
          }
        }

        try {
          confetti({
            particleCount: 50,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#10B981', '#34D399', '#38BDF8', '#74C69D'],
          })
        } catch {}
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
          Cargando Jardín Botánico...
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
            <h1 className="text-base font-bold text-neutral-950 leading-tight">
              {isGuardian ? 'Jardines de mis Amigos' : 'Planta & Jardín'}
            </h1>
            <p className="text-[11px] text-neutral-400 font-medium">
              {isGuardian
                ? 'Acompaña y riega las plantas de tus compañeros'
                : completedPlantsCount > 0
                ? `${completedPlantsCount} ${completedPlantsCount === 1 ? 'planta cosechada' : 'plantas cosechadas'}`
                : 'Tu primer espécimen en cultivo'}
            </p>
          </div>
        </div>

        {/* Badge de nivel */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200/70 rounded-full">
          <TreePine className="w-3.5 h-3.5 text-emerald-700" />
          <span className="text-xs font-semibold text-emerald-900">
            {isGuardian ? 'Guardián 🛡️' : `Nivel ${completedPlantsCount + 1}`}
          </span>
        </div>
      </header>

      {/* BANNER EXPLICATIVO PARA GUARDIANES */}
      {isGuardian && (
        <div className="px-6 mt-3">
          <div className="bg-sky-50/90 border border-sky-200/80 rounded-2xl p-3.5 flex items-start gap-3 shadow-2xs">
            <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center shrink-0 mt-0.5">
              <Droplets className="w-4 h-4 fill-sky-600/20 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-sky-950">Tu misión botánica</h3>
              <p className="text-[11px] text-sky-800 mt-0.5 leading-relaxed">
                Como guardián, puedes regar la planta de tus amigos para ayudarles a crecer y visitar los ejemplares de su jardín botánico.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SELECTOR DE AMIGOS EN MODO GUARDIÁN */}
      {isGuardian && supportedFriends.length > 0 && (
        <div className="px-6 mt-3 space-y-1.5">
          <label className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
            Amigo en cultivo
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {supportedFriends.map((f, idx) => {
              const isSelected = idx === selectedFriendIndex
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelectedFriendIndex(idx)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-2xl border transition-all shrink-0 ${
                    isSelected
                      ? 'bg-neutral-950 text-white border-neutral-950 shadow-xs'
                      : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isSelected ? 'bg-white/20 text-white' : `${f.avatarBg} ${f.avatarText}`
                    }`}
                  >
                    {f.initials}
                  </div>
                  <span className="text-xs font-semibold">{f.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* SI ES GUARDIÁN Y NO TIENE AMIGOS CONECTADOS */}
      {isGuardian && supportedFriends.length === 0 && (
        <div className="px-6 my-auto text-center space-y-4 py-12">
          <div className="w-14 h-14 rounded-3xl bg-neutral-100 flex items-center justify-center mx-auto text-neutral-400">
            <Users className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-neutral-950">Aún no tienes amigos en proceso</h3>
            <p className="text-xs text-neutral-400 max-w-xs mx-auto">
              Conecta con amigos que estén dejando de fumar para empezar a regar y cuidar de sus plantas.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push('/dashboard/friends')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-neutral-950 text-white text-xs font-semibold rounded-2xl shadow-xs active:scale-95 transition-transform"
          >
            <UserPlus className="w-4 h-4 text-emerald-400" />
            <span>Buscar y añadir amigos</span>
          </button>
        </div>
      )}

      {/* TABS DE SUB-NAVEGACIÓN: PLANTA ACTUAL / MI JARDÍN */}
      {(!isGuardian || supportedFriends.length > 0) && (
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
              <span>{isGuardian ? `Planta de ${currentSelectedFriend?.name.split(' ')[0] || 'Amigo'}` : 'Planta Activa'}</span>
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
              <span>{isGuardian ? `Jardín (${completedPlantsCount})` : `Mi Jardín (${completedPlantsCount})`}</span>
            </button>
          </div>
        </div>
      )}

      {/* CONTENIDO PRINCIPAL */}
      {(!isGuardian || supportedFriends.length > 0) && (
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
                  />
                </div>

                {/* Barra de progreso de crecimiento (0 a 30) */}
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-[11px] font-medium text-neutral-500">
                    <span>Maduración botánica</span>
                    <span className="font-semibold text-emerald-800">
                      {Math.round((displayedStage / 30) * 100)}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                      style={{ width: `${(displayedStage / 30) * 100}%` }}
                    />
                  </div>
                </div>

                {/* BOTÓN PRINCIPAL DE RIEGO */}
                <div className="pt-4">
                  <button
                    type="button"
                    onClick={handleWaterPlant}
                    disabled={isWateringActive || (!isGuardian && timeRemainingSeconds > 0)}
                    className="w-full h-13 bg-emerald-800 hover:bg-emerald-700 text-white font-semibold text-sm rounded-2xl flex items-center justify-center gap-2.5 transition-transform active:scale-[0.98] shadow-md shadow-emerald-800/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Droplets className="w-4 h-4 fill-emerald-300 stroke-[2.2]" />
                    <span>
                      {isWateringActive
                        ? 'Regando con agua pura...'
                        : isGuardian
                        ? `Regar planta de ${currentSelectedFriend?.name.split(' ')[0] || 'Amigo'}`
                        : timeRemainingSeconds > 0
                        ? `Próximo riego en ${formattedCountdown}`
                        : 'Regar planta (+1 Crecimiento)'}
                    </span>
                  </button>

                  {!isGuardian && timeRemainingSeconds > 0 && (
                    <p className="text-[11px] text-center text-neutral-400 mt-2">
                      💧 Tu planta absorbe los nutrientes. Vuelve en unas horas para el siguiente riego.
                    </p>
                  )}
                </div>
              </div>

              {/* LORE BOTÁNICO & BENEFICIO CLÍNICO */}
              <div className="bg-white rounded-3xl p-5 border border-neutral-100 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-neutral-900">
                  <Sparkles className="w-4 h-4 text-emerald-700" />
                  <span>Historia & Beneficio Pulmonar</span>
                </div>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  {displayedSpecies.lore}
                </p>
                <div className="p-3 bg-emerald-50/80 border border-emerald-200/60 rounded-2xl flex items-start gap-2.5">
                  <HeartPulse className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <p className="text-xs text-emerald-900 leading-snug">
                    <span className="font-semibold">Regeneración:</span>{' '}
                    {displayedSpecies.healingBenefit}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* VISTA 2: MI JARDÍN BOTÁNICO (COLECCIÓN DE ESPECIES COSECHADAS)     */}
          {/* =================================================================== */}
          {activeTab === 'garden' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              {/* HEADER DEL JARDÍN */}
              <div className="bg-gradient-to-br from-emerald-950 to-neutral-900 text-white rounded-3xl p-5 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                    {isGuardian ? `Jardín de ${currentSelectedFriend?.name || 'Amigo'}` : 'Santuario Botánico'}
                  </span>
                  <span className="text-xs font-semibold text-neutral-300">
                    {completedPlantsCount}/6 Especies
                  </span>
                </div>
                <h2 className="text-xl font-bold tracking-tight">
                  {completedPlantsCount === 0
                    ? 'Tu primer cultivo en marcha'
                    : `${completedPlantsCount} ${completedPlantsCount === 1 ? 'espécimen madurado' : 'especímenes madurados'}`}
                </h2>
                <p className="text-xs text-emerald-200/80 leading-relaxed">
                  Cada 30 riegos se completa una planta y se traslada a este jardín permanente como símbolo de perseverancia.
                </p>
              </div>

              {/* GRID DE ESPECIES DEL JARDÍN */}
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
                      className={`bg-white border rounded-3xl p-4 flex flex-col justify-between space-y-2 transition-all cursor-pointer ${
                        isHarvested
                          ? 'border-emerald-200/80 shadow-xs hover:border-emerald-400 hover:shadow-sm'
                          : isCurrentActive
                          ? 'border-emerald-700/60 shadow-xs ring-1 ring-emerald-700/20'
                          : 'border-neutral-200/60 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <span className="text-[10px] font-bold text-neutral-400">
                          #{idx + 1}
                        </span>
                        {isHarvested ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-bold flex items-center gap-1">
                            <Check className="w-2.5 h-2.5 stroke-[3]" /> Madura
                          </span>
                        ) : isCurrentActive ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[9px] font-bold animate-pulse">
                            En cultivo ({currentPlantStage}/30)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 text-[9px] font-medium flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" /> Bloqueada
                          </span>
                        )}
                      </div>

                      {/* Miniatura visual de la planta */}
                      <div className="py-2 flex justify-center">
                        <GardenPlantVisualizer
                          stage={stageForVisualizer}
                          speciesIndex={idx}
                          size="sm"
                        />
                      </div>

                      <div>
                        <h3 className="text-xs font-bold text-neutral-950 truncate">
                          {species.name}
                        </h3>
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
        </main>
      )}

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
      <BottomNav
        currentTab="plant"
        userRole={isGuardian ? 'friend' : 'smoker'}
      />
    </div>
  )
}
