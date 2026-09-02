'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Users,
  Check,
  X,
  UserPlus,
  Sparkles,
  Search,
  CheckCircle2,
  Clock,
  UserCheck,
  UserX,
  Loader2,
  Share2,
  Copy,
  CheckCheck,
  HeartPulse,
} from 'lucide-react'
import confetti from 'canvas-confetti'
import { supabase } from '@/lib/supabase/client'
import { Profile } from '@/types/database.types'
import FriendChatModal from '@/components/FriendChatModal'
import GroupChatModal from '@/components/GroupChatModal'
import CreateGroupModal from '@/components/CreateGroupModal'
import StoriesBar from '@/components/StoriesBar'
import CreateStoryModal from '@/components/CreateStoryModal'
import StoryViewerModal, { UserStoriesGroup } from '@/components/StoryViewerModal'
import { dispatchPushAlertToFriends } from '@/lib/push-notifications'
import BottomNav from '@/components/BottomNav'

type TabView = 'friends' | 'groups' | 'requests'

interface FriendItem {
  id: string
  friendshipId: string
  initials: string
  name: string
  status: string
  role: 'smoker' | 'friend'
  isWatered: boolean
  smokeFreeSince?: string | null
  plantSpecies?: string
  plantStage?: number // 0 to 30
  plantProgressPercent?: number
  totalWaterings?: number
  canWater?: boolean
  cooldownSeconds?: number
}

interface FriendRequestItem {
  id: string // friendship id
  requesterId: string
  name: string
  initials: string
  role: 'smoker' | 'friend'
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

// Datos demo por si la cuenta es totalmente nueva sin conexiones
const DEFAULT_DEMO_FRIENDS: FriendItem[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    friendshipId: 'demo-1',
    initials: 'VB',
    name: 'Vinyet Blasi Ventalló',
    status: '3 días sin fumar',
    role: 'smoker',
    isWatered: false,
    plantSpecies: 'Bonsái Zen de Jade',
    plantStage: 6,
    plantProgressPercent: 20,
    totalWaterings: 6,
    canWater: true,
    cooldownSeconds: 0,
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    friendshipId: 'demo-2',
    initials: 'A',
    name: 'Angi',
    status: '3 días sin fumar',
    role: 'smoker',
    isWatered: true,
    plantSpecies: 'Bonsái Zen de Jade',
    plantStage: 7,
    plantProgressPercent: 23,
    totalWaterings: 7,
    canWater: false,
    cooldownSeconds: 24000,
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    friendshipId: 'demo-3',
    initials: 'GM',
    name: 'Galix menXP',
    status: 'Guardián',
    role: 'friend',
    isWatered: false,
  },
  {
    id: '00000000-0000-4000-8000-000000000004',
    friendshipId: 'demo-4',
    initials: 'SA',
    name: 'Sergi Amat',
    status: 'Guardián',
    role: 'friend',
    isWatered: false,
  },
  {
    id: '00000000-0000-4000-8000-000000000005',
    friendshipId: 'demo-5',
    initials: 'NX',
    name: 'Nona Xwom',
    status: 'Guardián',
    role: 'friend',
    isWatered: false,
  },
  {
    id: '00000000-0000-4000-8000-000000000006',
    friendshipId: 'demo-6',
    initials: 'X',
    name: 'Xavi',
    status: 'Guardián',
    role: 'friend',
    isWatered: false,
  },
]

export default function FriendsDashboard() {
  const router = useRouter()
  const [currentTab, setCurrentTab] = useState<TabView>('friends')
  const [loading, setLoading] = useState<boolean>(true)

  // Usuario autenticado
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>('Un amigo')
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
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)

  // Grupos de chat
  const [groupsList, setGroupsList] = useState<any[]>([])
  const [activeChatGroup, setActiveChatGroup] = useState<any | null>(null)
  const [showCreateGroupModal, setShowCreateGroupModal] = useState<boolean>(false)

  // Cargar grupos de chat
  const loadGroupsData = useCallback(async (currentUserId: string) => {
    try {
      const res = await fetch(`/api/groups?userId=${currentUserId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && Array.isArray(data.groups)) {
          setGroupsList(data.groups)
        }
      }
    } catch (err) {
      console.warn('Error loading groups:', err)
    }
  }, [])

  // Historias de 24h
  const [storiesUsers, setStoriesUsers] = useState<UserStoriesGroup[]>([])
  const [showCreateStoryModal, setShowCreateStoryModal] = useState<boolean>(false)
  const [initialStoryImage, setInitialStoryImage] = useState<string | null>(null)
  const [activeStoryUserIndex, setActiveStoryUserIndex] = useState<number | null>(null)

  // Cargar historias de amigos y propias
  const loadStoriesData = useCallback(async (currentUserId: string) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const res = await fetch(`/api/stories?viewerId=${currentUserId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) {
        const data = await res.json()
        if (data.success && Array.isArray(data.users)) {
          setStoriesUsers(data.users)
        }
      }
    } catch (err) {
      console.warn('Error loading stories:', err)
    }
  }, [])

  // SOS Crisis modal
  const [sosOpen, setSosOpen] = useState<boolean>(false)
  const [sosSending, setSosSending] = useState<boolean>(false)
  const [sosBreathPhase, setSosBreathPhase] = useState<'Inhala' | 'Mantén' | 'Exhala'>('Inhala')
  const [sosBreathTimer, setSosBreathTimer] = useState<number>(60)

  useEffect(() => {
    activeChatFriendRef.current = activeChatFriend
  }, [activeChatFriend])

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3200)
  }, [])

  // Cargar conteo de mensajes no leídos por amigo
  const loadUnreadCounts = useCallback(async (currentUserId: string) => {
    try {
      const { data: unreadRows } = await supabase
        .from('messages')
        .select('id, sender_id, created_at')
        .eq('receiver_id', currentUserId)
        .is('read_at', null)

      const counts: Record<string, number> = {}
      unreadRows?.forEach((r) => {
        let lastRead: string | null = lastReadTimestampsRef.current[r.sender_id] || null
        if (!lastRead && typeof window !== 'undefined') {
          lastRead = localStorage.getItem(`exhala_chat_read_${currentUserId}_${r.sender_id}`)
        }

        if (lastRead && new Date(r.created_at).getTime() <= new Date(lastRead).getTime()) {
          return
        }

        if (activeChatFriendRef.current?.id === r.sender_id) {
          return
        }

        counts[r.sender_id] = (counts[r.sender_id] || 0) + 1
      })

      if (activeChatFriendRef.current?.id) {
        counts[activeChatFriendRef.current.id] = 0
      }

      setUnreadCounts(counts)
    } catch (e) {
      console.warn('Could not load unread message counts:', e)
    }
  }, [])

  // Comprobar notificaciones no leídas de campana
  const loadUnreadNotifications = useCallback(async (currentUserId: string) => {
    try {
      const lastRead =
        typeof window !== 'undefined'
          ? localStorage.getItem('last_read_notifications_at') ||
            new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
          : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

      const { count: unreadWater } = await supabase
        .from('plant_actions')
        .select('id', { count: 'exact', head: true })
        .eq('smoker_id', currentUserId)
        .neq('friend_id', currentUserId)
        .gt('created_at', lastRead)

      const { count: unreadSos } = await supabase
        .from('sos_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('friend_id', currentUserId)
        .gt('created_at', lastRead)

      setUnreadNotificationsCount((unreadWater || 0) + (unreadSos || 0))
    } catch (e) {
      console.warn('Error loading notifications count:', e)
    }
  }, [])

  // Abrir chat y marcar mensajes de ese amigo como leídos
  const handleOpenChat = async (friend: FriendItem) => {
    const nowIso = new Date().toISOString()
    activeChatFriendRef.current = friend
    setActiveChatFriend(friend)

    lastReadTimestampsRef.current[friend.id] = nowIso
    if (typeof window !== 'undefined' && userId) {
      try {
        localStorage.setItem(`exhala_chat_read_${userId}_${friend.id}`, nowIso)
      } catch {}
    }

    setUnreadCounts((prev) => {
      const updated = { ...prev }
      delete updated[friend.id]
      return updated
    })

    if (userId && isValidUUID(friend.id)) {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData.session?.access_token

        fetch('/api/messages/read', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ senderId: friend.id, receiverId: userId }),
        }).catch(() => {})

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

  // Cargar amistades reales y solicitudes
  const loadFriendsData = useCallback(async (currentUserId: string) => {
    try {
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
        const status = row.status || 'accepted'

        if (status === 'accepted') {
          if (seenAcceptedUserIds.has(otherUser.id)) return
          seenAcceptedUserIds.add(otherUser.id)

          let statusText = 'Guardián'
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
            isWatered: false,
            smokeFreeSince: otherUser.smoke_free_since,
          })
        } else if (status === 'pending') {
          if (isMeSender) {
            if (seenSentUserIds.has(otherUser.id)) return
            seenSentUserIds.add(otherUser.id)

            sent.push({
              id: row.id,
              requesterId: otherUser.id,
              name,
              initials,
              role: otherUser.role || 'smoker',
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
              createdAt: row.created_at,
            })
          }
        }
      })

      if (accepted.length > 0) {
        // Enriquecer amigos con estado botánico real sincronizado
        const enriched = await Promise.all(
          accepted.map(async (friend) => {
            if (friend.role !== 'smoker') return friend
            try {
              const res = await fetch(`/api/plant/status?smokerId=${friend.id}&viewerId=${currentUserId}`)
              if (res.ok) {
                const pData = await res.json()
                if (pData.success) {
                  return {
                    ...friend,
                    plantSpecies: pData.species.name,
                    plantStage: pData.stage,
                    plantProgressPercent: pData.progressPercent,
                    totalWaterings: pData.totalWaterings,
                    canWater: pData.canWater,
                    cooldownSeconds: pData.remainingCooldownSeconds,
                    isWatered: !pData.canWater,
                  }
                }
              }
            } catch (e) {
              console.warn('Error fetching plant status for friend:', e)
            }
            return friend
          })
        )
        setFriendsList(enriched)
      }
      setPendingReceived(received)
      setPendingSent(sent)
    } catch (err) {
      console.error('Error loading friends data:', err)
    }
  }, [])

  // Inicializar usuario
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
          .select('full_name')
          .eq('id', user.id)
          .maybeSingle()

        if (profile?.full_name) setUserName(profile.full_name)

        await loadFriendsData(user.id)
        await loadGroupsData(user.id)
        await loadStoriesData(user.id)
        await loadUnreadCounts(user.id)
        await loadUnreadNotifications(user.id)

        // Realtime para inbox de mensajes
        const channelName = `user-inbox-${user.id}-${Date.now()}`
        const inboxChannel = supabase
          .channel(channelName)
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

              setUnreadCounts((prev) => ({
                ...prev,
                [newMsg.sender_id]: (prev[newMsg.sender_id] || 0) + 1,
              }))

              const { data: senderProfile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', newMsg.sender_id)
                .maybeSingle()

              const senderName = senderProfile?.full_name?.split(' ')[0] || 'Un amigo'
              showToast(`💬 Mensaje de ${senderName}: "${newMsg.content.slice(0, 30)}..."`)
            }
          )
          .subscribe()

        // Realtime para riegos de plantas de amigos
        const plantChannelName = `friends-plant-actions-${user.id}-${Date.now()}`
        const plantChannel = supabase
          .channel(plantChannelName)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'plant_actions',
            },
            (payload: any) => {
              const newAct = payload?.new
              if (!newAct) return
              setFriendsList((prev) =>
                prev.map((f) => {
                  if (f.id === newAct.smoker_id) {
                    const nextTotal = (f.totalWaterings || 0) + 1
                    const nextStage = nextTotal % 30
                    const nextProgress = Math.min(100, Math.round((nextStage / 30) * 100))
                    const isMeWhoWatered = newAct.friend_id === user.id
                    return {
                      ...f,
                      totalWaterings: nextTotal,
                      plantStage: nextStage,
                      plantProgressPercent: nextProgress,
                      canWater: isMeWhoWatered ? false : f.canWater,
                      cooldownSeconds: isMeWhoWatered ? 12 * 3600 : f.cooldownSeconds,
                      isWatered: isMeWhoWatered ? true : f.isWatered,
                    }
                  }
                  return f
                })
              )
            }
          )
          .subscribe()

        const unreadInterval = setInterval(() => {
          loadUnreadCounts(user.id)
          loadStoriesData(user.id)
        }, 5000)

        const handleFocus = () => {
          loadStoriesData(user.id)
        }
        window.addEventListener('focus', handleFocus)

        return () => {
          clearInterval(unreadInterval)
          window.removeEventListener('focus', handleFocus)
          supabase.removeChannel(inboxChannel)
          supabase.removeChannel(plantChannel)
        }
      } catch (err) {
        console.error('Error initializing friends page:', err)
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [router, loadFriendsData, loadGroupsData, loadStoriesData, loadUnreadCounts, loadUnreadNotifications, showToast])

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

  // Búsqueda por Nombre
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

  // Enviar solicitud de amistad
  const handleSendFriendRequest = async (targetUser: SearchResultUser) => {
    if (!userId || !targetUser.id || processingId) return
    setProcessingId(targetUser.id)

    try {
      const { error } = await supabase
        .from('friendships')
        .insert({
          smoker_id: userId,
          friend_id: targetUser.id,
          status: 'pending',
        })

      if (error) {
        if (error.code === '23505') {
          showToast('Ya tienes una conexión o solicitud con este usuario.')
        } else {
          throw error
        }
      } else {
        setSentRequestMap((prev) => ({ ...prev, [targetUser.id]: true }))
        showToast(`¡Solicitud enviada a ${targetUser.full_name?.split(' ')[0] || 'tu amigo'}! 🌿`)

        try {
          confetti({
            particleCount: 30,
            spread: 50,
            origin: { y: 0.65 },
            colors: ['#E8B75E', '#A9BBA4', '#52B788'],
          })
        } catch {}

        loadFriendsData(userId)
      }
    } catch (err: any) {
      console.error('Error sending friend request:', err)
      showToast(err.message || 'No se pudo enviar la solicitud.')
    } finally {
      setProcessingId(null)
    }
  }

  // Aceptar solicitud
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
          colors: ['#E8B75E', '#A9BBA4', '#52B788', '#F1EEE2'],
        })
      } catch {}

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
      const { error } = await supabase.from('friendships').delete().eq('id', requestId)
      if (error) throw error

      if (isReceived) {
        setPendingReceived((prev) => prev.filter((r) => r.id !== requestId))
        showToast('Solicitud descartada.')
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

  // Regar planta del amigo
  const handleToggleWater = async (friend: FriendItem) => {
    if (friend.canWater === false) {
      const remainingSecs = friend.cooldownSeconds || 0
      const hours = Math.floor(remainingSecs / 3600)
      const minutes = Math.floor((remainingSecs % 3600) / 60)
      showToast(`⏳ Esta planta ya fue regada. Disponible en ${hours}h ${minutes}m`)
      return
    }

    const nextTotal = (friend.totalWaterings || 0) + 1
    const nextStage = nextTotal % 30
    const nextProgress = Math.min(100, Math.round((nextStage / 30) * 100))

    // Optimistic UI update
    setFriendsList((prev) =>
      prev.map((f) =>
        f.id === friend.id
          ? {
              ...f,
              isWatered: true,
              canWater: false,
              cooldownSeconds: 12 * 3600,
              totalWaterings: nextTotal,
              plantStage: nextStage,
              plantProgressPercent: nextProgress,
            }
          : f
      )
    )

    if (userId && isValidUUID(friend.id) && friend.id !== userId) {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const res = await fetch('/api/plant/water', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(sessionData.session?.access_token
              ? { Authorization: `Bearer ${sessionData.session.access_token}` }
              : {}),
          },
          body: JSON.stringify({
            smoker_id: friend.id,
            friend_id: userId,
            action_type: 'water',
          }),
        })

        if (res.ok) {
          const waterRes = await res.json().catch(() => ({}))
          if (waterRes.totalWaterings) {
            setFriendsList((prev) =>
              prev.map((f) =>
                f.id === friend.id
                  ? {
                      ...f,
                      totalWaterings: waterRes.totalWaterings,
                      plantStage: waterRes.stage,
                      plantProgressPercent: waterRes.progressPercent,
                    }
                  : f
              )
            )
          }
        } else {
          const errData = await res.json().catch(() => ({}))
          if (errData?.cooldown) {
            showToast('⏳ Ya regaste esta planta recientemente. Cooldown de 12h activo.')
            return
          }
        }
      } catch (err) {
        console.warn('Error watering via API:', err)
      }
    }

    try {
      confetti({
        particleCount: 45,
        spread: 60,
        origin: { y: 0.65 },
        colors: ['#E8B75E', '#52B788', '#38BDF8'],
      })
    } catch {}

    showToast(`💧 ¡Has regado la planta de ${friend.name.split(' ')[0]}! (${nextTotal} riegos · Etapa ${nextStage}/30)`)
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

  // Listas agrupadas
  const quittingFriends = friendsList.filter((f) => f.role === 'smoker')
  const supportingFriends = friendsList.filter((f) => f.role === 'friend')

  const totalUnreadMessages = Object.values(unreadCounts).reduce((acc, c) => acc + c, 0)

  // Asignar colores de avatar c1, c2, c3
  const getAvatarGradientClass = (index: number) => {
    const cycle = index % 3
    if (cycle === 0) return 'c1'
    if (cycle === 1) return 'c2'
    return 'c3'
  }

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
          <p className="font-fraunces text-sm text-[#A9BBA4]">Cargando Comunidad...</p>
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
        {/* TEXTURA SUTIL DE HOJAS Y LUZ */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 12% 6%, rgba(232,183,94,0.06), transparent 38%), radial-gradient(circle at 90% 96%, rgba(167,150,216,0.05), transparent 42%)',
          }}
        />

        {/* TOAST DE FEEDBACK */}
        {toastMessage && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-xs bg-[#16241C]/95 border border-[rgba(232,183,94,0.25)] text-[#F1EEE2] text-xs py-3 px-4 rounded-2xl shadow-xl flex items-center gap-2.5 backdrop-blur-md animate-in fade-in slide-in-from-top-3">
            <span className="text-[#E8B75E] text-sm shrink-0">✨</span>
            <span className="font-medium leading-tight">{toastMessage}</span>
          </div>
        )}

        {/* =================================================================== */}
        {/* 1. CABECERA                                                         */}
        {/* =================================================================== */}
        <header className="pt-[22px] px-[24px] pb-0 relative z-10 flex items-start justify-between">
          <div className="flex items-center">
            <h1 className="font-fraunces font-medium text-[22px] text-[#F1EEE2] tracking-tight">
              Comunidad
            </h1>
          </div>

          <div className="flex gap-[8px]">
            {/* Botón Buscar */}
            <button
              type="button"
              onClick={() => setShowSearchModal(true)}
              className="w-[34px] h-[34px] rounded-full border border-[rgba(232,183,94,0.16)] bg-[rgba(255,255,255,0.02)] flex items-center justify-center text-[14px] text-[#A9BBA4] hover:text-[#E8B75E] hover:border-[rgba(232,183,94,0.35)] transition-all cursor-pointer"
              title="Buscar compañeros"
              aria-label="Buscar amigos"
            >
              🔍
            </button>

            {/* Botón Notificaciones con ping */}
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
              className="w-[34px] h-[34px] rounded-full border border-[rgba(232,183,94,0.16)] bg-[rgba(255,255,255,0.02)] flex items-center justify-center text-[14px] text-[#A9BBA4] hover:text-[#E8B75E] hover:border-[rgba(232,183,94,0.35)] transition-all cursor-pointer relative"
              title="Notificaciones"
              aria-label="Ver notificaciones"
            >
              🔔
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-[2px] -right-[2px] w-[15px] h-[15px] rounded-full bg-[#E8547C] text-white text-[9px] font-bold flex items-center justify-center border-2 border-[#16241C]">
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* =================================================================== */}
        {/* 2. CONTROL SEGMENTADO (MIS AMIGOS / GRUPOS / SOLICITUDES)          */}
        {/* =================================================================== */}
        <div className="mx-[20px] mt-[20px] mb-0 flex bg-[rgba(255,255,255,0.03)] border border-[rgba(232,183,94,0.1)] rounded-[100px] p-[4px] relative z-10">
          <button
            type="button"
            onClick={() => setCurrentTab('friends')}
            className={`flex-1 text-center text-[12.5px] font-semibold py-[8px] px-0 rounded-[100px] flex items-center justify-center transition-all cursor-pointer ${
              currentTab === 'friends'
                ? 'bg-[rgba(232,183,94,0.12)] text-[#E8B75E]'
                : 'text-[#7C9481] hover:text-[#F1EEE2]'
            }`}
          >
            <span>Amigos</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentTab('groups')}
            className={`flex-1 text-center text-[12.5px] font-semibold py-[8px] px-0 rounded-[100px] flex items-center justify-center transition-all cursor-pointer ${
              currentTab === 'groups'
                ? 'bg-[rgba(232,183,94,0.12)] text-[#E8B75E]'
                : 'text-[#7C9481] hover:text-[#F1EEE2]'
            }`}
          >
            <span>Grupos</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentTab('requests')}
            className={`flex-1 text-center text-[12.5px] font-semibold py-[8px] px-0 rounded-[100px] flex items-center justify-center gap-[4px] transition-all cursor-pointer ${
              currentTab === 'requests'
                ? 'bg-[rgba(232,183,94,0.12)] text-[#E8B75E]'
                : 'text-[#7C9481] hover:text-[#F1EEE2]'
            }`}
          >
            <span>Solicitudes</span>
            {pendingReceived.length > 0 && (
              <span className="bg-[#E8547C] text-white text-[10px] font-bold min-w-[16px] h-[16px] px-1 rounded-full flex items-center justify-center">
                {pendingReceived.length}
              </span>
            )}
          </button>
        </div>

        {/* =================================================================== */}
        {/* 2.5. BARRA DE HISTORIAS 24H (ESTILO INSTAGRAM)                      */}
        {/* =================================================================== */}
        <div className="mx-[20px] mt-[10px]">
          <StoriesBar
            currentUserId={userId}
            currentUserName={userName}
            usersWithStories={storiesUsers}
            onOpenCreateStory={(initialImg) => {
              setInitialStoryImage(initialImg || null)
              setShowCreateStoryModal(true)
            }}
            onOpenStoryViewer={(idx) => setActiveStoryUserIndex(idx)}
          />
        </div>

        {/* =================================================================== */}
        {/* 3. CONTENIDO PRINCIPAL                                              */}
        {/* =================================================================== */}
        <div className="flex-1 pt-[14px] px-[24px] pb-[4px] relative z-10 overflow-y-auto no-scrollbar">
          {currentTab === 'friends' ? (
            <>
              {/* SECCIÓN 1: DEJANDO DE FUMAR */}
              {quittingFriends.length > 0 && (
                <>
                  <div className="flex items-baseline justify-between mb-[12px]">
                    <span className="font-fraunces italic text-[14px] text-[#A9BBA4]">
                      Dejando de fumar
                    </span>
                    <span className="text-[11px] text-[#7C9481]">Toca para chatear</span>
                  </div>

                  <div className="flex flex-col gap-[10px] mb-[26px]">
                    {quittingFriends.map((friend, idx) => {
                      const gradientClass = getAvatarGradientClass(idx)
                      const unread = unreadCounts[friend.id] || 0
                      const stage = friend.plantStage ?? 6
                      const progressPercent = friend.plantProgressPercent ?? Math.round((stage / 30) * 100)
                      const speciesName = friend.plantSpecies || 'Bonsái Zen de Jade'
                      const isCooldown = friend.canWater === false

                      return (
                        <div
                          key={friend.id}
                          className="rounded-[22px] border border-[rgba(232,183,94,0.14)] p-[14px] flex flex-col gap-[11px] transition-all hover:border-[rgba(232,183,94,0.3)] group"
                          style={{
                            background:
                              'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))',
                          }}
                        >
                          {/* FILA SUPERIOR: AVATAR, INFO Y ACCIONES */}
                          <div className="flex items-center gap-[12px]">
                            {/* Avatar con punto de status verde */}
                            <div
                              onClick={() => handleOpenChat(friend)}
                              className="w-[42px] h-[42px] rounded-full flex items-center justify-center text-[13.5px] font-semibold shrink-0 relative text-[#1B1710] cursor-pointer shadow-sm"
                              style={{
                                background:
                                  gradientClass === 'c1'
                                    ? 'linear-gradient(145deg, #9FC98A, #6FA65C)'
                                    : gradientClass === 'c2'
                                    ? 'linear-gradient(145deg, #C9BCEF, #A796D8)'
                                    : 'linear-gradient(145deg, #F0D08C, #E8B75E)',
                              }}
                            >
                              {friend.initials}
                              <span className="absolute -right-[1px] -bottom-[1px] w-[10px] h-[10px] rounded-full bg-[#6FCB8A] border-2 border-[#16241C]" />
                            </div>

                            {/* Info del amigo */}
                            <div
                              onClick={() => handleOpenChat(friend)}
                              className="flex-1 min-w-0 cursor-pointer"
                            >
                              <div className="text-[14.5px] font-semibold text-[#F1EEE2] truncate">
                                {friend.name}
                              </div>
                              <div className="text-[12px] text-[#E8B75E] mt-[1px] truncate flex items-center gap-1.5">
                                <span>{friend.status}</span>
                              </div>
                            </div>

                            {/* Acciones: Regar y Chatear */}
                            <div className="flex items-center gap-[7px] shrink-0">
                              <button
                                type="button"
                                onClick={() => handleToggleWater(friend)}
                                className={`w-[34px] h-[34px] rounded-full flex items-center justify-center text-[13px] transition-all cursor-pointer active:scale-95 ${
                                  isCooldown
                                    ? 'bg-[rgba(82,183,136,0.12)] border border-[rgba(82,183,136,0.3)] text-[#52B788]'
                                    : 'bg-[rgba(232,183,94,0.09)] border border-[rgba(232,183,94,0.22)] text-[#E8B75E] hover:bg-[rgba(232,183,94,0.2)] hover:scale-105'
                                }`}
                                title={isCooldown ? 'Planta ya regada hoy' : 'Regar planta (+1 vitalidad)'}
                                aria-label="Regar planta"
                              >
                                {isCooldown ? '✓' : '💧'}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenChat(friend)}
                                className="w-[34px] h-[34px] rounded-full bg-[rgba(232,183,94,0.07)] border border-[rgba(232,183,94,0.14)] flex items-center justify-center text-[13px] text-[#E8B75E] hover:bg-[rgba(232,183,94,0.18)] transition-all cursor-pointer relative active:scale-95"
                                title="Chatear"
                                aria-label="Abrir chat"
                              >
                                💬
                                {unread > 0 && (
                                  <span className="absolute -top-[4px] -right-[4px] min-w-[15px] h-[15px] px-[3px] rounded-full bg-[#E8547C] text-white text-[9.5px] font-bold flex items-center justify-center border-2 border-[#16241C]">
                                    {unread}
                                  </span>
                                )}
                              </button>
                            </div>
                          </div>

                          {/* CAJA BOTÁNICA DE LA PLANTA DEL FUMADOR */}
                          <div
                            onClick={() => router.push(`/dashboard/plant?friendId=${friend.id}`)}
                            className="rounded-[16px] bg-[rgba(232,183,94,0.035)] border border-[rgba(232,183,94,0.08)] p-[9px_12px] flex items-center gap-[11px] cursor-pointer hover:bg-[rgba(232,183,94,0.07)] transition-all"
                            title="Ver su jardín botánico"
                          >
                            {/* Mini icono botánico */}
                            <div className="w-[36px] h-[36px] rounded-full bg-[rgba(82,183,136,0.12)] border border-[rgba(82,183,136,0.25)] flex items-center justify-center text-[16px] shrink-0">
                              🌿
                            </div>

                            {/* Especie, etapa y barra de progreso */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline justify-between text-[11.5px]">
                                <span className="font-fraunces font-medium text-[#F1EEE2] truncate">
                                  {speciesName}
                                </span>
                                <span className="text-[10.5px] font-semibold text-[#E8B75E] shrink-0 ml-2">
                                  {stage}/30 · {progressPercent}%
                                </span>
                              </div>

                              {/* Barra de progreso de maduración */}
                              <div className="w-full h-[5px] rounded-full bg-[rgba(0,0,0,0.35)] overflow-hidden mt-[5px]">
                                <div
                                  className="h-full rounded-full transition-all duration-700"
                                  style={{
                                    width: `${Math.max(4, progressPercent)}%`,
                                    background: 'linear-gradient(90deg, #52B788 0%, #E8B75E 100%)',
                                  }}
                                />
                              </div>
                            </div>

                            <span className="text-[12px] text-[#7C9481] group-hover:text-[#E8B75E] transition-colors shrink-0 font-bold">
                              →
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              {/* SECCIÓN 2: GUARDIANES DE APOYO */}
              {supportingFriends.length > 0 && (
                <>
                  <div className="flex items-baseline justify-between mb-[12px]">
                    <span className="font-fraunces italic text-[14px] text-[#A9BBA4]">
                      Guardianes de apoyo
                    </span>
                    <span className="text-[11px] text-[#7C9481]">
                      {supportingFriends.length}
                    </span>
                  </div>

                  <div className="flex flex-col gap-[10px] mb-[26px]">
                    {supportingFriends.map((friend, idx) => {
                      const gradientClass = getAvatarGradientClass(idx + 1)
                      const unread = unreadCounts[friend.id] || 0

                      return (
                        <div
                          key={friend.id}
                          className="rounded-[20px] border border-[rgba(232,183,94,0.1)] p-[13px] flex items-center gap-[12px] transition-all hover:border-[rgba(232,183,94,0.25)]"
                          style={{
                            background:
                              'linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.01))',
                          }}
                        >
                          {/* Avatar sin status dot */}
                          <div
                            onClick={() => handleOpenChat(friend)}
                            className="w-[42px] h-[42px] rounded-full flex items-center justify-center text-[13.5px] font-semibold shrink-0 text-[#1B1710] cursor-pointer"
                            style={{
                              background:
                                gradientClass === 'c1'
                                  ? 'linear-gradient(145deg, #9FC98A, #6FA65C)'
                                  : gradientClass === 'c2'
                                  ? 'linear-gradient(145deg, #C9BCEF, #A796D8)'
                                  : 'linear-gradient(145deg, #F0D08C, #E8B75E)',
                            }}
                          >
                            {friend.initials}
                          </div>

                          {/* Info con Role Pill */}
                          <div
                            onClick={() => handleOpenChat(friend)}
                            className="flex-1 min-w-0 cursor-pointer"
                          >
                            <div className="flex items-center gap-[7px]">
                              <div className="text-[14.5px] font-semibold text-[#F1EEE2] truncate">
                                {friend.name}
                              </div>
                            </div>
                            <span className="inline-block mt-[3px] text-[10px] font-semibold text-[#A796D8] border border-[rgba(167,150,216,0.35)] bg-[rgba(167,150,216,0.08)] py-[2px] px-[8px] rounded-[100px] whitespace-nowrap">
                              Guardián
                            </span>
                          </div>

                          {/* Acciones */}
                          <div className="flex items-center gap-[7px] shrink-0">
                            <button
                              type="button"
                              onClick={() => handleToggleWater(friend)}
                              className="w-[32px] h-[32px] rounded-full bg-[rgba(232,183,94,0.07)] border border-[rgba(232,183,94,0.14)] flex items-center justify-center text-[13px] text-[#E8B75E] hover:bg-[rgba(232,183,94,0.18)] transition-all cursor-pointer active:scale-95"
                              title="Enviar apoyo"
                              aria-label="Enviar apoyo"
                            >
                              💧
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenChat(friend)}
                              className="w-[32px] h-[32px] rounded-full bg-[rgba(232,183,94,0.07)] border border-[rgba(232,183,94,0.14)] flex items-center justify-center text-[13px] text-[#E8B75E] hover:bg-[rgba(232,183,94,0.18)] transition-all cursor-pointer relative active:scale-95"
                              title="Chatear"
                              aria-label="Abrir chat"
                            >
                              💬
                              {unread > 0 && (
                                <span className="absolute -top-[4px] -right-[4px] min-w-[15px] h-[15px] px-[3px] rounded-full bg-[#E8547C] text-white text-[9.5px] font-bold flex items-center justify-center border-2 border-[#16241C]">
                                  {unread}
                                </span>
                              )}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              {/* BOTÓN: BUSCAR AMIGOS POR NOMBRE */}
              <button
                type="button"
                onClick={() => setShowSearchModal(true)}
                className="w-full bg-transparent border border-[rgba(232,183,94,0.26)] text-[#E8B75E] p-[14px] rounded-[16px] font-semibold text-[14px] flex items-center justify-center gap-[8px] mb-[18px] hover:bg-[rgba(232,183,94,0.08)] transition-all cursor-pointer"
              >
                ＋ Buscar amigos por nombre
              </button>
            </>
          ) : currentTab === 'groups' ? (
            /* =============================================================== */
            /* PESTAÑA: GRUPOS DE CHAT                                         */
            /* =============================================================== */
            <div className="space-y-4">
              {/* CABECERA DE GRUPOS Y BOTÓN CREAR */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-fraunces italic text-[14px] text-[#A9BBA4]">
                    Tus Grupos de Apoyo
                  </span>
                  <p className="text-[11px] text-[#7C9481]">
                    Compañeros compartiendo racha limpia
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCreateGroupModal(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1B1710] bg-gradient-to-r from-[#EFC471] to-[#E8B75E] py-1.5 px-3.5 rounded-full hover:scale-105 active:scale-95 transition-all shadow-sm cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Crear Grupo</span>
                </button>
              </div>

              {/* LISTA DE GRUPOS */}
              {groupsList.length === 0 ? (
                <div className="py-12 text-center rounded-[24px] border border-dashed border-[rgba(232,183,94,0.2)] p-6 bg-[rgba(255,255,255,0.015)]">
                  <div className="text-3xl mb-2">👥</div>
                  <div className="font-fraunces text-base text-[#F1EEE2]">Sin grupos todavía</div>
                  <p className="text-xs text-[#7C9481] mt-1 mb-4">
                    Crea tu primer grupo con tus amigos para acompañarse en el camino.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowCreateGroupModal(true)}
                    className="text-xs font-semibold text-[#1B1710] bg-gradient-to-r from-[#EFC471] to-[#E8B75E] py-2 px-4 rounded-full inline-flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Crear Primer Grupo</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {groupsList.map((grp) => (
                    <div
                      key={grp.id}
                      onClick={() => setActiveChatGroup(grp)}
                      className="rounded-[22px] border border-[rgba(232,183,94,0.14)] p-[14px_16px] bg-[rgba(255,255,255,0.025)] hover:border-[rgba(232,183,94,0.3)] transition-all cursor-pointer group shadow-sm flex flex-col gap-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#EFC471] to-[#E8B75E] text-[#2B1C08] flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
                            👥
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-[14px] font-medium text-[#F1EEE2] truncate group-hover:text-[#E8B75E] transition-colors">
                              {grp.name}
                            </h4>
                            <p className="text-[11px] text-[#7C9481]">
                              {grp.member_count} {grp.member_count === 1 ? 'miembro' : 'miembros'}
                            </p>
                          </div>
                        </div>

                        <span className="text-[11px] font-semibold text-[#E8B75E] bg-[rgba(232,183,94,0.1)] border border-[rgba(232,183,94,0.22)] px-2.5 py-1 rounded-full shrink-0 group-hover:scale-105 transition-transform">
                          Chatear
                        </span>
                      </div>

                      {grp.last_message ? (
                        <div className="p-2 rounded-xl bg-[rgba(0,0,0,0.2)] border border-[rgba(232,183,94,0.06)] text-[11.5px] text-[#A9BBA4] truncate">
                          <span className="text-[#E8B75E] font-medium">{grp.last_message.sender_name}: </span>
                          <span>{grp.last_message.content}</span>
                        </div>
                      ) : grp.description ? (
                        <p className="text-[11px] text-[#7C9481] italic truncate px-1">
                          {grp.description}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* =============================================================== */
            /* PESTAÑA: SOLICITUDES PENDIENTES & CÓDIGO                         */
            /* =============================================================== */
            <div className="space-y-4">
              {/* Tarjeta de Código Personal para Compartir */}
              <div
                className="rounded-[20px] p-[16px] border border-[rgba(232,183,94,0.15)] text-center space-y-2"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(232,183,94,0.06), rgba(255,255,255,0.01))',
                }}
              >
                <span className="text-[11px] font-medium text-[#7C9481]">
                  Tu identificador para recibir solicitudes
                </span>
                <div className="font-mono text-[13px] text-[#E8B75E] bg-black/20 py-2 px-3 rounded-xl border border-[rgba(232,183,94,0.12)] select-all break-all">
                  {userId}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (navigator?.clipboard && userId) {
                      navigator.clipboard.writeText(userId)
                      setCopiedCode(true)
                      showToast('Identificador copiado al portapapeles 📋')
                      setTimeout(() => setCopiedCode(false), 2000)
                    }
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-[#E8B75E] hover:underline pt-1 cursor-pointer font-medium"
                >
                  {copiedCode ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? '¡Copiado!' : 'Copiar mi ID'}</span>
                </button>
              </div>

              {/* Solicitudes Recibidas */}
              <div>
                <div className="flex items-baseline justify-between mb-[10px]">
                  <span className="font-fraunces italic text-[14px] text-[#A9BBA4]">
                    Solicitudes recibidas
                  </span>
                  <span className="text-[11px] text-[#7C9481]">
                    {pendingReceived.length}
                  </span>
                </div>

                {pendingReceived.length === 0 ? (
                  <div className="text-center py-6 text-xs text-[#7C9481]">
                    No tienes solicitudes pendientes por responder
                  </div>
                ) : (
                  <div className="flex flex-col gap-[10px]">
                    {pendingReceived.map((req) => (
                      <div
                        key={req.id}
                        className="rounded-[20px] border border-[rgba(232,183,94,0.14)] p-[13px] flex items-center justify-between gap-2"
                        style={{
                          background:
                            'linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.01))',
                        }}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-[38px] h-[38px] rounded-full bg-gradient-to-tr from-[#9FC98A] to-[#6FA65C] text-[#1B1710] font-bold text-xs flex items-center justify-center shrink-0">
                            {req.initials}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[14px] font-semibold text-[#F1EEE2] truncate">
                              {req.name}
                            </div>
                            <div className="text-[11px] text-[#7C9481]">
                              {req.role === 'friend' ? 'Guardián' : 'Fumador en proceso'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleAcceptRequest(req)}
                            disabled={processingId === req.id}
                            className="w-[32px] h-[32px] rounded-full bg-[#E8B75E] text-[#1B1710] font-bold flex items-center justify-center hover:bg-[#E8B75E]/90 transition-all cursor-pointer active:scale-95"
                            title="Aceptar"
                          >
                            ✓
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectRequest(req.id, true)}
                            disabled={processingId === req.id}
                            className="w-[32px] h-[32px] rounded-full bg-white/10 text-[#A9BBA4] hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95"
                            title="Rechazar"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Solicitudes Enviadas */}
              {pendingSent.length > 0 && (
                <div className="pt-2">
                  <div className="flex items-baseline justify-between mb-[10px]">
                    <span className="font-fraunces italic text-[14px] text-[#A9BBA4]">
                      Enviadas esperando respuesta
                    </span>
                    <span className="text-[11px] text-[#7C9481]">
                      {pendingSent.length}
                    </span>
                  </div>

                  <div className="flex flex-col gap-[8px]">
                    {pendingSent.map((req) => (
                      <div
                        key={req.id}
                        className="rounded-[18px] border border-[rgba(232,183,94,0.08)] p-[12px] flex items-center justify-between text-xs text-[#7C9481]"
                        style={{ background: 'rgba(255,255,255,0.02)' }}
                      >
                        <span className="font-medium text-[#F1EEE2]">{req.name}</span>
                        <button
                          type="button"
                          onClick={() => handleRejectRequest(req.id, false)}
                          className="text-[#E8547C] hover:underline"
                        >
                          Cancelar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="h-8 shrink-0 pointer-events-none" />
        </div>

        {/* =================================================================== */}
        {/* 4. BOTÓN FLOTANTE SOS (SOS FAB)                                     */}
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
          {/* Anillo de pulso continuo */}
          <span className="absolute -inset-[5px] rounded-full border-[1.5px] border-[rgba(232,84,124,0.28)] animate-pulse-ring pointer-events-none" />
        </button>

        {/* =================================================================== */}
        {/* 5. BARRA DE NAVEGACIÓN INFERIOR (BOTTOM BAR)                        */}
        {/* =================================================================== */}
        {/* 5. BARRA DE NAVEGACIÓN INFERIOR (3 MENÚS)                           */}
        {/* =================================================================== */}
        <BottomNav currentTab="friends" unreadFriendsCount={totalUnreadMessages} />
      </div>

      {/* =================================================================== */}
      {/* 6. MODAL DE BÚSQUEDA POR NOMBRE / IDENTIFICADOR                     */}
      {/* =================================================================== */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div
            className="w-full max-w-sm rounded-[28px] p-6 space-y-4 border border-[rgba(232,183,94,0.2)] relative"
            style={{
              background: 'linear-gradient(180deg, #1C2E24, #121D16)',
              color: '#F1EEE2',
            }}
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-fraunces text-lg font-medium text-[#F1EEE2]">
                  Buscar compañeros
                </h3>
                <p className="text-xs text-[#7C9481]">
                  Escribe el nombre de un amigo o pega su ID
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowSearchModal(false)
                  setSearchQuery('')
                  setSearchResults([])
                }}
                className="w-8 h-8 rounded-full bg-white/10 text-[#A9BBA4] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Input de Búsqueda */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nombre o ID..."
                className="w-full py-3 pl-10 pr-4 bg-black/30 border border-[rgba(232,183,94,0.2)] rounded-2xl text-xs text-[#F1EEE2] placeholder-[#7C9481] focus:outline-none focus:border-[#E8B75E] transition-colors"
                autoFocus
              />
              <Search className="w-4 h-4 text-[#7C9481] absolute left-3.5 top-3.5" />
            </div>

            {/* Resultados */}
            <div className="max-h-56 overflow-y-auto space-y-2 no-scrollbar">
              {isSearching ? (
                <div className="flex items-center justify-center py-6 text-xs text-[#7C9481] gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#E8B75E]" />
                  <span>Buscando en la comunidad...</span>
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map((user) => {
                  const isSent = sentRequestMap[user.id]
                  const alreadyFriend = friendsList.some((f) => f.id === user.id)

                  return (
                    <div
                      key={user.id}
                      className="p-3 bg-black/20 border border-[rgba(232,183,94,0.1)] rounded-2xl flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#F1EEE2] truncate">
                          {user.full_name || 'Usuario'}
                        </div>
                        <div className="text-[10px] text-[#7C9481]">
                          {user.role === 'friend' ? 'Guardián' : 'Fumador'}
                        </div>
                      </div>

                      {alreadyFriend ? (
                        <span className="text-[10px] font-semibold text-[#E8B75E] bg-[#E8B75E]/10 px-2 py-1 rounded-lg">
                          Conectado ✓
                        </span>
                      ) : isSent ? (
                        <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg">
                          Enviada ✓
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSendFriendRequest(user)}
                          disabled={processingId === user.id}
                          className="py-1.5 px-3 bg-[#E8B75E] text-[#1B1710] text-[11px] font-semibold rounded-xl hover:bg-[#E8B75E]/90 transition-colors cursor-pointer"
                        >
                          Conectar
                        </button>
                      )}
                    </div>
                  )
                })
              ) : searchQuery.trim() ? (
                <div className="text-center py-6 text-xs text-[#7C9481]">
                  No se encontraron usuarios con ese nombre
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 7. MODAL CHAT CON AMIGO                                             */}
      {/* =================================================================== */}
      {activeChatFriend && (
        <FriendChatModal
          friend={{
            id: activeChatFriend.id,
            name: activeChatFriend.name,
            initials: activeChatFriend.initials,
            status: activeChatFriend.status,
            avatarBg: 'bg-[#3B5240]',
            avatarText: 'text-[#E8B75E]',
          }}
          currentUserId={userId}
          currentUserName={userName}
          onClose={() => {
            setActiveChatFriend(null)
            activeChatFriendRef.current = null
          }}
        />
      )}

      {/* =================================================================== */}
      {/* 8. MODAL SOS: RESPIRACIÓN EN CAJA DE 60s Y ALERTA A AMIGOS         */}
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

      {/* MODAL DE CHAT GRUPAL */}
      {activeChatGroup && (
        <GroupChatModal
          group={activeChatGroup}
          currentUserId={userId}
          currentUserName={userName}
          onClose={() => setActiveChatGroup(null)}
          onFriendAdded={() => {
            if (userId) loadFriendsData(userId)
          }}
        />
      )}

      {/* MODAL DE CREACIÓN DE GRUPO */}
      {showCreateGroupModal && (
        <CreateGroupModal
          currentUserId={userId}
          friends={friendsList.map((f) => ({
            id: f.id,
            name: f.name,
            initials: f.initials,
            role: f.role,
          }))}
          onClose={() => setShowCreateGroupModal(false)}
          onGroupCreated={(newGroup) => {
            setGroupsList((prev) => [newGroup, ...prev])
            setActiveChatGroup(newGroup)
            showToast(`🎉 ¡Grupo "${newGroup.name}" creado con éxito!`)
          }}
        />
      )}

      {/* MODAL DE CREACIÓN DE HISTORIA */}
      {showCreateStoryModal && (
        <CreateStoryModal
          currentUserId={userId}
          currentUserName={userName}
          initialImage={initialStoryImage}
          onClose={() => {
            setShowCreateStoryModal(false)
            setInitialStoryImage(null)
          }}
          onStoryCreated={(newStory) => {
            setStoriesUsers((prev) => {
              const myIndex = prev.findIndex((u) => u.userId === userId)
              const myInitials = (userName || 'TÚ')
                .split(' ')
                .map((w) => w[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()

              const formattedStory = {
                id: newStory.id || 'story-' + Date.now(),
                mediaUrl: newStory.media_url || newStory.mediaUrl,
                caption: newStory.caption,
                createdAt: newStory.created_at || new Date().toISOString(),
                expiresAt:
                  newStory.expires_at ||
                  new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
              }

              if (myIndex !== -1) {
                const updated = [...prev]
                updated[myIndex] = {
                  ...updated[myIndex],
                  stories: [...updated[myIndex].stories, formattedStory],
                }
                return updated
              } else {
                return [
                  {
                    userId: userId || 'me',
                    userName: userName || 'Tú',
                    userInitials: myInitials,
                    userRole: 'smoker',
                    stories: [formattedStory],
                  },
                  ...prev,
                ]
              }
            })
            if (userId) loadStoriesData(userId)
            showToast('📸 ¡Historia publicada! Estará activa 24 horas.')
          }}
        />
      )}

      {/* MODAL VISOR DE HISTORIAS */}
      {activeStoryUserIndex !== null && (
        <StoryViewerModal
          initialUserIndex={activeStoryUserIndex}
          usersWithStories={storiesUsers}
          currentUserId={userId}
          onClose={() => setActiveStoryUserIndex(null)}
          onSendCheer={(targetUserId, reaction) => {
            showToast(`✨ Reacción enviada a tu compañero: ${reaction}`)
          }}
        />
      )}
    </div>
  )
}
