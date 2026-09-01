'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Home,
  Users,
  Award,
  User,
  LogOut,
  Calendar,
  DollarSign,
  Cigarette,
  Shield,
  Check,
  Loader2,
  AlertCircle,
  Mail,
  Sparkles,
  ArrowRight,
  HeartPulse,
  Bell,
  BellRing,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { Profile } from '@/types/database.types'
import { getPushPermission, requestPushPermissionAndSubscribe } from '@/lib/push-notifications'
import BottomNav from '@/components/BottomNav'

export default function ProfilePage() {
  const router = useRouter()
  const [activeTab] = useState<'home' | 'friends' | 'badges' | 'profile'>('profile')

  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string>('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  // Push Notifications state
  const [pushPermission, setPushPermission] = useState<string>('default')
  const [isActivatingPush, setIsActivatingPush] = useState<boolean>(false)
  const [pushFeedback, setPushFeedback] = useState<string | null>(null)

  // Formulario editable
  const [fullName, setFullName] = useState<string>('')
  const [smokeFreeDate, setSmokeFreeDate] = useState<string>('')
  const [cigsPerDay, setCigsPerDay] = useState<number>(15)
  const [packPrice, setPackPrice] = useState<number>(5.5)
  const [penaltyAmount, setPenaltyAmount] = useState<number>(1.0)
  
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    async function loadProfile() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
          router.push('/')
          return
        }

        setUserId(user.id)
        setUserEmail(user.email || '')
        setPushPermission(getPushPermission())

        const { data: userProfile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()

        if (userProfile) {
          setProfile(userProfile)
          setFullName(userProfile.full_name || '')
          setCigsPerDay(userProfile.cigs_per_day || 15)
          setPackPrice(Number(userProfile.pack_price) || 5.5)
          setPenaltyAmount(Number(userProfile.penalty_amount) || 1.0)

          if (userProfile.smoke_free_since) {
            setSmokeFreeDate(userProfile.smoke_free_since.slice(0, 10))
          } else {
            setSmokeFreeDate(new Date().toISOString().slice(0, 10))
          }
        }
      } catch (err) {
        console.error('Error loading profile:', err)
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [router])

  // Guardar cambios en profiles
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
      setStatusMessage({ type: 'success', text: '¡Perfil actualizado correctamente!' })
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
        setPushFeedback('¡Notificaciones activadas! Recibirás las alertas SOS de tus amigos.')
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

  if (loading) {
    return (
      <div className="min-h-[100dvh] w-full bg-[#F8FAF9] flex flex-col items-center justify-center max-w-md mx-auto p-6 space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-white border border-neutral-200 shadow-sm flex items-center justify-center animate-pulse">
          <User className="w-6 h-6 text-neutral-900" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
          Cargando tu perfil...
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
            Cuenta y Preferencias
          </span>
          <h1 className="text-xl font-medium tracking-tight text-neutral-950">
            Tu Perfil
          </h1>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={isLoggingOut}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-full text-xs font-medium transition-colors"
          title="Cerrar sesión"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>{isLoggingOut ? 'Saliendo...' : 'Salir'}</span>
        </button>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 flex flex-col px-6 py-4 space-y-5">
        
        {/* TARJETA RESUMEN DE USUARIO */}
        <section className="bg-white border border-neutral-200/80 rounded-3xl p-5 shadow-xs flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-neutral-950 text-white flex items-center justify-center text-xl font-semibold shrink-0 shadow-sm">
            {(fullName || 'U').charAt(0).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-neutral-950 truncate">
                {fullName || 'Compañero'}
              </h2>
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded-full text-[10px] font-semibold">
                {profile?.role === 'smoker' ? 'Fumador en racha' : 'Amigo guardián'}
              </span>
            </div>

            <div className="flex items-center gap-1 text-xs text-neutral-500 mt-1 truncate">
              <Mail className="w-3 h-3 shrink-0" />
              <span className="truncate">{userEmail}</span>
            </div>
          </div>
        </section>

        {/* FEEDBACK STATUS MESSAGE */}
        {statusMessage && (
          <div
            className={`p-3.5 rounded-2xl text-xs flex items-center gap-2.5 animate-in fade-in duration-200 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-700 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* SECCIÓN NOTIFICACIONES PUSH & AVISOS DE EMERGENCIA */}
        <section className="bg-white border border-neutral-200/80 rounded-3xl p-5 space-y-3.5 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
            <span className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
              Avisos & Alertas SOS
            </span>
            <Bell className="w-4 h-4 text-emerald-600" />
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 shrink-0 mt-0.5">
              <BellRing className="w-5 h-5" />
            </div>

            <div className="flex-1 space-y-1">
              <h3 className="text-sm font-semibold text-neutral-950">
                Notificaciones de Emergencia
              </h3>
              <p className="text-xs text-neutral-500 leading-relaxed">
                Recibe alertas instantáneas en tu navegador cuando tus amigos pulsen el botón SOS o necesiten apoyo.
              </p>
            </div>
          </div>

          {pushFeedback && (
            <p className="text-xs px-3.5 py-2 rounded-xl bg-neutral-100 text-neutral-800 font-medium animate-in fade-in duration-200">
              {pushFeedback}
            </p>
          )}

          {pushPermission === 'granted' ? (
            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200/80 rounded-2xl px-4 py-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-900">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Avisos de navegador activos</span>
              </div>
              <button
                type="button"
                onClick={handleActivatePush}
                disabled={isActivatingPush}
                className="text-[11px] text-emerald-800 underline font-medium hover:text-emerald-950"
              >
                Actualizar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleActivatePush}
              disabled={isActivatingPush}
              className="w-full h-11 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-2xl flex items-center justify-center gap-2 transition-transform active:scale-[0.98] shadow-xs"
            >
              {isActivatingPush ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Conectando...</span>
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4" />
                  <span>Activar avisos de emergencia</span>
                </>
              )}
            </button>
          )}
        </section>

        {/* FORMULARIO DE AJUSTES DEL HÁBITO */}
        <section className="bg-white border border-neutral-200/80 rounded-3xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
            <span className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
              Datos de Consumo & Ahorro
            </span>
            <Sparkles className="w-4 h-4 text-emerald-600" />
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-3.5">
            {/* Nombre */}
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Nombre o Apodo
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full h-11 px-3.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-neutral-900 focus:outline-none focus:border-neutral-900 transition-colors"
              />
            </div>

            {/* Fecha en que dejó de fumar */}
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1 flex items-center justify-between">
                <span>Fecha de inicio sin fumar</span>
                <span className="text-[10px] text-neutral-400">Último cigarrillo</span>
              </label>
              <input
                type="date"
                value={smokeFreeDate}
                onChange={(e) => setSmokeFreeDate(e.target.value)}
                required
                className="w-full h-11 px-3.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-neutral-900 focus:outline-none focus:border-neutral-900 transition-colors"
              />
            </div>

            {/* Cigarrillos diarios y Precio */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Cigarrillos / día
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={cigsPerDay}
                  onChange={(e) => setCigsPerDay(Number(e.target.value))}
                  required
                  className="w-full h-11 px-3.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-neutral-900 focus:outline-none focus:border-neutral-900 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Precio cajetilla (€)
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0.5"
                  max="50"
                  value={packPrice}
                  onChange={(e) => setPackPrice(Number(e.target.value))}
                  required
                  className="w-full h-11 px-3.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-neutral-900 focus:outline-none focus:border-neutral-900 transition-colors"
                />
              </div>
            </div>

            {/* Penalización por recaída */}
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1.5 flex items-center justify-between">
                <span>Aporte al bote por recaída</span>
                <span className="text-[10px] text-emerald-800 font-semibold">{penaltyAmount}€ por tropiezo</span>
              </label>

              <div className="grid grid-cols-4 gap-2">
                {[1.0, 3.0, 5.0, 10.0].map((amt) => {
                  const isSelected = penaltyAmount === amt
                  return (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setPenaltyAmount(amt)}
                      className={`py-2 rounded-xl border text-xs font-medium transition-all ${
                        isSelected
                          ? 'bg-neutral-950 text-white border-neutral-950 font-bold'
                          : 'bg-neutral-50 border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                      }`}
                    >
                      {amt}€
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Botón Guardar */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="w-full h-12 bg-neutral-950 text-white font-medium text-sm rounded-2xl flex items-center justify-center gap-2 transition-transform active:scale-[0.98] disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span>Guardar Preferencias</span>
                )}
              </button>
            </div>
          </form>
        </section>
      </main>

      {/* BARRA DE NAVEGACIÓN INFERIOR */}
      <BottomNav currentTab="profile" />
    </div>
  )
}
