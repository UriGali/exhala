'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  LogOut,
  Bell,
  BellRing,
  Sparkles,
  Check,
  AlertCircle,
  Mail,
  Loader2,
  Calendar,
  X,
  TrendingUp,
  Wallet,
  Coins,
  PiggyBank,
} from 'lucide-react'
import confetti from 'canvas-confetti'
import { supabase } from '@/lib/supabase/client'
import { Profile } from '@/types/database.types'
import { getPushPermission, requestPushPermissionAndSubscribe } from '@/lib/push-notifications'
import BottomNav from '@/components/BottomNav'
import { dispatchPushAlertToFriends } from '@/lib/push-notifications'

export default function ProfilePage() {
  const router = useRouter()

  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>('Compañero')
  const [userEmail, setUserEmail] = useState<string>('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  // Push Notifications state
  const [pushPermission, setPushPermission] = useState<string>('default')
  const [isActivatingPush, setIsActivatingPush] = useState<boolean>(false)
  const [pushFeedback, setPushFeedback] = useState<string | null>(null)
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0)

  // Formulario editable
  const [fullName, setFullName] = useState<string>('')
  const [smokeFreeDate, setSmokeFreeDate] = useState<string>('')
  const [cigsPerDay, setCigsPerDay] = useState<number>(15)
  const [packPrice, setPackPrice] = useState<number>(5.5)
  const [penaltyAmount, setPenaltyAmount] = useState<number>(1.0)

  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // SOS Crisis modal
  const [sosOpen, setSosOpen] = useState<boolean>(false)
  const [sosSending, setSosSending] = useState<boolean>(false)
  const [sosBreathPhase, setSosBreathPhase] = useState<'Inhala' | 'Mantén' | 'Exhala'>('Inhala')
  const [sosBreathTimer, setSosBreathTimer] = useState<number>(60)

  useEffect(() => {
    async function loadProfile() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
          await supabase.auth.signOut().catch(() => {})
          router.push('/')
          return
        }

        setUserId(user.id)
        setUserEmail(user.email || '')
        setPushPermission(getPushPermission())

        const { data: userProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()

        if (userProfile) {
          setProfile(userProfile)
          setFullName(userProfile.full_name || '')
          if (userProfile.full_name) setUserName(userProfile.full_name)
          setCigsPerDay(userProfile.cigs_per_day || 15)
          setPackPrice(Number(userProfile.pack_price) || 5.5)
          setPenaltyAmount(Number(userProfile.penalty_amount) || 1.0)

          if (userProfile.smoke_free_since) {
            setSmokeFreeDate(userProfile.smoke_free_since.slice(0, 10))
          } else {
            setSmokeFreeDate(new Date().toISOString().slice(0, 10))
          }
        }

        // Cargar notificaciones no leídas
        const lastRead =
          typeof window !== 'undefined'
            ? localStorage.getItem('last_read_notifications_at') ||
              new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
            : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

        const { count: unreadWater } = await supabase
          .from('plant_actions')
          .select('id', { count: 'exact', head: true })
          .eq('smoker_id', user.id)
          .neq('friend_id', user.id)
          .gt('created_at', lastRead)

        const { count: unreadSos } = await supabase
          .from('sos_notifications')
          .select('id', { count: 'exact', head: true })
          .eq('friend_id', user.id)
          .gt('created_at', lastRead)

        setUnreadNotificationsCount((unreadWater || 0) + (unreadSos || 0))
      } catch (err) {
        console.error('Error loading profile:', err)
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [router])

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

  // Guardar cambios
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return

    setIsSaving(true)
    setStatusMessage(null)

    try {
      const dateIso = smokeFreeDate
        ? new Date(smokeFreeDate + 'T00:00:00').toISOString()
        : new Date().toISOString()

      const payload = {
        id: userId,
        full_name: fullName.trim() || 'Compañero',
        smoke_free_since: dateIso,
        cigs_per_day: Number(cigsPerDay) || 15,
        pack_price: Number(packPrice) || 5.5,
        penalty_amount: Number(penaltyAmount) || 1.0,
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('profiles')
        .upsert(payload)
        .select()
        .single()

      if (error) throw error

      setProfile(data)
      setStatusMessage({ type: 'success', text: '¡Cambios guardados con éxito!' })
      try {
        confetti({
          particleCount: 30,
          spread: 60,
          origin: { y: 0.65 },
          colors: ['#E8B75E', '#A9BBA4', '#52B788'],
        })
      } catch {}
      setTimeout(() => setStatusMessage(null), 3000)
    } catch (err: any) {
      console.error('Error saving profile:', err)
      setStatusMessage({
        type: 'error',
        text: err.message || 'No se pudieron guardar los cambios. Inténtalo de nuevo.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Activar Notificaciones Push Web
  const handleActivatePush = async () => {
    if (!userId) return
    setIsActivatingPush(true)
    setPushFeedback(null)

    try {
      const result = await requestPushPermissionAndSubscribe(userId)
      setPushPermission(result.permission)

      if (result.success) {
        setPushFeedback('¡Todas las notificaciones activadas con éxito! Recibirás avisos de historias, grupos, mensajes y SOS.')
      } else {
        setPushFeedback(result.error || 'No se pudieron activar las notificaciones.')
      }
    } catch (err: any) {
      console.error('Error activating push:', err)
      setPushFeedback(err.message || 'Error al solicitar permisos.')
    } finally {
      setIsActivatingPush(false)
      setTimeout(() => setPushFeedback(null), 4000)
    }
  }

  // Cerrar sesión
  const handleSignOut = async () => {
    setIsLoggingOut(true)
    try {
      await supabase.auth.signOut()
      router.push('/')
    } catch (err) {
      console.error('Error signing out:', err)
      setIsLoggingOut(false)
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

  // Calcular días sin fumar y ganancias financieras por abstinencia
  const daysClean = profile?.smoke_free_since
    ? Math.max(0, Math.floor((Date.now() - new Date(profile.smoke_free_since).getTime()) / (1000 * 60 * 60 * 24)))
    : 0

  const userCigsPerDay = profile?.cigs_per_day || cigsPerDay || 15
  const userPackPrice = Number(profile?.pack_price) || packPrice || 5.5
  const costPerCigarette = userPackPrice / 20
  const dailySavings = userCigsPerDay * costPerCigarette
  const totalMoneySaved = daysClean * dailySavings
  const totalCigsAvoided = daysClean * userCigsPerDay
  const packsAvoided = (totalCigsAvoided / 20).toFixed(1)
  const monthlyProjected = dailySavings * 30
  const yearlyProjected = dailySavings * 365

  if (loading) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center p-4"
        style={{
          background: 'radial-gradient(120% 90% at 50% -10%, #223729 0%, #16241C 45%, #0F1913 100%)',
        }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full border-2 border-[#E8B75E]/30 border-t-[#E8B75E] animate-spin" />
          <p className="font-fraunces text-sm text-[#A9BBA4]">Cargando tu Perfil...</p>
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
      {/* PANTALLA CONTENEDORA (390px) */}
      <div
        className="w-full sm:w-[390px] min-h-screen sm:min-h-[844px] relative flex flex-col sm:rounded-[34px] overflow-hidden sm:border sm:border-[rgba(232,183,94,0.08)] sm:shadow-[0_40px_80px_rgba(0,0,0,0.5)] pb-[110px]"
        style={{
          background: 'radial-gradient(120% 90% at 50% -10%, #223729 0%, #16241C 45%, #0F1913 100%)',
        }}
      >
        {/* TEXTURA SUTIL DE LUZ Y HOJAS */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 12% 6%, rgba(232,183,94,0.06), transparent 38%), radial-gradient(circle at 90% 96%, rgba(167,150,216,0.05), transparent 42%)',
          }}
        />

        {/* =================================================================== */}
        {/* 1. CABECERA                                                         */}
        {/* =================================================================== */}
        <header className="pt-[22px] px-[24px] pb-0 relative z-10 flex items-center justify-between">
          <div>
            <h1 className="font-fraunces font-medium text-[22px] text-[#F1EEE2] tracking-tight">
              Perfil
            </h1>
            <p className="text-[12px] text-[#7C9481]">Cuenta y preferencias</p>
          </div>

          <div className="flex items-center gap-[8px]">
            {/* Campana de Notificaciones */}
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
              className="w-[34px] h-[34px] rounded-full border border-[rgba(232,183,94,0.16)] bg-[rgba(255,255,255,0.02)] flex items-center justify-center text-[14px] text-[#A9BBA4] hover:text-[#E8B75E] transition-all cursor-pointer relative"
              title="Notificaciones"
            >
              🔔
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-[2px] -right-[2px] w-[14px] h-[14px] rounded-full bg-[#E8547C] text-white text-[8.5px] font-bold flex items-center justify-center border-2 border-[#16241C]">
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </span>
              )}
            </button>

            {/* Salir */}
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isLoggingOut}
              className="h-[34px] px-3 rounded-full border border-[rgba(232,84,124,0.3)] bg-[rgba(232,84,124,0.08)] text-[#E8547C] hover:bg-[rgba(232,84,124,0.16)] flex items-center gap-1 text-xs font-medium transition-all cursor-pointer"
              title="Cerrar sesión"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{isLoggingOut ? '...' : 'Salir'}</span>
            </button>
          </div>
        </header>

        {/* =================================================================== */}
        {/* 2. CONTENIDO PRINCIPAL SCROLLABLE                                   */}
        {/* =================================================================== */}
        <div className="flex-1 px-[24px] pt-[18px] pb-[16px] space-y-4 overflow-y-auto no-scrollbar relative z-10">
          
          {/* TARJETA DE USUARIO */}
          <div
            className="rounded-[22px] p-[16px] border border-[rgba(232,183,94,0.14)] flex items-center gap-[14px]"
            style={{
              background: 'linear-gradient(180deg, rgba(232,183,94,0.06), rgba(255,255,255,0.01))',
            }}
          >
            <div
              className="w-[50px] h-[50px] rounded-full flex items-center justify-center text-[16px] font-semibold text-[#1B1710] shrink-0"
              style={{
                background: 'radial-gradient(circle at 35% 30%, #EFC471, #E8B75E)',
              }}
            >
              {(fullName || 'U').charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="font-fraunces font-medium text-[16px] text-[#F1EEE2] truncate">
                  {fullName || 'Compañero'}
                </h2>
              </div>

              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-semibold text-[#A796D8] border border-[rgba(167,150,216,0.35)] bg-[rgba(167,150,216,0.08)] py-[1px] px-[7px] rounded-full">
                  {profile?.role === 'smoker' ? 'Fumador en libertad' : 'Guardián de apoyo'}
                </span>
                {profile?.role === 'smoker' && (
                  <span className="text-[11px] text-[#E8B75E] font-medium">
                    {daysClean} {daysClean === 1 ? 'día libre' : 'días libres'}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 text-[11.5px] text-[#7C9481] mt-1 truncate">
                <Mail className="w-3 h-3 shrink-0" />
                <span className="truncate">{userEmail}</span>
              </div>
            </div>
          </div>

          {/* STATUS MESSAGE FEEDBACK */}
          {statusMessage && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2.5 animate-in fade-in duration-200 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* TARJETA: TODAS LAS NOTIFICACIONES EN TIEMPO REAL */}
          <div
            className="rounded-[24px] p-[18px] border border-[rgba(232,183,94,0.16)] space-y-3.5 shadow-lg relative overflow-hidden"
            style={{
              background: 'radial-gradient(120% 90% at 50% -10%, rgba(232,183,94,0.08) 0%, rgba(22,36,28,0.6) 60%, rgba(15,25,19,0.85) 100%)',
            }}
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-[rgba(232,183,94,0.1)]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[rgba(232,183,94,0.14)] border border-[rgba(232,183,94,0.25)] flex items-center justify-center text-[#E8B75E]">
                  <Bell className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-[12.5px] font-semibold text-[#F1EEE2]">
                    Notificaciones en Tiempo Real
                  </span>
                  <p className="text-[10px] text-[#7C9481]">
                    Avisos en tu dispositivo
                  </p>
                </div>
              </div>

              {pushPermission === 'granted' ? (
                <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  ACTIVAS
                </span>
              ) : (
                <span className="text-[10px] font-semibold text-[#E8B75E] bg-[rgba(232,183,94,0.12)] border border-[rgba(232,183,94,0.25)] px-2 py-0.5 rounded-full">
                  SIN ACTIVAR
                </span>
              )}
            </div>

            <p className="text-[12px] text-[#A9BBA4] leading-relaxed">
              Recibe avisos instantáneos cuando tus amigos suban una historia, hablen en tus grupos, te añadan a un grupo, rieguen tu jardín o pulsen el botón SOS.
            </p>

            {/* CHIPS DE ALERTAS INCLUIDAS */}
            <div className="grid grid-cols-2 gap-1.5 py-0.5">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-black/25 border border-white/5 text-[11px] text-[#D8E2D5]">
                <span>📸</span>
                <span className="truncate">Historias de amigos</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-black/25 border border-white/5 text-[11px] text-[#D8E2D5]">
                <span>👥</span>
                <span className="truncate">Nuevos grupos y chats</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-black/25 border border-white/5 text-[11px] text-[#D8E2D5]">
                <span>🚨</span>
                <span className="truncate">Alertas de crisis SOS</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-black/25 border border-white/5 text-[11px] text-[#D8E2D5]">
                <span>💧</span>
                <span className="truncate">Riegos en tu jardín</span>
              </div>
            </div>

            {pushFeedback && (
              <p className="text-xs px-3 py-2 rounded-xl bg-[rgba(232,183,94,0.1)] text-[#E8B75E] border border-[rgba(232,183,94,0.2)] flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 shrink-0 text-[#E8B75E]" />
                <span>{pushFeedback}</span>
              </p>
            )}

            {pushPermission === 'granted' ? (
              <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 shrink-0">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs text-emerald-300 font-semibold block">
                      Dispositivo sincronizado
                    </span>
                    <span className="text-[10.5px] text-[#7C9481]">
                      Recibirás todas las alertas en segundo plano
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleActivatePush}
                  disabled={isActivatingPush}
                  className="px-2.5 py-1.5 rounded-lg bg-[rgba(232,183,94,0.12)] hover:bg-[rgba(232,183,94,0.2)] border border-[rgba(232,183,94,0.25)] text-[11px] text-[#E8B75E] font-medium transition-all cursor-pointer shrink-0"
                >
                  {isActivatingPush ? 'Actualizando...' : 'Comprobar'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleActivatePush}
                disabled={isActivatingPush}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-[#E8B75E] via-[#F3CE7A] to-[#E8B75E] hover:from-[#E8B75E]/95 hover:to-[#F3CE7A]/95 text-[#1B1710] font-semibold text-[13px] rounded-2xl flex items-center justify-center gap-2.5 shadow-[0_6px_20px_rgba(232,183,94,0.28)] hover:shadow-[0_8px_25px_rgba(232,183,94,0.38)] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
              >
                {isActivatingPush ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#1B1710]" />
                    <span>Activando avisos...</span>
                  </>
                ) : (
                  <>
                    <div className="w-6 h-6 rounded-full bg-[#1B1710]/15 flex items-center justify-center">
                      <BellRing className="w-3.5 h-3.5 text-[#1B1710]" />
                    </div>
                    <span>Activar todas las notificaciones</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* TARJETA DE GANANCIAS Y DINERO AHORRADO EN TABACO */}
          <div
            className="rounded-[24px] p-[20px] border border-[rgba(232,183,94,0.18)] space-y-4 shadow-xl relative overflow-hidden"
            style={{
              background: 'radial-gradient(120% 90% at 50% -10%, rgba(232,183,94,0.1) 0%, rgba(22,36,28,0.7) 50%, rgba(15,25,19,0.9) 100%)',
            }}
          >
            {/* CABECERA DE GANANCIAS */}
            <div className="flex items-center justify-between pb-3 border-b border-[rgba(232,183,94,0.1)]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[rgba(232,183,94,0.12)] border border-[rgba(232,183,94,0.25)] flex items-center justify-center text-[#E8B75E]">
                  <Coins className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="font-fraunces font-medium text-[15.5px] text-[#F1EEE2] leading-tight">
                    Ganancias Acumuladas
                  </h3>
                  <span className="text-[10.5px] text-[#7C9481]">
                    Dinero no gastado en tabaco
                  </span>
                </div>
              </div>

              <span className="text-[10px] font-semibold tracking-wider text-[#52B788] bg-[rgba(82,183,136,0.12)] border border-[rgba(82,183,136,0.25)] px-2 py-0.5 rounded-full">
                AHORRO REAL
              </span>
            </div>

            {/* HERO STAT: TOTAL DINERO GANADO */}
            <div className="text-center py-2 space-y-1">
              <span className="text-[11.5px] text-[#A9BBA4] uppercase tracking-wider font-medium">
                Has retenido en tu bolsillo
              </span>
              <div className="font-fraunces font-bold text-[36px] text-[#E8B75E] tracking-tight drop-shadow-[0_2px_12px_rgba(232,183,94,0.25)]">
                +{totalMoneySaved.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
              </div>
              <p className="text-[12px] text-[#7C9481]">
                En tus <strong className="text-[#F1EEE2] font-semibold">{daysClean} {daysClean === 1 ? 'día' : 'días'}</strong> de libertad sin fumar
              </p>
            </div>

            {/* GRID DE MÉTRICAS COMPLEMENTARIAS */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="p-2.5 rounded-xl bg-black/25 border border-[rgba(232,183,94,0.1)] text-center">
                <span className="text-[10px] text-[#7C9481] block truncate">No fumados</span>
                <span className="font-fraunces font-semibold text-[15px] text-[#F1EEE2] block mt-0.5">
                  {totalCigsAvoided.toLocaleString('es-ES')}
                </span>
                <span className="text-[9.5px] text-[#A9BBA4]">cigarrillos</span>
              </div>

              <div className="p-2.5 rounded-xl bg-black/25 border border-[rgba(232,183,94,0.1)] text-center">
                <span className="text-[10px] text-[#7C9481] block truncate">Ahorro / día</span>
                <span className="font-fraunces font-semibold text-[15px] text-[#E8B75E] block mt-0.5">
                  {dailySavings.toFixed(2)} €
                </span>
                <span className="text-[9.5px] text-[#A9BBA4]">cada día</span>
              </div>

              <div className="p-2.5 rounded-xl bg-black/25 border border-[rgba(232,183,94,0.1)] text-center">
                <span className="text-[10px] text-[#7C9481] block truncate">Cajetillas</span>
                <span className="font-fraunces font-semibold text-[15px] text-[#52B788] block mt-0.5">
                  {packsAvoided}
                </span>
                <span className="text-[9.5px] text-[#A9BBA4]">evitadas</span>
              </div>
            </div>

            {/* PROYECCIÓN DE FUTURO */}
            <div className="p-3.5 rounded-2xl bg-[rgba(255,255,255,0.02)] border border-[rgba(232,183,94,0.12)] space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs text-[#A9BBA4] font-medium">
                <TrendingUp className="w-3.5 h-3.5 text-[#52B788]" />
                <span>Proyección de tu dinero si sigues así</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded-xl bg-black/30 border border-white/5 flex flex-col justify-between">
                  <span className="text-[10px] text-[#7C9481]">En 1 mes (30 días)</span>
                  <span className="font-fraunces font-bold text-[17px] text-[#F1EEE2] mt-1">
                    +{monthlyProjected.toFixed(0)} €
                  </span>
                </div>

                <div className="p-2 rounded-xl bg-black/30 border border-white/5 flex flex-col justify-between">
                  <span className="text-[10px] text-[#7C9481]">En 1 año (365 días)</span>
                  <span className="font-fraunces font-bold text-[17px] text-[#E8B75E] mt-1">
                    +{yearlyProjected.toFixed(0)} €
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-[#7C9481] text-center italic pt-0.5 leading-relaxed">
                🌿 Cada día limpio es salud para tus pulmones y libertad financiera para tu vida.
              </p>
            </div>

            <div className="h-4 shrink-0 pointer-events-none" />
          </div>
        </div>

        {/* =================================================================== */}
        {/* 3. BOTÓN FLOTANTE SOS (SOS FAB)                                     */}
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
          <span className="absolute -inset-[5px] rounded-full border-[1.5px] border-[rgba(232,84,124,0.28)] animate-pulse-ring pointer-events-none" />
        </button>

        {/* =================================================================== */}
        {/* 4. BARRA DE NAVEGACIÓN INFERIOR (3 MENÚS)                           */}
        {/* =================================================================== */}
        <BottomNav currentTab="profile" unreadFriendsCount={0} />
      </div>

      {/* =================================================================== */}
      {/* 5. MODAL SOS: RESPIRACIÓN EN CAJA DE 60s Y ALERTA A AMIGOS         */}
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
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 text-[#A9BBA4] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
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
              className="w-full py-3 bg-[rgba(232,183,94,0.15)] hover:bg-[rgba(232,183,94,0.25)] border border-[rgba(232,183,94,0.3)] text-[#E8B75E] text-xs font-semibold rounded-2xl transition-colors cursor-pointer"
            >
              Me siento más tranquilo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
