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

      // Count connected friends (both smoker and friend roles)
      const { data: friendships } = await supabase
        .from('friendships')
        .select('friend_id, smoker_id')
        .or(`smoker_id.eq.${user.id},friend_id.eq.${user.id}`)
        .eq('status', 'accepted')
      const uniqueFriendIds = Array.from(
        new Set((friendships || []).map((f) => (f.smoker_id === user.id ? f.friend_id : f.smoker_id)))
      )
      setFriendCount(uniqueFriendIds.length)
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
        // Fetch all friends connected to this smoker (bidirectional)
        const { data: friendships } = await supabase
          .from('friendships')
          .select('friend_id, smoker_id')
          .or(`smoker_id.eq.${currentUserId},friend_id.eq.${currentUserId}`)
          .eq('status', 'accepted')

        const friendIds = (friendships || []).map((f) =>
          f.smoker_id === currentUserId ? f.friend_id : f.smoker_id
        )
        const uniqueFriendIds = Array.from(new Set(friendIds))
        setFriendCount(uniqueFriendIds.length)

        if (uniqueFriendIds.length > 0) {
          const notifications = uniqueFriendIds.map((targetId) => ({
            smoker_id: currentUserId,
            friend_id: targetId,
            message: `${currentUserName} necesita apoyo urgente. ¡Tiene un momento de antojo!`,
          }))

          await supabase.from('sos_notifications').insert(notifications)

          // Disparar notificaciones Push Web reales a los móviles de los amigos
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
        className="fixed bottom-[68px] right-[max(16px,calc(50%-180px))] z-40 w-11 h-11 rounded-full bg-rose-500 shadow-lg shadow-rose-500/30 flex items-center justify-center text-white transition-all hover:bg-rose-600 active:scale-90 hover:shadow-rose-500/50 hover:shadow-xl group"
      >
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-400 rounded-full animate-ping opacity-75" />
        <HeartPulse className="w-5 h-5 group-hover:scale-110 transition-transform" />
      </button>

      {/* MODAL DIRECTO DE CONFIRMACIÓN Y APOYO (ESTÉTICA BOTÁNICA OSCURA) */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div
            className="w-full max-w-sm rounded-[28px] p-6 space-y-5 border border-[rgba(232,84,124,0.3)] relative shadow-2xl animate-in slide-in-from-bottom duration-300"
            style={{
              background: 'radial-gradient(circle at 50% 0%, #2A171D, #16241C)',
              color: '#F1EEE2',
            }}
          >
            {/* Botón cerrar esquina */}
            <button
              type="button"
              onClick={handleClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[#A9BBA4] hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {isSending ? (
              <div className="flex flex-col items-center justify-center py-10 space-y-3 text-center">
                <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
                  <Loader2 className="w-7 h-7 text-[#E8547C] animate-spin" />
                </div>
                <h3 className="text-base font-semibold text-[#F1EEE2]">
                  Enviando alerta SOS...
                </h3>
                <p className="text-xs text-[#7C9481]">
                  Conectando con tu red de guardianes
                </p>
              </div>
            ) : (
              <>
                {/* Cabecera con Icono de Éxito y Alerta */}
                <div className="flex flex-col items-center text-center pt-1 space-y-3">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shadow-xs">
                      <CheckCircle2 className="w-7 h-7 text-emerald-400 stroke-[2]" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#E8547C] border-2 border-[#16241C] flex items-center justify-center text-white">
                      <HeartPulse className="w-2.5 h-2.5 animate-pulse" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h3 className="font-fraunces text-lg font-medium tracking-tight text-[#F1EEE2]">
                      ¡Alerta SOS enviada!
                    </h3>
                    <p className="text-xs text-[#A9BBA4] leading-relaxed max-w-[270px]">
                      {friendCount > 0
                        ? `Tus amigos (${friendCount} ${friendCount === 1 ? 'conexión' : 'conexiones'}) han sido notificados para apoyarte en este momento de antojo.`
                        : 'Alerta registrada. Respira con calma, estás en el camino correcto.'}
                    </p>
                  </div>
                </div>

                {/* Tarjeta de apoyo y calma */}
                <div className="bg-white/5 border border-[rgba(232,183,94,0.15)] rounded-2xl p-3.5 space-y-1.5">
                  <div className="flex items-center gap-2 text-[#E8B75E] font-semibold text-xs">
                    <Sparkles className="w-4 h-4 text-[#E8B75E] shrink-0" />
                    <span>Recuerda: Este impulso pasará</span>
                  </div>
                  <p className="text-xs text-[#A9BBA4] leading-relaxed">
                    El pico de deseo dura entre <strong className="text-[#F1EEE2]">2 y 3 minutos</strong>. Tu mente está reescribiendo el hábito ahora mismo.
                  </p>
                </div>

                {/* Mini ejercicio de respiración opcional desplegable */}
                {showBreathingMini ? (
                  <div className="bg-black/30 border border-emerald-500/30 rounded-2xl p-4 flex flex-col items-center space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                        Respiración de rescate
                      </span>
                      <span className="font-mono text-xs font-bold text-[#E8B75E]">
                        {breathTimer}s
                      </span>
                    </div>

                    <div className="relative w-24 h-24 flex items-center justify-center">
                      <div
                        className={`absolute inset-0 rounded-full bg-emerald-500/20 transition-all duration-[4000ms] ${
                          breathPhase === 'Inhala'
                            ? 'scale-100 opacity-90 border border-emerald-400/50'
                            : breathPhase === 'Mantén'
                            ? 'scale-100 opacity-100 ring-2 ring-emerald-400'
                            : 'scale-60 opacity-40'
                        }`}
                      />
                      <span className="relative z-10 text-xs font-semibold text-[#F1EEE2]">
                        {breathPhase}
                      </span>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowBreathingMini(true)}
                    className="w-full py-2.5 px-3 rounded-2xl bg-white/5 border border-[rgba(232,183,94,0.2)] text-[#F1EEE2] hover:bg-white/10 text-xs font-medium flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Wind className="w-4 h-4 text-[#E8B75E]" />
                      <span>Hacer 1 minuto de respiración guiada</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-[#7C9481]" />
                  </button>
                )}

                {/* Botón de cierre primario */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="w-full h-11 bg-gradient-to-r from-[#EFC471] to-[#E8B75E] text-[#1B1710] font-semibold text-xs rounded-2xl transition-transform active:scale-[0.98] shadow-md cursor-pointer"
                  >
                    Entendido, me mantengo fuerte
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

