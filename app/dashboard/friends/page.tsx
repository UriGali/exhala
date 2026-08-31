'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Home,
  Users,
  Award,
  User,
  Droplets,
  Check,
  Share2,
  Copy,
  CheckCheck,
  X,
  UserPlus,
  Sparkles,
  MessageCircle,
} from 'lucide-react'
import confetti from 'canvas-confetti'
import { supabase } from '@/lib/supabase/client'
import { Profile } from '@/types/database.types'
import FriendChatModal from '@/components/FriendChatModal'

type InviteTab = 'share' | 'join'

interface QuittingFriend {
  id: string
  initials: string
  name: string
  status: string
  avatarBg: string
  avatarText: string
  isWatered: boolean
}

interface SupportingFriend {
  id: string
  initials: string
  name: string
  status: string
  avatarBg: string
  avatarText: string
  isWatered: boolean
}

const isValidUUID = (id?: string | null): boolean => {
  if (!id) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

// Lista 1: Dejando de fumar con UUIDs válidos por defecto
const DEFAULT_QUITTING_FRIENDS: QuittingFriend[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    initials: 'MC',
    name: 'Marta Coll',
    status: '12 días sin fumar',
    avatarBg: 'bg-emerald-100',
    avatarText: 'text-emerald-800',
    isWatered: false,
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    initials: 'JP',
    name: 'Jordi Pons',
    status: '8 días sin fumar',
    avatarBg: 'bg-amber-100',
    avatarText: 'text-amber-800',
    isWatered: false,
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    initials: 'LV',
    name: 'Laura Vidal',
    status: '3 días sin fumar',
    avatarBg: 'bg-sky-100',
    avatarText: 'text-sky-800',
    isWatered: false,
  },
]

// Lista 2: Apoyando con UUID válido por defecto
const DEFAULT_SUPPORTING_FRIENDS: SupportingFriend[] = [
  {
    id: '00000000-0000-4000-8000-000000000004',
    initials: 'DR',
    name: 'David Roca',
    status: 'Apoya a Marta',
    avatarBg: 'bg-neutral-100',
    avatarText: 'text-neutral-700',
    isWatered: false,
  },
]

export default function FriendsDashboard() {
  const router = useRouter()
  const [activeTab] = useState<'home' | 'friends' | 'badges' | 'profile'>('friends')
  const [loading, setLoading] = useState<boolean>(true)

  // Datos reales del usuario logueado
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [squadCode, setSquadCode] = useState<string>('')
  const [copiedCode, setCopiedCode] = useState<boolean>(false)
  const [showInviteModal, setShowInviteModal] = useState<boolean>(false)
  const [inviteTab, setInviteTab] = useState<InviteTab>('share')
  const [friendCodeInput, setFriendCodeInput] = useState<string>('')
  const [isConnecting, setIsConnecting] = useState<boolean>(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [connectSuccess, setConnectSuccess] = useState<boolean>(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [activeChatFriend, setActiveChatFriend] = useState<QuittingFriend | SupportingFriend | null>(null)

  // Lista 1: Dejando de fumar
  const [quittingFriends, setQuittingFriends] = useState<QuittingFriend[]>(DEFAULT_QUITTING_FRIENDS)

  // Lista 2: Apoyando
  const [supportingFriends, setSupportingFriends] = useState<SupportingFriend[]>(DEFAULT_SUPPORTING_FRIENDS)

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
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
          setSquadCode(`EXHALA-${user.id.slice(0, 5).toUpperCase()}`)

          // Cargar amistades reales de la base de datos
          const { data: realFriendships } = await supabase
            .from('friendships')
            .select(`
              id,
              smoker_id,
              friend_id,
              smoker:profiles!friendships_smoker_id_fkey(id, full_name, role, smoke_free_since),
              friend:profiles!friendships_friend_id_fkey(id, full_name, role, smoke_free_since)
            `)
            .or(`smoker_id.eq.${user.id},friend_id.eq.${user.id}`)

          // Lista base de amigos (sin incluir jamás al usuario actual)
          let currentList: QuittingFriend[] = [...DEFAULT_QUITTING_FRIENDS].filter(
            (item) => item.id !== user.id && item.id !== 'user-current'
          )
          let currentSupporters: SupportingFriend[] = [...DEFAULT_SUPPORTING_FRIENDS].filter(
            (item) => item.id !== user.id && item.id !== 'user-current'
          )

          // Si hay amigos reales vinculados en Supabase, agregarlos a las listas
          if (realFriendships && realFriendships.length > 0) {
            realFriendships.forEach((f: any) => {
              const otherProfile = f.smoker_id === user.id ? f.friend : f.smoker
              if (otherProfile && otherProfile.id && otherProfile.id !== user.id) {
                const friendName = otherProfile.full_name || 'Amigo'
                const initials = friendName
                  .split(' ')
                  .map((n: string) => n[0])
                  .join('')
                  .substring(0, 2)
                  .toUpperCase() || 'AM'

                if (otherProfile.role === 'friend') {
                  if (!currentSupporters.some((s) => s.id === otherProfile.id)) {
                    currentSupporters.push({
                      id: otherProfile.id,
                      initials,
                      name: friendName,
                      status: `Apoya a tu squad`,
                      avatarBg: 'bg-neutral-100',
                      avatarText: 'text-neutral-700',
                      isWatered: false,
                    })
                  }
                } else {
                  if (!currentList.some((q) => q.id === otherProfile.id)) {
                    const friendDiffMs = otherProfile.smoke_free_since
                      ? Math.max(0, Date.now() - new Date(otherProfile.smoke_free_since).getTime())
                      : 0
                    const friendDays = Math.floor(friendDiffMs / (1000 * 60 * 60 * 24))

                    currentList.push({
                      id: otherProfile.id,
                      initials,
                      name: friendName,
                      status: `${friendDays} días sin fumar`,
                      avatarBg: 'bg-emerald-100',
                      avatarText: 'text-emerald-800',
                      isWatered: false,
                    })
                  }
                }
              }
            })
          }

          setQuittingFriends(currentList)
          setSupportingFriends(currentSupporters)
        }
      } catch (err) {
        console.error('Error loading friends:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router])

  // Acción interactiva de regar / apoyar
  const handleToggleWater = async (id: string, name: string, isQuitting: boolean) => {
    if (isQuitting) {
      setQuittingFriends((prev) =>
        prev.map((f) => (f.id === id ? { ...f, isWatered: !f.isWatered } : f))
      )
    } else {
      setSupportingFriends((prev) =>
        prev.map((f) => (f.id === id ? { ...f, isWatered: !f.isWatered } : f))
      )
    }

    // Registrar en Supabase solo si son UUIDs reales
    if (userId && isValidUUID(id) && isValidUUID(userId) && id !== userId) {
      try {
        await supabase.from('plant_actions').insert({
          smoker_id: id,
          friend_id: userId,
          action_type: 'water',
        })
      } catch {}
    }

    // Confeti sutil
    try {
      confetti({
        particleCount: 25,
        spread: 50,
        origin: { y: 0.65 },
        colors: ['#2D6A4F', '#52B788', '#38BDF8'],
        disableForReducedMotion: true,
      })
    } catch {}

    setToastMessage(`Has enviado apoyo a ${name.split(' ')[0]} 💧`)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const handleCopyCode = () => {
    if (squadCode) {
      navigator.clipboard.writeText(squadCode)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    }
  }

  // Conectar con un amigo por su código
  const handleConnectFriend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId || !friendCodeInput.trim()) return

    setIsConnecting(true)
    setConnectError(null)
    setConnectSuccess(false)

    try {
      // Extraer el ID del código (EXHALA-XXXXX donde XXXXX son los primeros 5 chars del UUID)
      const inputCode = friendCodeInput.trim().toUpperCase()

      if (!inputCode.startsWith('EXHALA-') || inputCode.length < 13) {
        throw new Error('Código no válido. El formato es EXHALA-XXXXX.')
      }

      // Buscar el perfil cuyo id comience con ese prefijo
      const prefix = inputCode.replace('EXHALA-', '').toLowerCase()

      const { data: matchedProfiles, error: searchError } = await supabase
        .from('profiles')
        .select('id, full_name, role')

      if (searchError) throw searchError

      const matchedProfile = matchedProfiles?.find(
        (p) => p.id.toLowerCase().startsWith(prefix)
      )

      if (!matchedProfile) {
        throw new Error('No se encontró ningún usuario con ese código.')
      }

      if (matchedProfile.id === userId) {
        throw new Error('No puedes añadirte a ti mismo como amigo.')
      }

      // Crear vínculo de amistad en la tabla friendships
      const { error: friendshipError } = await supabase
        .from('friendships')
        .insert({
          smoker_id: matchedProfile.id,
          friend_id: userId,
        })

      if (friendshipError) {
        if (friendshipError.code === '23505') {
          throw new Error('Ya estás conectado con este usuario.')
        }
        throw friendshipError
      }

      setConnectSuccess(true)
      setFriendCodeInput('')
      setToastMessage(`¡Conectado con ${matchedProfile.full_name || 'tu amigo'} con éxito! 🎉`)
      setTimeout(() => {
        setShowInviteModal(false)
        setConnectSuccess(false)
        setToastMessage(null)
      }, 2500)
    } catch (err: any) {
      console.error('Error connecting friend:', err)
      setConnectError(err.message || 'Error al conectar. Inténtalo de nuevo.')
    } finally {
      setIsConnecting(false)
    }
  }

  const totalConnections = quittingFriends.length + supportingFriends.length

  if (loading) {
    return (
      <div className="min-h-[100dvh] w-full bg-[#F8FAF9] flex flex-col items-center justify-center max-w-md mx-auto p-6 space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-white border border-neutral-200 shadow-sm flex items-center justify-center animate-pulse">
          <Users className="w-6 h-6 text-neutral-900" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
          Cargando amigos...
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] w-full bg-[#F8FAF9] text-neutral-900 flex flex-col justify-between max-w-md mx-auto relative antialiased select-none pb-24">
      {/* NOTIFICACIÓN TOAST MINIMALISTA */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-sm bg-neutral-950 text-white text-xs py-3 px-4 rounded-2xl shadow-lg flex items-center gap-2.5 animate-in fade-in slide-in-from-top duration-300">
          <div className="w-4 h-4 rounded-full bg-emerald-400/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Check className="w-3 h-3" />
          </div>
          <span className="font-medium leading-tight">{toastMessage}</span>
        </div>
      )}

      {/* CONTENEDOR PRINCIPAL FLOTANTE */}
      <main className="flex-1 px-5 pt-8 pb-4 flex flex-col">
        <div className="bg-white border border-neutral-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between flex-1">
          <div className="space-y-6">
            
            {/* CABECERA */}
            <div className="space-y-0.5">
              <h1 className="text-2xl font-bold tracking-tight text-neutral-950 font-sans">
                Amigos
              </h1>
              <p className="text-xs text-neutral-400 font-medium">
                {totalConnections} conexiones
              </p>
            </div>

            {/* SECCIÓN: DEJANDO DE FUMAR */}
            <section className="space-y-3">
              <div className="border-b border-neutral-100 pb-2">
                <h2 className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                  Dejando de fumar
                </h2>
              </div>

              <div className="space-y-4 pt-1">
                {quittingFriends.map((friend) => (
                  <div
                    key={friend.id}
                    className="flex items-center justify-between group py-1"
                  >
                    <div
                      onClick={() => setActiveChatFriend(friend)}
                      className="flex items-center gap-3.5 flex-1 cursor-pointer"
                    >
                      {/* Avatar circular con iniciales */}
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold tracking-wider ${friend.avatarBg} ${friend.avatarText} shrink-0`}
                      >
                        {friend.initials}
                      </div>

                      {/* Nombre y estado */}
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-neutral-900 leading-tight flex items-center gap-1.5">
                          {friend.name}
                        </span>
                        <span className="text-xs text-neutral-400 font-normal mt-0.5">
                          {friend.status}
                        </span>
                      </div>
                    </div>

                    {/* Botones de acción a la derecha */}
                    <div className="flex items-center gap-1">
                      {/* Botón de Chat */}
                      <button
                        type="button"
                        onClick={() => setActiveChatFriend(friend)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-500 hover:text-emerald-700 hover:bg-emerald-50 active:scale-90 transition-all"
                        title={`Chatear con ${friend.name}`}
                        aria-label={`Abrir chat con ${friend.name}`}
                      >
                        <MessageCircle className="w-4 h-4 stroke-[2]" />
                      </button>

                      {/* Icono de check/gota interactivo */}
                      <button
                        type="button"
                        onClick={() => handleToggleWater(friend.id, friend.name, true)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-emerald-600 hover:bg-emerald-50 active:scale-90 transition-all"
                        title="Enviar apoyo / riego"
                      >
                        <Droplets className="w-4 h-4 fill-emerald-600/20 stroke-[2.2]" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* SECCIÓN: APOYANDO */}
            <section className="space-y-3 pt-2">
              <div className="border-b border-neutral-100 pb-2">
                <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                  Apoyando
                </h2>
              </div>

              <div className="space-y-4 pt-1">
                {supportingFriends.map((supporter) => (
                  <div
                    key={supporter.id}
                    className="flex items-center justify-between group py-1"
                  >
                    <div
                      onClick={() => setActiveChatFriend(supporter)}
                      className="flex items-center gap-3.5 flex-1 cursor-pointer"
                    >
                      {/* Avatar circular */}
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold tracking-wider ${supporter.avatarBg} ${supporter.avatarText} shrink-0`}
                      >
                        {supporter.initials}
                      </div>

                      {/* Nombre y estado */}
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-neutral-900 leading-tight">
                          {supporter.name}
                        </span>
                        <span className="text-xs text-neutral-400 font-normal mt-0.5">
                          {supporter.status}
                        </span>
                      </div>
                    </div>

                    {/* Acciones de Guardianes: botón de chat + etiqueta de rol */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveChatFriend(supporter)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-500 hover:text-sky-700 hover:bg-sky-50 active:scale-90 transition-all"
                        title={`Chatear con ${supporter.name}`}
                        aria-label={`Abrir chat con ${supporter.name}`}
                      >
                        <MessageCircle className="w-4 h-4 stroke-[2]" />
                      </button>

                      <span className="text-[10px] font-semibold text-sky-700 bg-sky-50 border border-sky-200/60 px-2 py-0.5 rounded-full">
                        Guardián
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* BOTÓN DE ACCIÓN: INVITAR A UN AMIGO */}
          <div className="pt-6 mt-auto">
            <button
              type="button"
              onClick={() => setShowInviteModal(true)}
              className="w-full h-12 bg-neutral-950 hover:bg-neutral-900 text-white font-medium text-sm rounded-2xl flex items-center justify-center gap-2 transition-transform active:scale-[0.98] shadow-xs"
            >
              <span>Invitar a un amigo</span>
            </button>
          </div>
        </div>
      </main>

      {/* MODAL PARA INVITAR AMIGO — DOS PESTAÑAS */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 space-y-4 animate-in slide-in-from-bottom duration-300">
            {/* Cabecera del modal */}
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-semibold text-neutral-950">
                  Conectar Amigos
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Comparte tu código o únete con el de un amigo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowInviteModal(false)
                  setConnectError(null)
                  setConnectSuccess(false)
                  setFriendCodeInput('')
                }}
                className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 hover:text-neutral-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Pestañas */}
            <div className="flex bg-neutral-100 rounded-2xl p-1">
              <button
                type="button"
                onClick={() => { setInviteTab('share'); setConnectError(null); setConnectSuccess(false) }}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
                  inviteTab === 'share'
                    ? 'bg-white shadow-xs text-neutral-950'
                    : 'text-neutral-500 hover:text-neutral-800'
                }`}
              >
                Mi Código
              </button>
              <button
                type="button"
                onClick={() => { setInviteTab('join'); setConnectError(null); setConnectSuccess(false) }}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
                  inviteTab === 'join'
                    ? 'bg-white shadow-xs text-neutral-950'
                    : 'text-neutral-500 hover:text-neutral-800'
                }`}
              >
                Unirme con Código
              </button>
            </div>

            {/* Pestaña 1: Compartir mi código */}
            {inviteTab === 'share' && (
              <div className="space-y-3">
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Comparte este código con tus amigos para que se unan a tu círculo de apoyo.
                </p>

                <div className="flex items-center justify-between bg-neutral-50 border border-neutral-200/80 rounded-2xl p-3">
                  <span className="font-mono text-sm font-bold tracking-wider text-neutral-950 px-1">
                    {squadCode || 'EXHALA-SQUAD'}
                  </span>

                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="px-3.5 py-1.5 bg-neutral-950 hover:bg-neutral-900 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all active:scale-95"
                  >
                    {copiedCode ? (
                      <>
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Pestaña 2: Unirme con el código de un amigo */}
            {inviteTab === 'join' && (
              <form onSubmit={handleConnectFriend} className="space-y-3">
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Introduce el código de invitación de tu amigo para agregarlo a tu red.
                </p>

                <input
                  type="text"
                  value={friendCodeInput}
                  onChange={(e) => {
                    setFriendCodeInput(e.target.value.toUpperCase())
                    setConnectError(null)
                    setConnectSuccess(false)
                  }}
                  placeholder="EXHALA-XXXXX"
                  maxLength={12}
                  className="w-full h-11 px-4 bg-neutral-50 border border-neutral-200 rounded-2xl text-sm font-mono text-neutral-950 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-950 transition-colors"
                />

                {connectError && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                    {connectError}
                  </p>
                )}

                {connectSuccess && (
                  <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 stroke-[3] shrink-0" />
                    ¡Conexión establecida con éxito!
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isConnecting || !friendCodeInput.trim()}
                  className="w-full h-11 bg-neutral-950 hover:bg-neutral-900 text-white font-medium text-xs rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {isConnecting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Conectando...</span>
                    </>
                  ) : (
                    <span>Conectar con amigo</span>
                  )}
                </button>
              </form>
            )}

            {/* Botón cerrar secundario */}
            <button
              type="button"
              onClick={() => {
                setShowInviteModal(false)
                setConnectError(null)
                setConnectSuccess(false)
                setFriendCodeInput('')
              }}
              className="w-full h-10 text-neutral-400 hover:text-neutral-700 font-medium text-xs transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE CHAT EN TIEMPO REAL */}
      {activeChatFriend && (
        <FriendChatModal
          friend={activeChatFriend}
          currentUserId={userId}
          currentUserName={profile?.full_name || 'Tú'}
          onClose={() => setActiveChatFriend(null)}
        />
      )}

      {/* BARRA DE NAVEGACIÓN INFERIOR */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-t border-neutral-100 py-2 max-w-md mx-auto">
        <div className="grid grid-cols-4 px-2">
          <Link
            href="/dashboard/smoker"
            className="flex flex-col items-center justify-center py-1.5 transition-colors text-neutral-400 hover:text-neutral-600"
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] mt-1">Inicio</span>
          </Link>

          <Link
            href="/dashboard/friends"
            className="flex flex-col items-center justify-center py-1.5 transition-colors text-neutral-950 font-medium"
          >
            <Users className="w-5 h-5" />
            <span className="text-[10px] mt-1">Amigos</span>
          </Link>

          <Link
            href="/dashboard/badges"
            className="flex flex-col items-center justify-center py-1.5 transition-colors text-neutral-400 hover:text-neutral-600"
          >
            <Award className="w-5 h-5" />
            <span className="text-[10px] mt-1">Logros</span>
          </Link>

          <Link
            href="/dashboard/profile"
            className="flex flex-col items-center justify-center py-1.5 transition-colors text-neutral-400 hover:text-neutral-600"
          >
            <User className="w-5 h-5" />
            <span className="text-[10px] mt-1">Perfil</span>
          </Link>
        </div>
      </nav>
    </div>
  )
}
