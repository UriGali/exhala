'use client'

import React, { useState, useEffect, useCallback, useTransition, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Home,
  Users,
  Award,
  User,
  Droplets,
  Check,
  X,
  UserPlus,
  Sparkles,
  MessageCircle,
  Search,
  CheckCircle2,
  Clock,
  UserCheck,
  UserX,
  Loader2,
  Share2,
  Copy,
  CheckCheck,
  HeartHandshake,
  Bell,
  BellRing,
} from 'lucide-react'
import confetti from 'canvas-confetti'
import { supabase } from '@/lib/supabase/client'
import { Profile } from '@/types/database.types'
import FriendChatModal from '@/components/FriendChatModal'
import BottomNav from '@/components/BottomNav'
import { getPushPermission, requestPushPermissionAndSubscribe, isPushSupported } from '@/lib/push-notifications'

type TabView = 'friends' | 'requests'

interface FriendItem {
  id: string
  friendshipId: string
  initials: string
  name: string
  status: string
  role: 'smoker' | 'friend'
  avatarBg: string
  avatarText: string
  isWatered: boolean
  smokeFreeSince?: string | null
}

interface FriendRequestItem {
  id: string // friendship id
  requesterId: string
  name: string
  initials: string
  role: 'smoker' | 'friend'
  avatarBg: string
  avatarText: string
  createdAt: string
}

interface SearchResultUser {
  id: string
  full_name: string | null
  role: 'smoker' | 'friend'
  avatar_url: string | null
  smoke_free_since: string | null
}

const isValidUUID = (id?: string | null): boolean => {
  if (!id) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

const AVATAR_COLORS = [
  { bg: 'bg-emerald-100', text: 'text-emerald-800' },
  { bg: 'bg-teal-100', text: 'text-teal-800' },
  { bg: 'bg-sky-100', text: 'text-sky-800' },
  { bg: 'bg-amber-100', text: 'text-amber-800' },
  { bg: 'bg-rose-100', text: 'text-rose-800' },
  { bg: 'bg-indigo-100', text: 'text-indigo-800' },
]

function getAvatarColor(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length
  return AVATAR_COLORS[index]
}

function getInitials(name: string) {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase() || 'AM'
  )
}

// Datos de demostración iniciales (usados si aún no hay amigos en DB)
const DEFAULT_DEMO_FRIENDS: FriendItem[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    friendshipId: 'demo-1',
    initials: 'MC',
    name: 'Marta Coll',
    status: '12 días sin fumar',
    role: 'smoker',
    avatarBg: 'bg-emerald-100',
    avatarText: 'text-emerald-800',
    isWatered: false,
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    friendshipId: 'demo-2',
    initials: 'JP',
    name: 'Jordi Pons',
    status: '8 días sin fumar',
    role: 'smoker',
    avatarBg: 'bg-amber-100',
    avatarText: 'text-amber-800',
    isWatered: false,
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    friendshipId: 'demo-3',
    initials: 'LV',
    name: 'Laura Vidal',
    status: '3 días sin fumar',
    role: 'smoker',
    avatarBg: 'bg-sky-100',
    avatarText: 'text-sky-800',
    isWatered: false,
  },
  {
    id: '00000000-0000-4000-8000-000000000004',
    friendshipId: 'demo-4',
    initials: 'DR',
    name: 'David Roca',
    status: 'Guardián de apoyo',
    role: 'friend',
    avatarBg: 'bg-neutral-100',
    avatarText: 'text-neutral-700',
    isWatered: false,
  },
]

export default function FriendsDashboard() {
  const router = useRouter()
  const [currentTab, setCurrentTab] = useState<TabView>('friends')
  const [loading, setLoading] = useState<boolean>(true)

  // Usuario autenticado
  const [userId, setUserId] = useState<string | null>(null)
  const [userProfile, setUserProfile] = useState<Profile | null>(null)
  const [squadCode, setSquadCode] = useState<string>('')
  const [copiedCode, setCopiedCode] = useState<boolean>(false)

  // Listas de Amigos y Solicitudes
  const [friendsList, setFriendsList] = useState<FriendItem[]>(DEFAULT_DEMO_FRIENDS)
  const [pendingReceived, setPendingReceived] = useState<FriendRequestItem[]>([])
  const [pendingSent, setPendingSent] = useState<FriendRequestItem[]>([])

  // Modal de Búsqueda por Nombre
  const [showSearchModal, setShowSearchModal] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [searchResults, setSearchResults] = useState<SearchResultUser[]>([])
  const [isSearching, setIsSearching] = useState<boolean>(false)
  const [sentRequestMap, setSentRequestMap] = useState<Record<string, boolean>>({})

  // Chat & Toast
  const [activeChatFriend, setActiveChatFriend] = useState<FriendItem | null>(null)
  const activeChatFriendRef = useRef<FriendItem | null>(null)
  const lastReadTimestampsRef = useRef<Record<string, string>>({})
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const [pushPermission, setPushPermission] = useState<string>('default')
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)

  useEffect(() => {
    activeChatFriendRef.current = activeChatFriend
  }, [activeChatFriend])

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }, [])

  // Cargar conteo de mensajes no leídos por amigo de forma infalible
  const loadUnreadCounts = useCallback(async (currentUserId: string) => {
    try {
      const { data: unreadRows } = await supabase
        .from('messages')
        .select('id, sender_id, created_at')
        .eq('receiver_id', currentUserId)
        .is('read_at', null)

      const counts: Record<string, number> = {}
      unreadRows?.forEach((r) => {
        // Consultar marca temporal de última lectura en memoria o almacenamiento local
        let lastRead: string | null = lastReadTimestampsRef.current[r.sender_id] || null
        if (!lastRead && typeof window !== 'undefined') {
          lastRead = localStorage.getItem(`exhala_chat_read_${currentUserId}_${r.sender_id}`)
        }

        // Si el mensaje fue recibido antes o en el momento en que se abrió el chat, no contarlo
        if (lastRead && new Date(r.created_at).getTime() <= new Date(lastRead).getTime()) {
          return
        }

        // Si el modal de chat con este amigo está abierto en pantalla ahora mismo, no contarlo
        if (activeChatFriendRef.current?.id === r.sender_id) {
          return
        }

        counts[r.sender_id] = (counts[r.sender_id] || 0) + 1
      })

      // Asegurar que si el chat está activo, el badge sea 0
      if (activeChatFriendRef.current?.id) {
        counts[activeChatFriendRef.current.id] = 0
      }

      setUnreadCounts(counts)
    } catch (e) {
      console.warn('Could not load unread message counts:', e)
    }
  }, [])

  // Abrir chat y marcar mensajes de ese amigo como leídos
  const handleOpenChat = async (friend: FriendItem) => {
    const nowIso = new Date().toISOString()
    activeChatFriendRef.current = friend
    setActiveChatFriend(friend)

    // Guardar marca de tiempo de lectura
    lastReadTimestampsRef.current[friend.id] = nowIso
    if (typeof window !== 'undefined' && userId) {
      try {
        localStorage.setItem(`exhala_chat_read_${userId}_${friend.id}`, nowIso)
      } catch {}
    }

    // Quitar badge de la interfaz inmediatamente
    setUnreadCounts((prev) => {
      const updated = { ...prev }
      delete updated[friend.id]
      return updated
    })

    if (userId && isValidUUID(friend.id)) {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData.session?.access_token

        // 1. Llamada a endpoint API servidor
        fetch('/api/messages/read', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ senderId: friend.id, receiverId: userId }),
        }).catch(() => {})

        // 2. Llamada directa vía cliente Supabase
        supabase
          .from('messages')
          .update({ read_at: nowIso })
          .eq('sender_id', friend.id)
          .eq('receiver_id', userId)
          .is('read_at', null)
          .then(() => {})
      } catch (err) {
        console.warn('Could not mark messages as read:', err)
      }
    }
  }

  // Activar Notificaciones Push directamente
  const handleActivatePushNotification = async () => {
    if (!userId) return
    const res = await requestPushPermissionAndSubscribe(userId)
    setPushPermission(res.permission)
    if (res.success) {
      showToast('🔔 ¡Notificaciones activadas en este dispositivo!')
    } else {
      showToast(res.error || 'No se pudieron activar las notificaciones.')
    }
  }

  // Cargar amistades reales y solicitudes desde Supabase
  const loadFriendsData = useCallback(async (currentUserId: string) => {
    try {
      // 1. Obtener todas las filas de friendships donde participe el usuario
      const { data: friendships, error: friendshipsError } = await supabase
        .from('friendships')
        .select(`
          id,
          smoker_id,
          friend_id,
          status,
          created_at,
          smoker:profiles!friendships_smoker_id_fkey(id, full_name, role, smoke_free_since),
          friend:profiles!friendships_friend_id_fkey(id, full_name, role, smoke_free_since)
        `)
        .or(`smoker_id.eq.${currentUserId},friend_id.eq.${currentUserId}`)

      if (friendshipsError) {
        console.warn('Could not fetch real friendships:', friendshipsError)
        return
      }

      if (!friendships || friendships.length === 0) {
        // Dejar demo friends si no tiene conexiones
        return
      }

      const accepted: FriendItem[] = []
      const received: FriendRequestItem[] = []
      const sent: FriendRequestItem[] = []

      const seenAcceptedUserIds = new Set<string>()
      const seenReceivedUserIds = new Set<string>()
      const seenSentUserIds = new Set<string>()

      friendships.forEach((row: any) => {
        const isMeSender = row.smoker_id === currentUserId
        const otherUser = isMeSender ? row.friend : row.smoker

        if (!otherUser || !otherUser.id || otherUser.id === currentUserId) return

        const name = otherUser.full_name || 'Compañero'
        const initials = getInitials(name)
        const color = getAvatarColor(name)
        const status = row.status || 'accepted' // fallback for older rows

        if (status === 'accepted') {
          if (seenAcceptedUserIds.has(otherUser.id)) return
          seenAcceptedUserIds.add(otherUser.id)

          // Amistad activa
          let statusText = 'Guardián de apoyo'
          if (otherUser.role === 'smoker') {
            if (otherUser.smoke_free_since) {
              const diffMs = Math.max(0, Date.now() - new Date(otherUser.smoke_free_since).getTime())
              const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
              statusText = `${days} ${days === 1 ? 'día sin fumar' : 'días sin fumar'}`
            } else {
              statusText = 'En racha sin fumar'
            }
          }

          accepted.push({
            id: otherUser.id,
            friendshipId: row.id,
            initials,
            name,
            status: statusText,
            role: otherUser.role || 'smoker',
            avatarBg: color.bg,
            avatarText: color.text,
            isWatered: false,
            smokeFreeSince: otherUser.smoke_free_since,
          })
        } else if (status === 'pending') {
          // Solicitud pendiente
          if (isMeSender) {
            if (seenSentUserIds.has(otherUser.id)) return
            seenSentUserIds.add(otherUser.id)

            sent.push({
              id: row.id,
              requesterId: otherUser.id,
              name,
              initials,
              role: otherUser.role || 'smoker',
              avatarBg: color.bg,
              avatarText: color.text,
              createdAt: row.created_at,
            })
          } else {
            if (seenReceivedUserIds.has(otherUser.id)) return
            seenReceivedUserIds.add(otherUser.id)

            received.push({
              id: row.id,
              requesterId: otherUser.id,
              name,
              initials,
              role: otherUser.role || 'smoker',
              avatarBg: color.bg,
              avatarText: color.text,
              createdAt: row.created_at,
            })
          }
        }
      })

      if (accepted.length > 0) {
        setFriendsList(accepted)
      }
      setPendingReceived(received)
      setPendingSent(sent)
    } catch (err) {
      console.error('Error loading friends data:', err)
    }
  }, [])

  // Inicializar usuario autenticado
  useEffect(() => {
    async function init() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
          await supabase.auth.signOut().catch(() => {})
          router.push('/')
          return
        }

        setUserId(user.id)
        setSquadCode(`EXHALA-${user.id.slice(0, 5).toUpperCase()}`)

        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()

        if (profile) setUserProfile(profile)

        setPushPermission(getPushPermission())
        await loadFriendsData(user.id)
        await loadUnreadCounts(user.id)

        // Escuchar mensajes entrantes en tiempo real para notificaciones globales y contador rojo
        const inboxChannel = supabase
          .channel(`user-inbox-${user.id}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
              filter: `receiver_id=eq.${user.id}`,
            },
            async (payload: any) => {
              const newMsg = payload?.new
              if (!newMsg) return

              // Si el usuario ya está dentro del chat con este remitente, marcar como leído y no incrementar badge
              if (activeChatFriendRef.current?.id === newMsg.sender_id) {
                const nowIso = new Date().toISOString()
                lastReadTimestampsRef.current[newMsg.sender_id] = nowIso
                if (typeof window !== 'undefined') {
                  try {
                    localStorage.setItem(`exhala_chat_read_${user.id}_${newMsg.sender_id}`, nowIso)
                  } catch {}
                }

                fetch('/api/messages/read', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ senderId: newMsg.sender_id, receiverId: user.id }),
                }).catch(() => {})
                return
              }

              // Incrementar contador no leído para el remitente
              setUnreadCounts((prev) => ({
                ...prev,
                [newMsg.sender_id]: (prev[newMsg.sender_id] || 0) + 1,
              }))

              // Obtener nombre del remitente si está disponible
              const { data: senderProfile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', newMsg.sender_id)
                .maybeSingle()

              const senderName = senderProfile?.full_name || 'Un amigo'
              showToast(`💬 Mensaje de ${senderName}: "${newMsg.content.slice(0, 35)}${newMsg.content.length > 35 ? '...' : ''}"`)
            }
          )
          .subscribe()

        // Sincronización continua de mensajes no leídos cada 3.5s
        const unreadInterval = setInterval(() => {
          loadUnreadCounts(user.id)
        }, 3500)

        return () => {
          clearInterval(unreadInterval)
          supabase.removeChannel(inboxChannel)
        }
      } catch (err) {
        console.error('Error initializing friends page:', err)
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [router, loadFriendsData, loadUnreadCounts, showToast])

  // Búsqueda por Nombre en tiempo real
  useEffect(() => {
    if (!searchQuery.trim() || !userId) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const query = searchQuery.trim()
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, role, avatar_url, smoke_free_since')
          .ilike('full_name', `%${query}%`)
          .neq('id', userId)
          .limit(10)

        if (error) throw error
        setSearchResults(data || [])
      } catch (err) {
        console.error('Error searching users:', err)
      } finally {
        setIsSearching(false)
      }
    }, 280)

    return () => clearTimeout(timer)
  }, [searchQuery, userId])

  // Enviar solicitud de amistad por búsqueda
  const handleSendFriendRequest = async (targetUser: SearchResultUser) => {
    if (!userId || !targetUser.id || processingId) return
    setProcessingId(targetUser.id)

    try {
      const { data, error } = await supabase
        .from('friendships')
        .insert({
          smoker_id: userId,
          friend_id: targetUser.id,
          status: 'pending',
        })
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          showToast('Ya tienes una conexión o solicitud con este usuario.')
        } else {
          throw error
        }
      } else {
        setSentRequestMap((prev) => ({ ...prev, [targetUser.id]: true }))
        showToast(`¡Solicitud enviada a ${targetUser.full_name || 'tu amigo'}! 🌿`)

        try {
          confetti({
            particleCount: 25,
            spread: 50,
            origin: { y: 0.65 },
            colors: ['#10B981', '#34D399', '#6EE7B7'],
            disableForReducedMotion: true,
          })
        } catch {}

        // Recargar datos
        loadFriendsData(userId)
      }
    } catch (err: any) {
      console.error('Error sending friend request:', err)
      showToast(err.message || 'No se pudo enviar la solicitud.')
    } finally {
      setProcessingId(null)
    }
  }

  // Aceptar solicitud de amistad
  const handleAcceptRequest = async (request: FriendRequestItem) => {
    if (!userId || processingId) return
    setProcessingId(request.id)

    try {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', request.id)

      if (error) throw error

      showToast(`¡Ahora estás conectado con ${request.name}! 🤝`)

      try {
        confetti({
          particleCount: 40,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#10B981', '#059669', '#38BDF8'],
        })
      } catch {}

      // Actualizar estado local inmediato
      setPendingReceived((prev) => prev.filter((r) => r.id !== request.id))
      await loadFriendsData(userId)
    } catch (err: any) {
      console.error('Error accepting friend request:', err)
      showToast(err.message || 'Error al aceptar solicitud.')
    } finally {
      setProcessingId(null)
    }
  }

  // Rechazar / Cancelar solicitud
  const handleRejectRequest = async (requestId: string, isReceived: boolean) => {
    if (!userId || processingId) return
    setProcessingId(requestId)

    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', requestId)

      if (error) throw error

      if (isReceived) {
        setPendingReceived((prev) => prev.filter((r) => r.id !== requestId))
        showToast('Solicitud rechazada.')
      } else {
        setPendingSent((prev) => prev.filter((r) => r.id !== requestId))
        showToast('Solicitud cancelada.')
      }
    } catch (err: any) {
      console.error('Error rejecting friend request:', err)
      showToast(err.message || 'Error al procesar solicitud.')
    } finally {
      setProcessingId(null)
    }
  }

  // Acción de regar / apoyar
  const handleToggleWater = async (friend: FriendItem) => {
    setFriendsList((prev) =>
      prev.map((f) => (f.id === friend.id ? { ...f, isWatered: !f.isWatered } : f))
    )

    if (userId && isValidUUID(friend.id) && friend.id !== userId) {
      try {
        await supabase.from('plant_actions').insert({
          smoker_id: friend.id,
          friend_id: userId,
          action_type: 'water',
        })
      } catch {}
    }

    try {
      confetti({
        particleCount: 25,
        spread: 50,
        origin: { y: 0.65 },
        colors: ['#2D6A4F', '#52B788', '#38BDF8'],
        disableForReducedMotion: true,
      })
    } catch {}

    showToast(`Has regado la planta de ${friend.name.split(' ')[0]} 💧`)
  }

  const handleCopyCode = () => {
    if (squadCode) {
      navigator.clipboard.writeText(squadCode)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    }
  }

  // Separación de listas activas
  const quittingFriends = friendsList.filter((f) => f.role === 'smoker')
  const supportingFriends = friendsList.filter((f) => f.role === 'friend')
  const totalPendingCount = pendingReceived.length

  if (loading) {
    return (
      <div className="min-h-[100dvh] w-full bg-[#F8FAF9] flex flex-col items-center justify-center max-w-md mx-auto p-6 space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-white border border-neutral-200 shadow-sm flex items-center justify-center animate-pulse">
          <Users className="w-6 h-6 text-neutral-900" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
          Cargando comunidad...
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
            <Check className="w-3 h-3 stroke-[3]" />
          </div>
          <span className="font-medium leading-tight">{toastMessage}</span>
        </div>
      )}

      {/* CONTENEDOR PRINCIPAL */}
      <main className="flex-1 px-5 pt-7 pb-4 flex flex-col space-y-4">
        
        {/* CABECERA CON BOTÓN RÁPIDO DE BÚSQUEDA */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-950 font-sans">
              Comunidad
            </h1>
            <p className="text-xs text-neutral-400 font-medium">
              {friendsList.length} {friendsList.length === 1 ? 'conexión activa' : 'conexiones activas'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowSearchModal(true)
              setSearchQuery('')
              setSearchResults([])
            }}
            className="flex items-center gap-2 px-3.5 py-2 bg-white border border-neutral-200/90 text-neutral-800 hover:bg-neutral-50 active:scale-95 rounded-2xl text-xs font-semibold shadow-2xs transition-all"
            aria-label="Buscar amigos por nombre"
          >
            <Search className="w-3.5 h-3.5 text-emerald-700 stroke-[2.5]" />
            <span>Buscar amigo</span>
          </button>
        </div>

        {/* BANNER PARA ACTIVAR NOTIFICACIONES PUSH MÓVILES */}
        {pushPermission !== 'granted' && isPushSupported() && (
          <div className="bg-gradient-to-r from-emerald-950 to-neutral-900 text-white p-3.5 rounded-2xl flex items-center justify-between gap-3 shadow-sm animate-in fade-in duration-300 border border-emerald-800/40">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-800 text-emerald-300 flex items-center justify-center shrink-0">
                <BellRing className="w-4 h-4 animate-bounce" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold leading-tight">Activar Avisos en el Móvil</span>
                <span className="text-[10px] text-emerald-200 truncate">
                  Para enterarte de mensajes y alertas SOS al instante
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleActivatePushNotification}
              className="px-3 py-1.5 bg-emerald-400 hover:bg-emerald-300 text-emerald-950 font-bold text-xs rounded-xl shrink-0 shadow-xs active:scale-95 transition-transform"
            >
              Activar
            </button>
          </div>
        )}

        {/* PESTAÑAS SEGMENTADAS MÓVILES (AMIGOS VS SOLICITUDES) */}
        <div className="flex bg-neutral-200/60 p-1 rounded-2xl gap-1">
          <button
            type="button"
            onClick={() => setCurrentTab('friends')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              currentTab === 'friends'
                ? 'bg-white shadow-xs text-neutral-950'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Mis Amigos ({friendsList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentTab('requests')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 relative ${
              currentTab === 'requests'
                ? 'bg-white shadow-xs text-neutral-950'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Solicitudes</span>
            {totalPendingCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                {totalPendingCount}
              </span>
            )}
          </button>
        </div>

        {/* ======================================================== */}
        {/* PESTAÑA 1: LISTADO DE AMIGOS ACTIVOS */}
        {/* ======================================================== */}
        {currentTab === 'friends' && (
          <div className="bg-white border border-neutral-100 rounded-3xl p-5 shadow-xs flex-1 flex flex-col justify-between space-y-6">
            <div className="space-y-6">
              
              {/* SECCIÓN 1: DEJANDO DE FUMAR */}
              <section className="space-y-3">
                <div className="border-b border-neutral-100 pb-2 flex items-center justify-between">
                  <h2 className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                    Dejando de fumar ({quittingFriends.length})
                  </h2>
                  <span className="text-[10px] text-neutral-400 font-medium">
                    Toca para chatear
                  </span>
                </div>

                {quittingFriends.length === 0 ? (
                  <div className="text-center py-6 space-y-2">
                    <p className="text-xs text-neutral-400">No tienes amigos en proceso aún.</p>
                  </div>
                ) : (
                  <div className="space-y-3.5 pt-1">
                    {quittingFriends.map((friend, idx) => {
                      const unread = unreadCounts[friend.id] || 0

                      return (
                        <div
                          key={friend.friendshipId ? `friend-${friend.id}-${friend.friendshipId}` : `friend-${friend.id}-${idx}`}
                          className="flex items-center justify-between group py-1 bg-neutral-50/50 hover:bg-neutral-50 rounded-2xl px-2.5 transition-colors"
                        >
                          <div
                            onClick={() => handleOpenChat(friend)}
                            className="flex items-center gap-3 flex-1 cursor-pointer min-w-0"
                          >
                            {/* Avatar con iniciales */}
                            <div className="relative shrink-0">
                              <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold tracking-wider ${friend.avatarBg} ${friend.avatarText}`}
                              >
                                {friend.initials}
                              </div>
                              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />
                            </div>

                            {/* Nombre, Estado y Badge de No Leídos */}
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-semibold text-neutral-950 leading-tight truncate">
                                  {friend.name}
                                </span>
                                {unread > 0 && (
                                  <span className="px-1.5 py-0.5 bg-rose-600 text-white text-[9px] font-black rounded-full shadow-xs animate-pulse">
                                    {unread} {unread === 1 ? 'nuevo' : 'nuevos'}
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-neutral-400 font-normal mt-0.5 truncate">
                                {friend.status}
                              </span>
                            </div>
                          </div>

                          {/* Botones de acción directos */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Botón de Chat con badge rojo */}
                            <button
                              type="button"
                              onClick={() => handleOpenChat(friend)}
                              className="relative w-8 h-8 rounded-full bg-white border border-neutral-200 text-neutral-600 hover:text-emerald-700 hover:border-emerald-300 flex items-center justify-center transition-all active:scale-90"
                              title={`Chatear con ${friend.name}`}
                            >
                              <MessageCircle className="w-3.5 h-3.5 stroke-[2.2]" />
                              {unread > 0 && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 text-white text-[9px] font-black rounded-full flex items-center justify-center border border-white shadow-xs">
                                  {unread}
                                </span>
                              )}
                            </button>

                            {/* Botón de Riego */}
                            <button
                              type="button"
                              onClick={() => handleToggleWater(friend)}
                              className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-700 hover:bg-emerald-100 flex items-center justify-center transition-all active:scale-90"
                              title={`Regar planta de ${friend.name}`}
                            >
                              <Droplets className="w-3.5 h-3.5 fill-emerald-600/20 stroke-[2.2]" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              {/* SECCIÓN 2: GUARDIANES (APOYANDO) */}
              <section className="space-y-3 pt-1">
                <div className="border-b border-neutral-100 pb-2 flex items-center justify-between">
                  <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                    Guardianes de apoyo ({supportingFriends.length})
                  </h2>
                </div>

                {supportingFriends.length === 0 ? (
                  <div className="text-center py-4 space-y-1">
                    <p className="text-xs text-neutral-400">Sin guardianes por ahora.</p>
                  </div>
                ) : (
                  <div className="space-y-3.5 pt-1">
                    {supportingFriends.map((supporter, idx) => {
                      const unread = unreadCounts[supporter.id] || 0

                      return (
                        <div
                          key={supporter.friendshipId ? `supporter-${supporter.id}-${supporter.friendshipId}` : `supporter-${supporter.id}-${idx}`}
                          className="flex items-center justify-between group py-1 bg-neutral-50/50 hover:bg-neutral-50 rounded-2xl px-2.5 transition-colors"
                        >
                          <div
                            onClick={() => handleOpenChat(supporter)}
                            className="flex items-center gap-3 flex-1 cursor-pointer min-w-0"
                          >
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold tracking-wider ${supporter.avatarBg} ${supporter.avatarText} shrink-0`}
                            >
                              {supporter.initials}
                            </div>

                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-semibold text-neutral-950 leading-tight truncate">
                                  {supporter.name}
                                </span>
                                {unread > 0 && (
                                  <span className="px-1.5 py-0.5 bg-rose-600 text-white text-[9px] font-black rounded-full shadow-xs animate-pulse">
                                    {unread} {unread === 1 ? 'nuevo' : 'nuevos'}
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-neutral-400 font-normal mt-0.5 truncate">
                                {supporter.status}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleOpenChat(supporter)}
                              className="relative w-8 h-8 rounded-full bg-white border border-neutral-200 text-neutral-600 hover:text-sky-700 hover:border-sky-300 flex items-center justify-center transition-all active:scale-90"
                              title={`Chatear con ${supporter.name}`}
                            >
                              <MessageCircle className="w-3.5 h-3.5 stroke-[2.2]" />
                              {unread > 0 && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 text-white text-[9px] font-black rounded-full flex items-center justify-center border border-white shadow-xs">
                                  {unread}
                                </span>
                              )}
                            </button>

                            <span className="text-[10px] font-semibold text-sky-700 bg-sky-50 border border-sky-200/70 px-2.5 py-0.5 rounded-full">
                              Guardián
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            </div>

            {/* BOTÓN INFERIOR: BUSCAR NUEVOS AMIGOS */}
            <div className="pt-4 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => {
                  setShowSearchModal(true)
                  setSearchQuery('')
                  setSearchResults([])
                }}
                className="w-full h-12 bg-neutral-950 hover:bg-neutral-900 text-white font-medium text-xs rounded-2xl flex items-center justify-center gap-2 transition-transform active:scale-[0.98] shadow-xs"
              >
                <UserPlus className="w-4 h-4 text-emerald-400" />
                <span>Buscar y añadir amigos por nombre</span>
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* PESTAÑA 2: SOLICITUDES DE AMISTAD (RECIBIDAS Y ENVIADAS) */}
        {/* ======================================================== */}
        {currentTab === 'requests' && (
          <div className="bg-white border border-neutral-100 rounded-3xl p-5 shadow-xs flex-1 flex flex-col space-y-6">
            
            {/* SOLICITUDES RECIBIDAS */}
            <section className="space-y-3">
              <div className="border-b border-neutral-100 pb-2 flex items-center justify-between">
                <h2 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span>Solicitudes pendientes</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                </h2>
                <span className="text-xs text-neutral-400 font-semibold">
                  {pendingReceived.length}
                </span>
              </div>

              {pendingReceived.length === 0 ? (
                <div className="text-center py-8 space-y-2.5">
                  <div className="w-12 h-12 rounded-2xl bg-neutral-50 border border-neutral-100 flex items-center justify-center mx-auto text-neutral-400">
                    <HeartHandshake className="w-6 h-6 stroke-[1.5]" />
                  </div>
                  <p className="text-xs text-neutral-500 font-medium">
                    No tienes solicitudes pendientes en este momento.
                  </p>
                  <p className="text-[11px] text-neutral-400 max-w-[220px] mx-auto leading-relaxed">
                    Usa la búsqueda por nombre para encontrar y conectar con tus amigos.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  {pendingReceived.map((req, idx) => (
                    <div
                      key={`received-${req.id}-${req.requesterId}-${idx}`}
                      className="bg-[#F8FAF9] border border-neutral-200/80 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-11 h-11 rounded-full flex items-center justify-center text-xs font-bold ${req.avatarBg} ${req.avatarText} shrink-0 shadow-2xs`}
                        >
                          {req.initials}
                        </div>

                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-neutral-950">
                            {req.name}
                          </span>
                          <span className="text-[11px] text-neutral-500">
                            Quiere unirse a tu círculo de apoyo
                          </span>
                        </div>
                      </div>

                      {/* BOTONES TÁCTILES GRANDES: ACEPTAR Y RECHAZAR */}
                      <div className="flex items-center gap-2 self-end sm:self-center w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => handleAcceptRequest(req)}
                          disabled={processingId === req.id}
                          className="flex-1 sm:flex-initial h-10 px-4 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-transform active:scale-95 shadow-xs"
                        >
                          {processingId === req.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <>
                              <Check className="w-3.5 h-3.5 stroke-[3] text-emerald-400" />
                              <span>Aceptar</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRejectRequest(req.id, true)}
                          disabled={processingId === req.id}
                          className="h-10 px-3.5 bg-white border border-neutral-200 text-neutral-600 hover:text-red-700 hover:border-red-200 rounded-xl text-xs font-semibold flex items-center justify-center transition-colors active:scale-95"
                          title="Rechazar solicitud"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* SOLICITUDES ENVIADAS (ESPERANDO RESPUESTA) */}
            {pendingSent.length > 0 && (
              <section className="space-y-3 pt-2">
                <div className="border-b border-neutral-100 pb-2 flex items-center justify-between">
                  <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                    Enviadas por ti ({pendingSent.length})
                  </h2>
                </div>

                <div className="space-y-2.5">
                  {pendingSent.map((sentReq, idx) => (
                    <div
                      key={`sent-${sentReq.id}-${sentReq.requesterId}-${idx}`}
                      className="flex items-center justify-between p-3 rounded-2xl bg-neutral-50/70 border border-neutral-100"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${sentReq.avatarBg} ${sentReq.avatarText}`}
                        >
                          {sentReq.initials}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-neutral-800">
                            {sentReq.name}
                          </span>
                          <span className="text-[10px] text-amber-700 font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Esperando confirmación
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRejectRequest(sentReq.id, false)}
                        className="text-[11px] text-neutral-400 hover:text-neutral-700 font-medium px-2.5 py-1 rounded-lg hover:bg-neutral-100"
                      >
                        Cancelar
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* ======================================================== */}
      {/* MODAL DE BÚSQUEDA POR NOMBRE DE USUARIO */}
      {/* ======================================================== */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white sm:rounded-3xl rounded-t-3xl h-[85dvh] sm:h-[580px] flex flex-col p-6 space-y-4 shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300 border border-neutral-200/80">
            
            {/* Cabecera del modal */}
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-bold text-neutral-950">
                  Buscar Amigos
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Escribe el nombre o apodo de tu amigo para conectar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSearchModal(false)}
                className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 hover:text-neutral-700 transition-colors active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Input de Búsqueda Directa */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ej. Uri, María, David..."
                autoFocus
                className="w-full h-12 pl-11 pr-10 bg-[#F8FAF9] border border-neutral-200 rounded-2xl text-sm text-neutral-950 placeholder:text-neutral-400 focus:outline-none focus:border-emerald-700 transition-colors shadow-2xs font-medium"
              />
              <Search className="w-4 h-4 text-neutral-400 absolute left-4 top-1/2 -translate-y-1/2" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="w-6 h-6 rounded-full bg-neutral-200/70 text-neutral-600 flex items-center justify-center absolute right-3.5 top-1/2 -translate-y-1/2 hover:bg-neutral-300"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Lista de Resultados de Búsqueda */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5">
              {isSearching ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-2">
                  <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
                  <p className="text-xs text-neutral-400">Buscando usuarios...</p>
                </div>
              ) : !searchQuery.trim() ? (
                <div className="text-center py-12 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
                    <Search className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-neutral-800">
                      Encuentra a tus amigos fácilmente
                    </p>
                    <p className="text-[11px] text-neutral-400 max-w-xs mx-auto leading-relaxed">
                      Escribe al menos dos letras del nombre de tu amigo para ver sugerencias y enviar una invitación directa.
                    </p>
                  </div>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <p className="text-xs font-semibold text-neutral-700">
                    No se encontraron usuarios con &quot;{searchQuery}&quot;
                  </p>
                  <p className="text-[11px] text-neutral-400">
                    Comprueba que el nombre esté bien escrito o invita a tu amigo a registrarse.
                  </p>
                </div>
              ) : (
                searchResults.map((userItem, idx) => {
                  const name = userItem.full_name || 'Usuario Exhala'
                  const initials = getInitials(name)
                  const color = getAvatarColor(name)
                  const isAlreadyFriend = friendsList.some((f) => f.id === userItem.id)
                  const isSent = sentRequestMap[userItem.id] || pendingSent.some((s) => s.requesterId === userItem.id)
                  const isProcessing = processingId === userItem.id

                  return (
                    <div
                      key={`search-${userItem.id}-${idx}`}
                      className="p-3 bg-[#F8FAF9] hover:bg-neutral-100/70 border border-neutral-200/70 rounded-2xl flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${color.bg} ${color.text} shrink-0`}
                        >
                          {initials}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-neutral-950 truncate">
                            {name}
                          </span>
                          <span className="text-[11px] text-neutral-400 truncate">
                            {userItem.role === 'friend' ? 'Guardián' : 'Fumador en proceso'}
                          </span>
                        </div>
                      </div>

                      {/* Botón de acción */}
                      <div className="shrink-0">
                        {isAlreadyFriend ? (
                          <span className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1">
                            <Check className="w-3 h-3 stroke-[3]" />
                            Amigo
                          </span>
                        ) : isSent ? (
                          <span className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-semibold flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Enviada
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSendFriendRequest(userItem)}
                            disabled={isProcessing}
                            className="px-4 py-2 bg-neutral-950 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-transform active:scale-95 shadow-xs"
                          >
                            {isProcessing ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <>
                                <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Añadir</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Código de escuadrón personal secundario (por si quieren compartir su enlace) */}
            <div className="pt-3 border-t border-neutral-100 flex items-center justify-between bg-neutral-50 px-3.5 py-2.5 rounded-2xl text-xs">
              <div className="flex flex-col">
                <span className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider">
                  Tu código personal
                </span>
                <span className="font-mono text-xs font-bold text-neutral-900">
                  {squadCode || 'EXHALA'}
                </span>
              </div>

              <button
                type="button"
                onClick={handleCopyCode}
                className="px-3 py-1.5 bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-100 rounded-xl text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-all"
              >
                {copiedCode ? (
                  <>
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
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
        </div>
      )}

      {/* MODAL DE CHAT EN TIEMPO REAL */}
      {activeChatFriend && (
        <FriendChatModal
          friend={activeChatFriend}
          currentUserId={userId}
          currentUserName={userProfile?.full_name || 'Tú'}
          onClose={() => {
            setActiveChatFriend(null)
            if (userId) loadUnreadCounts(userId)
          }}
        />
      )}

      {/* BARRA DE NAVEGACIÓN INFERIOR */}
      <BottomNav
        currentTab="friends"
        unreadFriendsCount={Object.values(unreadCounts).reduce((a, b) => a + b, 0)}
        userRole={userProfile?.role || 'smoker'}
      />
    </div>
  )
}
