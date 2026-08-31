'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { HeartPulse, X, CheckCircle2, Loader2, Sparkles, Wind, ArrowRight } from 'lucide-react'
import confetti from 'canvas-confetti'
import { supabase } from '@/lib/supabase/client'
import { dispatchPushAlertToFriends } from '@/lib/push-notifications'

export default function SOSButton() {
  const [open, setOpen] = useState<boolean>(false)
  const [isSending, setIsSending] = useState<boolean>(false)
  const [friendCount, setFriendCount] = useState<number>(0)
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>('Un amigo')
  const [showBreathingMini, setShowBreathingMini] = useState<boolean>(false)

  // Mini breathing timer state
  const [breathPhase, setBreathPhase] = useState<'Inhala' | 'Mantén' | 'Exhala'>('Inhala')
  const [breathTimer, setBreathTimer] = useState<number>(60)

  // Load user info on mount
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle()
      if (profile?.full_name) setUserName(profile.full_name)

      // Count connected friends
      const { data: friendships } = await supabase
        .from('friendships')
        .select('friend_id')
        .eq('smoker_id', user.id)
      setFriendCount(friendships?.length ?? 0)
    }
    init()
  }, [])

  // Mini breathing cycle
  useEffect(() => {
    if (!open || !showBreathingMini || breathTimer <= 0) return

    const interval = setInterval(() => {
      setBreathTimer((t) => {
        const next = t - 1
        const elapsed = 60 - next
        const cycle = elapsed % 12
        if (cycle < 4) setBreathPhase('Inhala')
        else if (cycle < 8) setBreathPhase('Mantén')
        else setBreathPhase('Exhala')
        return next
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [open, showBreathingMini, breathTimer])

  // Direct trigger on click: immediately send SOS to all friends and show success modal
  const handleTriggerSOS = async () => {
    setOpen(true)
    setIsSending(true)
    setShowBreathingMini(false)
    setBreathTimer(60)

    try {
      let currentUserId = userId
      let currentUserName = userName

      if (!currentUserId) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          currentUserId = user.id
          setUserId(user.id)
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .maybeSingle()
          if (profile?.full_name) {
            currentUserName = profile.full_name
            setUserName(profile.full_name)
          }
        }
      }

      if (currentUserId) {
        // Fetch all friends connected to this smoker
        const { data: friendships } = await supabase
          .from('friendships')
          .select('friend_id')
          .eq('smoker_id', currentUserId)

        const count = friendships?.length ?? 0
        setFriendCount(count)

        if (friendships && friendships.length > 0) {
          const notifications = friendships.map((f) => ({
            smoker_id: currentUserId,
            friend_id: f.friend_id,
            message: `${currentUserName} necesita apoyo urgente. ¡Tiene un momento de antojo!`,
          }))

          await supabase.from('sos_notifications').insert(notifications)

          // Disparar notificaciones Push Web a los navegadores de los amigos
          try {
            await dispatchPushAlertToFriends(currentUserId, currentUserName)
          } catch (pushErr) {
            console.warn('Push notification delivery warning:', pushErr)
          }
        }
      }

      // Reassuring micro-confetti
      try {
        confetti({
          particleCount: 30,
          spread: 60,
          origin: { y: 0.7 },
          colors: ['#10B981', '#34D399', '#6EE7B7'],
          disableForReducedMotion: true,
        })
      } catch {}
    } catch (err) {
      console.error('Error sending SOS:', err)
    } finally {
      setIsSending(false)
    }
  }

  const handleClose = useCallback(() => {
    setOpen(false)
    setShowBreathingMini(false)
  }, [])

  return (
    <>
      {/* BOTÓN FLOTANTE FIJO SOS */}
      <button
        type="button"
        onClick={handleTriggerSOS}
        aria-label="Activar SOS inmediato — Enviar alerta a amigos"
        className="fixed bottom-[5.5rem] right-4 z-40 w-13 h-13 rounded-full bg-rose-500 shadow-lg shadow-rose-500/30 flex items-center justify-center text-white transition-all hover:bg-rose-600 active:scale-90 hover:shadow-rose-500/50 hover:shadow-xl group"
        style={{ width: 52, height: 52 }}
      >
        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-400 rounded-full animate-ping opacity-75" />
        <HeartPulse className="w-5 h-5 group-hover:scale-110 transition-transform" />
      </button>

      {/* MODAL DIRECTO DE CONFIRMACIÓN Y APOYO */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 space-y-5 animate-in slide-in-from-bottom duration-300 shadow-2xl relative">
            
            {/* Botón cerrar esquina */}
            <button
              type="button"
              onClick={handleClose}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 hover:text-neutral-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {isSending ? (
              <div className="flex flex-col items-center justify-center py-10 space-y-3 text-center">
                <div className="w-14 h-14 rounded-full bg-rose-50 flex items-center justify-center">
                  <Loader2 className="w-7 h-7 text-rose-500 animate-spin" />
                </div>
                <h3 className="text-base font-semibold text-neutral-900">
                  Enviando alerta SOS...
                </h3>
                <p className="text-xs text-neutral-400">
                  Conectando con tu red de guardianes
                </p>
              </div>
            ) : (
              <>
                {/* Cabecera con Icono de Éxito y Alerta */}
                <div className="flex flex-col items-center text-center pt-2 space-y-3">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center shadow-xs">
                      <CheckCircle2 className="w-8 h-8 text-emerald-600 stroke-[2]" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-rose-500 border-2 border-white flex items-center justify-center text-white">
                      <HeartPulse className="w-3 h-3 animate-pulse" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-lg font-bold tracking-tight text-neutral-950">
                      ¡Alerta SOS enviada!
                    </h3>
                    <p className="text-xs text-neutral-500 leading-relaxed max-w-[270px]">
                      {friendCount > 0
                        ? `Tus amigos (${friendCount} ${friendCount === 1 ? 'conexión' : 'conexiones'}) han sido notificados para apoyarte en este momento de antojo.`
                        : 'Alerta registrada. Respira con calma, estás en el camino correcto.'}
                    </p>
                  </div>
                </div>

                {/* Tarjeta de apoyo y calma */}
                <div className="bg-[#F8FAF9] border border-neutral-200/70 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-900 font-semibold text-xs">
                    <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Recuerda: Este impulso pasará</span>
                  </div>
                  <p className="text-xs text-neutral-600 leading-relaxed">
                    El pico de deseo dura entre <strong>2 y 3 minutos</strong>. Tu mente está reescribiendo el hábito ahora mismo.
                  </p>
                </div>

                {/* Mini ejercicio de respiración opcional desplegable */}
                {showBreathingMini ? (
                  <div className="bg-emerald-50/70 border border-emerald-200/70 rounded-2xl p-4 flex flex-col items-center space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider">
                        Respiración de rescate
                      </span>
                      <span className="font-mono text-xs font-bold text-emerald-700">
                        {breathTimer}s
                      </span>
                    </div>

                    <div className="relative w-24 h-24 flex items-center justify-center">
                      <div
                        className={`absolute inset-0 rounded-full bg-emerald-200/50 transition-all duration-[4000ms] ${
                          breathPhase === 'Inhala'
                            ? 'scale-100 opacity-90'
                            : breathPhase === 'Mantén'
                            ? 'scale-100 opacity-100 ring-2 ring-emerald-400'
                            : 'scale-60 opacity-40'
                        }`}
                      />
                      <span className="relative z-10 text-xs font-semibold text-emerald-950">
                        {breathPhase}
                      </span>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowBreathingMini(true)}
                    className="w-full py-2.5 px-3 rounded-2xl bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 text-xs font-medium flex items-center justify-between transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Wind className="w-4 h-4 text-emerald-600" />
                      <span>Hacer 1 minuto de respiración guiada</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-neutral-400" />
                  </button>
                )}

                {/* Botón de cierre primario */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="w-full h-12 bg-neutral-950 hover:bg-neutral-900 text-white font-medium text-xs rounded-2xl transition-transform active:scale-[0.98] shadow-xs"
                  >
                    Entendido, me mantengo fuerte 🌿
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

