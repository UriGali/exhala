'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  HeartPulse,
  Droplets,
  Sparkles,
  Clock,
  Check,
  X,
  UserPlus,
  Share2,
  Copy,
  CheckCheck,
  Info,
  Loader2,
  Wind,
  Lock,
  Coins,
  TrendingUp,
  Wallet,
  Users,
  MessageCircle,
  Plus,
  Search,
  ExternalLink,
  ChevronRight,
  Shield,
  Sprout,
  PiggyBank,
  Bell,
} from 'lucide-react'
import confetti from 'canvas-confetti'
import { supabase } from '@/lib/supabase/client'
import { Profile, Message } from '@/types/database.types'
import { PLANT_SPECIES, PlantSpecies } from '@/lib/plant-species'
import { dispatchPushAlertToFriends, dispatchPushRelapseAlert } from '@/lib/push-notifications'
import { checkAndDispatchSmokerMilestones } from '@/lib/milestones'
import BottomNav from '@/components/BottomNav'
import StoriesBar from '@/components/StoriesBar'
import CreateStoryModal from '@/components/CreateStoryModal'
import StoryViewerModal, { UserStoriesGroup } from '@/components/StoryViewerModal'
import FriendChatModal from '@/components/FriendChatModal'
import GroupChatModal, { GroupChatData } from '@/components/GroupChatModal'
import CreateGroupModal from '@/components/CreateGroupModal'
import GardenPlantVisualizer from '@/components/GardenPlantVisualizer'

type HomeTab = 'friends' | 'groups'

interface FriendItem {
  id: string
  friendshipId: string
  initials: string
  name: string
  status: string
  role: 'smoker' | 'friend'
  smokeFreeSince?: string | null
  cigsPerDay?: number
  packPrice?: number
  plantSpecies?: string
  plantStage?: number
  plantProgressPercent?: number
  totalWaterings?: number
  canWater?: boolean
  cooldownSeconds?: number
}

interface FriendRequestItem {
  id: string
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
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase() || 'AM'
}

function PlantPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialFriendParam = searchParams.get('friendId')

  // Pestaña principal de Inicio: Amigos o Grupos (con persistencia)
  const [activeTab, setActiveTab] = useState<HomeTab>('friends')

  const handleTabChange = useCallback((tab: HomeTab) => {
    setActiveTab(tab)
    if (typeof window !== 'undefined') {
      localStorage.setItem('plant_active_tab', tab)
    }
  }, [])

  // Estado del usuario autenticado
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>('Un amigo')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  // Código de escuadrón y añadir amigos en Inicio
  const [squadCode, setSquadCode] = useState<string>('')
  const [copiedCode, setCopiedCode] = useState<boolean>(false)
  const [showAddFriendModal, setShowAddFriendModal] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [searchResults, setSearchResults] = useState<SearchResultUser[]>([])
  const [isSearching, setIsSearching] = useState<boolean>(false)
  const [sentRequestMap, setSentRequestMap] = useState<Record<string, boolean>>({})
  const [pendingReceived, setPendingReceived] = useState<FriendRequestItem[]>([])
  const [processingFriendId, setProcessingFriendId] = useState<string | null>(null)

  // Datos propios de la planta
  const [myWaterings, setMyWaterings] = useState<number>(0)
  const [myLastWateredAt, setMyLastWateredAt] = useState<string | null>(null)
  const [myCooldownSeconds, setMyCooldownSeconds] = useState<number>(0)
  const [isWateringActive, setIsWateringActive] = useState<boolean>(false)

  // Lista de amigos y solicitudes
  const [friendsList, setFriendsList] = useState<FriendItem[]>([])
  const [activeChatFriend, setActiveChatFriend] = useState<any | null>(null)
  const [selectedFriendDetail, setSelectedFriendDetail] = useState<FriendItem | null>(null)
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})

  // Grupos
  const [groupsList, setGroupsList] = useState<any[]>([])
  const [activeChatGroup, setActiveChatGroup] = useState<GroupChatData | null>(null)
  const [showCreateGroupModal, setShowCreateGroupModal] = useState<boolean>(false)
  const [unreadGroupCounts, setUnreadGroupCounts] = useState<Record<string, number>>({})

  // Historias de 24h
  const [storiesUsers, setStoriesUsers] = useState<UserStoriesGroup[]>([])
  const [showCreateStoryModal, setShowCreateStoryModal] = useState<boolean>(false)
  const [initialStoryImage, setInitialStoryImage] = useState<string | null>(null)
  const [activeStoryUserIndex, setActiveStoryUserIndex] = useState<number | null>(null)

  // Feedback, Notificaciones & Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0)

  // Modal Ver Propio Jardín Completo
  const [showOwnGardenModal, setShowOwnGardenModal] = useState<boolean>(false)

  // Modal de Registro de Tropiezo / Recaída (Multa 1 €)
  const [showRelapseModal, setShowRelapseModal] = useState<boolean>(false)
  const [relapseNotes, setRelapseNotes] = useState<string>('')
  const [isSubmittingRelapse, setIsSubmittingRelapse] = useState<boolean>(false)

  // SOS Crisis State
  const [sosOpen, setSosOpen] = useState<boolean>(false)
  const [sosSending, setSosSending] = useState<boolean>(false)
  const [sosBreathPhase, setSosBreathPhase] = useState<'Inhala' | 'Mantén' | 'Exhala'>('Inhala')
  const [sosBreathTimer, setSosBreathTimer] = useState<number>(60)

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3200)
  }, [])

  // 1. Cargar Grupos
  const loadGroupsData = useCallback(async (currentUserId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/groups?userId=${currentUserId}`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      })
      if (res.ok) {
        const data = await res.json()
        if (data.success && Array.isArray(data.groups)) {
          setGroupsList(data.groups)
          const unreadMap: Record<string, number> = {}
          data.groups.forEach((grp: any) => {
            if (grp.last_message && grp.last_message.sender_id !== currentUserId) {
              const lastRead =
                typeof window !== 'undefined'
                  ? localStorage.getItem(`last_read_group_${grp.id}`)
                  : null

              if (!lastRead || new Date(grp.last_message.created_at) > new Date(lastRead)) {
                unreadMap[grp.id] = 1
              }
            }
          })
          setUnreadGroupCounts(unreadMap)
        }
      }
    } catch (err) {
      console.warn('Error loading groups:', err)
    }
  }, [])

  // 2. Cargar Historias
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

  // 3. Cargar Mensajes no leídos
  const loadUnreadCounts = useCallback(async (currentUserId: string) => {
    try {
      const { data: unreadRows } = await supabase
        .from('messages')
        .select('id, sender_id, created_at')
        .eq('receiver_id', currentUserId)
        .is('read_at', null)

      const counts: Record<string, number> = {}
      unreadRows?.forEach((r) => {
        let lastRead: string | null = null
        if (typeof window !== 'undefined') {
          lastRead = localStorage.getItem(`exhala_chat_read_${currentUserId}_${r.sender_id}`)
        }
        if (lastRead && new Date(r.created_at).getTime() <= new Date(lastRead).getTime()) {
          return
        }
        counts[r.sender_id] = (counts[r.sender_id] || 0) + 1
      })
      setUnreadCounts(counts)
    } catch (e) {
      console.warn('Error loading unread counts:', e)
    }
  }, [])

  // 4. Cargar Amigos y Plantas
  const loadFriendsData = useCallback(async (currentUserId: string) => {
    try {
      // 4.1 Cargar solicitudes pendientes recibidas
      try {
        const { data: pendingRows } = await supabase
          .from('friendships')
          .select(`
            id,
            smoker_id,
            friend_id,
            status,
            created_at,
            smoker:profiles!friendships_smoker_id_fkey(id, full_name, role)
          `)
          .eq('friend_id', currentUserId)
          .eq('status', 'pending')

        if (pendingRows) {
          setPendingReceived(
            pendingRows.map((r: any) => ({
              id: r.id,
              requesterId: r.smoker?.id || r.smoker_id,
              name: r.smoker?.full_name || 'Compañero',
              initials: getInitials(r.smoker?.full_name || 'Compañero'),
              role: r.smoker?.role || 'smoker',
              createdAt: r.created_at,
            }))
          )
        } else {
          setPendingReceived([])
        }
      } catch (e) {
        console.warn('Error loading pending friendships:', e)
      }

      // 4.2 Cargar amistades aceptadas
      const { data: friendships } = await supabase
        .from('friendships')
        .select(`
          id,
          smoker_id,
          friend_id,
          status,
          created_at,
          smoker:profiles!friendships_smoker_id_fkey(id, full_name, role, smoke_free_since, cigs_per_day, pack_price),
          friend:profiles!friendships_friend_id_fkey(id, full_name, role, smoke_free_since, cigs_per_day, pack_price)
        `)
        .or(`smoker_id.eq.${currentUserId},friend_id.eq.${currentUserId}`)
        .eq('status', 'accepted')

      if (!friendships || friendships.length === 0) {
        setFriendsList([])
        return
      }

      const rawFriends: FriendItem[] = []
      const seenIds = new Set<string>()

      friendships.forEach((row: any) => {
        const isMeSender = row.smoker_id === currentUserId
        const otherUser = isMeSender ? row.friend : row.smoker

        if (!otherUser || !otherUser.id || otherUser.id === currentUserId) return
        if (seenIds.has(otherUser.id)) return
        seenIds.add(otherUser.id)

        const name = otherUser.full_name || 'Compañero'
        const initials = getInitials(name)

        let statusText = 'Guardián'
        if (otherUser.role === 'smoker') {
          if (otherUser.smoke_free_since) {
            const diffMs = Math.max(0, Date.now() - new Date(otherUser.smoke_free_since).getTime())
            const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
            statusText = `${days} ${days === 1 ? 'día libre' : 'días libres'}`
          } else {
            statusText = 'En racha sin humo'
          }
        }

        rawFriends.push({
          id: otherUser.id,
          friendshipId: row.id,
          initials,
          name,
          status: statusText,
          role: otherUser.role || 'smoker',
          smokeFreeSince: otherUser.smoke_free_since,
          cigsPerDay: otherUser.cigs_per_day || 15,
          packPrice: Number(otherUser.pack_price) || 5.5,
          canWater: true,
          cooldownSeconds: 0,
        })
      })

      // Consulta en lote de estados botánicos (1 sola petición para todos)
      const allQueryIds = [currentUserId, ...rawFriends.map((f) => f.id)]
      const uniqueIds = Array.from(new Set(allQueryIds))

      let batchStatuses: Record<string, any> = {}
      try {
        const res = await fetch(
          `/api/plant/status?smokerIds=${uniqueIds.join(',')}&viewerId=${currentUserId}`
        )
        if (res.ok) {
          const bData = await res.json()
          if (bData.success && bData.statuses) {
            batchStatuses = bData.statuses
          }
        }
      } catch (e) {
        console.warn('Error fetching batch plant statuses:', e)
      }

      // Propia planta
      const ownPlant = batchStatuses[currentUserId]
      if (ownPlant) {
        setMyWaterings(ownPlant.totalWaterings)
        setMyLastWateredAt(ownPlant.lastWateredAt)
        setMyCooldownSeconds(ownPlant.remainingCooldownSeconds)
      }

      // Amigos enriquecidos
      const enrichedFriends: FriendItem[] = rawFriends.map((friend) => {
        const pData = batchStatuses[friend.id]
        if (pData) {
          return {
            ...friend,
            plantSpecies: pData.species?.name,
            plantStage: pData.stage,
            plantProgressPercent: pData.progressPercent,
            totalWaterings: pData.totalWaterings,
            canWater: pData.canWater,
            cooldownSeconds: pData.remainingCooldownSeconds,
          }
        }
        return friend
      })

      setFriendsList(enrichedFriends)

      if (initialFriendParam) {
        const found = enrichedFriends.find((f) => f.id === initialFriendParam)
        if (found) setSelectedFriendDetail(found)
      }
    } catch (err) {
      console.error('Error loading friends:', err)
    }
  }, [initialFriendParam])

  // 5. Inicializar datos principales
  useEffect(() => {
    async function init() {
      try {
        const { data: { session }, error: authError } = await supabase.auth.getSession()
        const user = session?.user

        if (authError || !user) {
          const { data: { user: verifiedUser }, error: getUserError } = await supabase.auth.getUser()
          if (getUserError || !verifiedUser) {
            await supabase.auth.signOut().catch(() => {})
            router.push('/')
            return
          }
        }

        const activeUserId = user?.id || (await supabase.auth.getUser()).data.user?.id
        if (!activeUserId) return

        setUserId(activeUserId)
        setSquadCode(`EXHALA-${activeUserId.slice(0, 5).toUpperCase()}`)

        if (typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search)
          const tabParam = urlParams.get('tab')
          if (tabParam === 'groups' || tabParam === 'friends') {
            setActiveTab(tabParam)
          } else {
            const savedTab = localStorage.getItem('plant_active_tab') as HomeTab | null
            if (savedTab === 'groups' || savedTab === 'friends') {
              setActiveTab(savedTab)
            }
          }

          if (urlParams.get('action') === 'add') {
            setShowAddFriendModal(true)
          }
          const inviteFriendId = urlParams.get('invite')
          if (inviteFriendId && inviteFriendId !== activeUserId) {
            setShowAddFriendModal(true)
            setSearchQuery(inviteFriendId)
          }
        }

        // Renderizado instantáneo de la interfaz
        setLoading(false)

        const { data: userProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', activeUserId)
          .maybeSingle()

        if (userProfile) {
          setProfile(userProfile)
          if (userProfile.full_name) setUserName(userProfile.full_name)

          // Evaluar hitos semanales sin fumar (1 a 20 semanas) y notificar a amigos
          if (userProfile.role === 'smoker' && userProfile.smoke_free_since) {
            checkAndDispatchSmokerMilestones(userProfile)
              .then(({ newlyDispatched }) => {
                if (newlyDispatched.length > 0) {
                  const latestWeek = Math.max(...newlyDispatched)
                  const weekText = latestWeek === 1 ? '1 semana' : `${latestWeek} semanas`
                  showToast(
                    `🎉 ¡Enhorabuena! Llevas ${weekText} sin fumar. Tus amigos han sido notificados.`
                  )
                  try {
                    confetti({
                      particleCount: 60,
                      spread: 80,
                      origin: { y: 0.3 },
                      colors: ['#10B981', '#F59E0B', '#38BDF8'],
                    })
                  } catch {}
                }
              })
              .catch(() => {})
          }
        }

        // Cargas en segundo plano
        loadFriendsData(activeUserId)
        loadGroupsData(activeUserId)
        loadStoriesData(activeUserId)
        loadUnreadCounts(activeUserId)

        // Notificaciones no leídas
        const lastRead =
          typeof window !== 'undefined'
            ? localStorage.getItem('last_read_notifications_at') ||
              new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
            : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

        const { count: unreadWater } = await supabase
          .from('plant_actions')
          .select('id', { count: 'exact', head: true })
          .eq('smoker_id', activeUserId)
          .neq('friend_id', activeUserId)
          .gt('created_at', lastRead)

        setUnreadNotificationsCount(unreadWater || 0)

        // Realtime para mensajes 1-a-1
        const inboxChannel = supabase
          .channel(`user-inbox-${activeUserId}-${Date.now()}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
              filter: `receiver_id=eq.${activeUserId}`,
            },
            (payload: any) => {
              const newMsg = payload?.new
              if (!newMsg) return
              setUnreadCounts((prev) => ({
                ...prev,
                [newMsg.sender_id]: (prev[newMsg.sender_id] || 0) + 1,
              }))
              showToast('Nuevo mensaje de apoyo')
            }
          )
          .subscribe()

        // Realtime para mensajes de grupo
        const groupChannel = supabase
          .channel(`user-groups-${activeUserId}-${Date.now()}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'group_messages',
            },
            (payload: any) => {
              const newMsg = payload?.new
              if (!newMsg || newMsg.sender_id === activeUserId) return
              setUnreadGroupCounts((prev) => ({
                ...prev,
                [newMsg.group_id]: (prev[newMsg.group_id] || 0) + 1,
              }))
              loadGroupsData(activeUserId)
            }
          )
          .subscribe()

        // Realtime para visualizaciones de historias en directo
        const storyViewsChannel = supabase
          .channel(`story-views-sync-plant-${Date.now()}`)
          .on(
            'broadcast',
            { event: 'story_viewed' },
            (payload: any) => {
              const data = payload?.payload
              if (data && data.authorId === activeUserId && data.storyId && data.viewer) {
                try {
                  const key = `exhala_story_views_${data.storyId}`
                  const existingRaw = localStorage.getItem(key)
                  const existing = existingRaw ? JSON.parse(existingRaw) : []
                  const already = existing.some((v: any) => v.id === data.viewer.id)
                  if (!already) {
                    existing.unshift(data.viewer)
                    localStorage.setItem(key, JSON.stringify(existing))
                  }
                } catch {}

                setStoriesUsers((prev) =>
                  prev.map((userGrp) => {
                    if (userGrp.userId === activeUserId) {
                      return {
                        ...userGrp,
                        stories: userGrp.stories.map((st) => {
                          if (st.id === data.storyId) {
                            const curViewers = st.viewers || []
                            const exists = curViewers.some((v) => v.id === data.viewer.id)
                            const updated = exists ? curViewers : [data.viewer, ...curViewers]
                            return {
                              ...st,
                              viewers: updated,
                              viewsCount: updated.length,
                            }
                          }
                          return st
                        }),
                      }
                    }
                    return userGrp
                  })
                )
              }
            }
          )
          .subscribe()

        return () => {
          supabase.removeChannel(inboxChannel)
          supabase.removeChannel(groupChannel)
          supabase.removeChannel(storyViewsChannel)
        }
      } catch (err) {
        console.error('Error in init:', err)
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [router, loadFriendsData, loadGroupsData, loadStoriesData, loadUnreadCounts, showToast])

  // Temporizador de cuenta atrás para propio riego
  useEffect(() => {
    if (myCooldownSeconds <= 0) return
    const interval = setInterval(() => {
      setMyCooldownSeconds((prev) => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [myCooldownSeconds])

  // Temporizador SOS
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

  // Copiar código de escuadrón
  const handleCopySquadCode = () => {
    if (typeof navigator !== 'undefined' && squadCode) {
      navigator.clipboard.writeText(squadCode)
      setCopiedCode(true)
      showToast('¡Código de escuadrón copiado al portapapeles! 📋')
      setTimeout(() => setCopiedCode(false), 2000)
    }
  }

  // Compartir enlace de invitación
  const handleShareInvite = async () => {
    const inviteUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/dashboard/plant?invite=${userId}`
        : ''
    const shareText = `¡Únete a mi red en Exhala para dejar de fumar juntos! 🌿 Mi código de escuadrón es ${squadCode}: ${inviteUrl}`

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Únete a mi escuadrón en Exhala',
          text: shareText,
          url: inviteUrl,
        })
        return
      } catch {}
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(shareText)
      showToast('¡Enlace de invitación copiado! Compártelo con tus amigos 📲')
    }
  }

  // Búsqueda en vivo de usuarios por Nombre, Código de Escuadrón o ID
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
        const cleanQuery = query.replace(/^EXHALA-/i, '').toLowerCase()

        if (isValidUUID(cleanQuery)) {
          const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name, role, avatar_url, smoke_free_since')
            .eq('id', cleanQuery)
            .neq('id', userId)

          if (!error && data && data.length > 0) {
            setSearchResults(data)
            setIsSearching(false)
            return
          }
        }

        const { data: nameData, error: nameError } = await supabase
          .from('profiles')
          .select('id, full_name, role, avatar_url, smoke_free_since')
          .ilike('full_name', `%${query}%`)
          .neq('id', userId)
          .limit(10)

        let results = nameData || []

        if (cleanQuery.length >= 4 && /^[0-9a-f]+$/i.test(cleanQuery)) {
          const { data: allProfiles } = await supabase
            .from('profiles')
            .select('id, full_name, role, avatar_url, smoke_free_since')
            .neq('id', userId)
            .limit(30)

          if (allProfiles) {
            const codeMatches = allProfiles.filter(
              (p) => p.id.toLowerCase().startsWith(cleanQuery) && !results.some((r) => r.id === p.id)
            )
            results = [...results, ...codeMatches]
          }
        }

        setSearchResults(results)
      } catch (err) {
        console.error('Error searching users in plant:', err)
      } finally {
        setIsSearching(false)
      }
    }, 280)

    return () => clearTimeout(timer)
  }, [searchQuery, userId])

  // Enviar solicitud de amistad
  const handleSendFriendRequest = async (targetUser: SearchResultUser) => {
    if (!userId || !targetUser.id || processingFriendId) return
    setProcessingFriendId(targetUser.id)

    try {
      // 1. Si ya nos envió solicitud él, aceptarla directamente
      const { data: existingReverse } = await supabase
        .from('friendships')
        .select('id, status')
        .eq('smoker_id', targetUser.id)
        .eq('friend_id', userId)
        .maybeSingle()

      if (existingReverse) {
        if (existingReverse.status === 'pending') {
          await supabase
            .from('friendships')
            .update({ status: 'accepted' })
            .eq('id', existingReverse.id)

          showToast(
            `¡Conectados! ${targetUser.full_name?.split(' ')[0] || 'Tu amigo'} ya te había enviado solicitud. 🤝`
          )
          loadFriendsData(userId)
          return
        } else if (existingReverse.status === 'accepted') {
          showToast('Ya estáis conectados como amigos.')
          return
        }
      }

      // 2. Comprobar si ya enviamos nosotros
      const { data: existingDirect } = await supabase
        .from('friendships')
        .select('id, status')
        .eq('smoker_id', userId)
        .eq('friend_id', targetUser.id)
        .maybeSingle()

      if (existingDirect) {
        if (existingDirect.status === 'accepted') {
          showToast('Ya estáis conectados como amigos.')
        } else {
          showToast('Ya tienes una solicitud pendiente enviada a este usuario.')
        }
        return
      }

      // 3. Crear solicitud
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
          await supabase.from('sos_notifications').insert({
            smoker_id: userId,
            friend_id: targetUser.id,
            message: `${userName} te ha enviado una solicitud de amistad en Exhala.`,
          })
        } catch {}

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
      setProcessingFriendId(null)
    }
  }

  // Aceptar solicitud de amistad recibida
  const handleAcceptRequest = async (request: FriendRequestItem) => {
    if (!userId || processingFriendId) return
    setProcessingFriendId(request.id)

    try {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', request.id)

      if (error) throw error

      setPendingReceived((prev) => prev.filter((r) => r.id !== request.id))
      showToast(`¡Ahora eres amigo de ${request.name.split(' ')[0]}! 🤝`)

      try {
        confetti({
          particleCount: 40,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#E8B75E', '#52B788', '#F1EEE2'],
        })
      } catch {}

      loadFriendsData(userId)
    } catch (err: any) {
      console.error('Error accepting friend request:', err)
      showToast('No se pudo aceptar la solicitud.')
    } finally {
      setProcessingFriendId(null)
    }
  }

  // Rechazar solicitud de amistad
  const handleRejectRequest = async (request: FriendRequestItem) => {
    if (!userId || processingFriendId) return
    setProcessingFriendId(request.id)

    try {
      await supabase.from('friendships').delete().eq('id', request.id)
      setPendingReceived((prev) => prev.filter((r) => r.id !== request.id))
      showToast('Solicitud rechazada.')
    } catch (err) {
      console.error('Error rejecting friend request:', err)
      showToast('No se pudo rechazar la solicitud.')
    } finally {
      setProcessingFriendId(null)
    }
  }

  // Acción: Regar planta propia o de un amigo
  const handleWaterPlant = async (targetSmokerId: string, friendName?: string) => {
    if (isWateringActive || !userId) return
    setIsWateringActive(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/plant/water', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          smoker_id: targetSmokerId,
          friend_id: userId,
          action_type: 'water',
        }),
      })

      if (res.ok) {
        try {
          confetti({
            particleCount: 45,
            spread: 60,
            origin: { y: 0.65 },
            colors: ['#E8B75E', '#52B788', '#38BDF8', '#F1EEE2'],
          })
        } catch {}

        if (targetSmokerId === userId) {
          const nextVal = myWaterings + 1
          setMyWaterings(nextVal)
          setMyCooldownSeconds(12 * 3600)
          showToast(`¡Has regado tu planta! (${nextVal % 30}/30 riegos)`)
        } else {
          setFriendsList((prev) =>
            prev.map((f) =>
              f.id === targetSmokerId
                ? {
                    ...f,
                    totalWaterings: (f.totalWaterings || 0) + 1,
                    plantStage: ((f.totalWaterings || 0) + 1) % 30,
                    canWater: false,
                    cooldownSeconds: 12 * 3600,
                  }
                : f
            )
          )
          if (selectedFriendDetail && selectedFriendDetail.id === targetSmokerId) {
            setSelectedFriendDetail((prev) =>
              prev
                ? {
                    ...prev,
                    totalWaterings: (prev.totalWaterings || 0) + 1,
                    plantStage: ((prev.totalWaterings || 0) + 1) % 30,
                    canWater: false,
                    cooldownSeconds: 12 * 3600,
                  }
                : null
            )
          }
          showToast(`¡Has regado la planta de ${friendName || 'tu amigo'}!`)
        }
      } else {
        const errJson = await res.json().catch(() => ({}))
        showToast(errJson?.error || 'Debes esperar antes del próximo riego.')
      }
    } catch (err) {
      console.warn('Error watering:', err)
    } finally {
      setIsWateringActive(false)
    }
  }

  // Registrar tropiezo / cigarrillo fumado (Multa de 1 € al bote y reinicio de días limpios)
  const handleConfirmRelapse = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!userId || isSubmittingRelapse) return

    setIsSubmittingRelapse(true)
    const penaltyValue = Number(profile?.penalty_amount) || 1.0

    try {
      // 1. Guardar en la tabla relapses
      await supabase.from('relapses').insert({
        smoker_id: userId,
        penalty_amount: penaltyValue,
        notes: relapseNotes.trim() || 'Tropiezo de 1 cigarrillo',
        date: new Date().toISOString(),
      })

      // 2. Reiniciar fecha smoke_free_since a la fecha y hora actual exacta
      const nowIso = new Date().toISOString()
      await supabase
        .from('profiles')
        .update({
          smoke_free_since: nowIso,
          updated_at: nowIso,
        })
        .eq('id', userId)

      // 3. Actualizar estado local inmediatamente (contador de días vuelve a 0)
      setProfile((prev) => (prev ? { ...prev, smoke_free_since: nowIso } : null))

      // 4. Notificar a todos los amigos y guardianes en la base de datos
      const { data: friendships } = await supabase
        .from('friendships')
        .select('friend_id, smoker_id')
        .or(`smoker_id.eq.${userId},friend_id.eq.${userId}`)
        .eq('status', 'accepted')

      const friendIds = Array.from(
        new Set(
          (friendships || [])
            .map((f) => (f.smoker_id === userId ? f.friend_id : f.smoker_id))
            .filter((id) => id && id !== userId)
        )
      )

      if (friendIds.length > 0) {
        const notifications = friendIds.map((targetId) => ({
          smoker_id: userId,
          friend_id: targetId,
          message: `${userName} ha tenido un tropiezo puntual (+${penaltyValue.toFixed(2)} € al bote). ¡Mándale un mensaje de apoyo para retomar el hábito limpio!`,
        }))
        await supabase.from('sos_notifications').insert(notifications)

        // 5. Enviar notificación push web a los móviles de los amigos
        dispatchPushRelapseAlert(userId, userName, penaltyValue).catch(() => {})
      }

      setShowRelapseModal(false)
      setRelapseNotes('')
      showToast(`Compromiso registrado (+${penaltyValue.toFixed(2)} € al bote). Contador reiniciado. ¡Un tropiezo no te detiene, volvemos a empezar!`)
    } catch (err: any) {
      console.error('Error registrando recaída:', err)
      showToast('No se pudo guardar el registro.')
    } finally {
      setIsSubmittingRelapse(false)
    }
  }

  // Abrir chat individual con un amigo
  const handleOpenFriendChat = (friend: FriendItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const nowIso = new Date().toISOString()
    if (typeof window !== 'undefined' && userId) {
      localStorage.setItem(`exhala_chat_read_${userId}_${friend.id}`, nowIso)
    }
    setUnreadCounts((prev) => {
      const updated = { ...prev }
      delete updated[friend.id]
      return updated
    })
    setActiveChatFriend({
      id: friend.id,
      name: friend.name,
      initials: friend.initials,
      status: friend.status,
      avatarBg: 'bg-emerald-100',
      avatarText: 'text-emerald-800',
    })
  }

  // Abrir chat grupal
  const handleOpenGroupChat = (grp: any) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`last_read_group_${grp.id}`, new Date().toISOString())
    }
    setUnreadGroupCounts((prev) => {
      const updated = { ...prev }
      delete updated[grp.id]
      return updated
    })
    setActiveChatGroup(grp)
  }

  // Alerta SOS
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
          } catch {}
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

  // Cálculos de la propia planta
  const myPlantIndex = Math.floor(myWaterings / 30)
  const myPlantStage = myWaterings % 30
  const mySpecies = PLANT_SPECIES[myPlantIndex % PLANT_SPECIES.length]
  const myProgressPercent = Math.min(100, Math.round((myPlantStage / 30) * 100))

  // Cálculos de días limpios del usuario
  const myDaysClean = profile?.smoke_free_since
    ? Math.max(0, Math.floor((Date.now() - new Date(profile.smoke_free_since).getTime()) / (1000 * 60 * 60 * 24)))
    : 0

  const totalUnreadMessages = useMemo(
    () =>
      Object.values(unreadCounts).reduce((a, b) => a + b, 0) +
      Object.values(unreadGroupCounts).reduce((a, b) => a + b, 0),
    [unreadCounts, unreadGroupCounts]
  )

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
          <p className="font-fraunces text-sm text-[#A9BBA4]">Abriendo Exhala...</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen w-full flex justify-center py-0 sm:py-6 antialiased select-none"
      style={{
        background: 'radial-gradient(120% 90% at 50% -10%, #223729 0%, #16241C 45%, #0F1913 100%)',
        fontFamily: "'Work Sans', sans-serif",
        color: '#F1EEE2',
      }}
    >
      {/* PANTALLA CONTENEDORA MÓVIL (390px) */}
      <div
        className="w-full sm:w-[390px] min-h-screen sm:min-h-[844px] relative flex flex-col sm:rounded-[34px] overflow-hidden sm:border sm:border-[rgba(232,183,94,0.08)] sm:shadow-[0_40px_80px_rgba(0,0,0,0.5)] pb-[90px]"
        style={{
          background: 'radial-gradient(120% 90% at 50% -10%, #223729 0%, #16241C 45%, #0F1913 100%)',
        }}
      >
        {/* TEXTURA AMBIENTAL */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 15% 8%, rgba(232,183,94,0.07), transparent 40%), radial-gradient(circle at 85% 92%, rgba(169,187,164,0.06), transparent 45%)',
          }}
        />

        {/* TOAST DE FEEDBACK */}
        {toastMessage && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-xs bg-[#16241C]/95 border border-[rgba(232,183,94,0.3)] text-[#F1EEE2] text-xs py-2.5 px-3.5 rounded-2xl shadow-xl flex items-center gap-2.5 backdrop-blur-md animate-in fade-in slide-in-from-top-3">
            <Sparkles className="w-3.5 h-3.5 text-[#E8B75E] shrink-0" />
            <span className="font-medium leading-tight">{toastMessage}</span>
          </div>
        )}

        {/* =================================================================== */}
        {/* 1. BARRA DE HISTORIAS DE 24H Y CONTADOR DÍAS LIMPIOS ARRIBA DERECHA */}
        {/* =================================================================== */}
        <div className="pt-3.5 px-[16px] relative z-10">
          {profile?.role !== 'friend' && (
            <div className="flex items-center justify-end mb-1 px-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[rgba(232,183,94,0.1)] border border-[rgba(232,183,94,0.24)] shadow-xs">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span className="text-[11.5px] font-bold text-[#E8B75E] tracking-tight">
                  {myDaysClean} {myDaysClean === 1 ? 'día libre' : 'días libres'}
                </span>
              </div>
            </div>
          )}

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
        {/* 3. RESUMEN DE TU PROPIA PLANTA / JARDÍN (HERO ACCESIBLE)             */}
        {/* =================================================================== */}
        {profile?.role !== 'friend' && (
          <div className="px-[18px] mb-3">
            <div
              onClick={() => setShowOwnGardenModal(true)}
              className="p-3.5 rounded-[22px] border border-[rgba(232,183,94,0.16)] bg-[rgba(255,255,255,0.025)] hover:border-[rgba(232,183,94,0.3)] transition-all flex items-center justify-between cursor-pointer group shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#253A2C] to-[#16241C] border border-[rgba(232,183,94,0.2)] flex items-center justify-center text-[#E8B75E] shrink-0 group-hover:scale-105 transition-transform">
                  <Sprout className="w-5 h-5 text-[#E8B75E]" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-fraunces font-medium text-[14px] text-[#F1EEE2]">
                      {mySpecies.name}
                    </span>
                    <span className="text-[10px] text-[#E8B75E] font-semibold bg-[#E8B75E]/10 border border-[#E8B75E]/20 px-1.5 py-0.2 rounded-md">
                      Etapa {myPlantStage}/30
                    </span>
                  </div>
                  <div className="text-[11px] text-[#7C9481] mt-0.5 flex items-center gap-2">
                    <span>{myDaysClean} {myDaysClean === 1 ? 'día libre' : 'días libres'}</span>
                    <span>•</span>
                    <span className="text-[#A9BBA4]">Toca para ver jardín</span>
                  </div>
                </div>
              </div>

              {/* Botón rápido de regar tu planta */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  if (userId) handleWaterPlant(userId)
                }}
                disabled={myCooldownSeconds > 0 || isWateringActive}
                className="w-9 h-9 rounded-full bg-gradient-to-r from-[#EFC471] to-[#E8B75E] text-[#1B1710] flex items-center justify-center font-bold text-sm shrink-0 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:scale-100 transition-all shadow-sm cursor-pointer"
                title={myCooldownSeconds > 0 ? 'Regado recientemente' : 'Regar mi planta'}
              >
                <Droplets className="w-4 h-4 fill-[#1B1710]" />
              </button>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* 4. SELECTOR DE 2 OPCIONES: AMIGOS Y GRUPOS                          */}
        {/* =================================================================== */}
        <div className="px-[18px] mb-3">
          <div className="grid grid-cols-2 p-1 rounded-2xl bg-black/30 border border-[rgba(232,183,94,0.12)]">
            <button
              type="button"
              onClick={() => handleTabChange('friends')}
              className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'friends'
                  ? 'bg-gradient-to-r from-[#EFC471] to-[#E8B75E] text-[#1B1710] shadow-md font-bold'
                  : 'text-[#A9BBA4] hover:text-[#F1EEE2]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Amigos</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === 'friends'
                    ? 'bg-[#1B1710] text-[#E8B75E]'
                    : 'bg-white/10 text-[#A9BBA4]'
                }`}
              >
                {friendsList.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('groups')}
              className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer relative ${
                activeTab === 'groups'
                  ? 'bg-gradient-to-r from-[#EFC471] to-[#E8B75E] text-[#1B1710] shadow-md font-bold'
                  : 'text-[#A9BBA4] hover:text-[#F1EEE2]'
              }`}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Grupos</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === 'groups'
                    ? 'bg-[#1B1710] text-[#E8B75E]'
                    : 'bg-white/10 text-[#A9BBA4]'
                }`}
              >
                {groupsList.length}
              </span>
              {Object.keys(unreadGroupCounts).length > 0 && (
                <span className="w-2 h-2 rounded-full bg-[#E8547C] absolute top-1 right-2 animate-pulse" />
              )}
            </button>
          </div>
        </div>

        {/* =================================================================== */}
        {/* 5. CONTENIDO: TABLA DE AMIGOS O LISTA DE GRUPOS                     */}
        {/* =================================================================== */}
        <main className="flex-1 px-[18px] overflow-y-auto no-scrollbar space-y-2">
          {activeTab === 'friends' ? (
            /* =============================================================== */
            /* TABLA LIMPIA DE AMIGOS                                          */
            /* =============================================================== */
            friendsList.length === 0 ? (
              <div className="space-y-3">
                {pendingReceived.length > 0 && (
                  <div
                    onClick={() => setShowAddFriendModal(true)}
                    className="p-3 rounded-2xl border border-[rgba(232,183,94,0.3)] bg-[rgba(232,183,94,0.08)] flex items-center justify-between cursor-pointer hover:bg-[rgba(232,183,94,0.14)] transition-all shadow-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-[#E8B75E] text-[#1B1710] font-bold text-xs flex items-center justify-center shadow-xs">
                        {pendingReceived.length}
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-[#F1EEE2]">
                          {pendingReceived.length === 1
                            ? '1 solicitud de amistad recibida'
                            : `${pendingReceived.length} solicitudes recibidas`}
                        </h4>
                        <span className="text-[10.5px] text-[#A9BBA4]">Toca para responder</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#E8B75E]" />
                  </div>
                )}

                <div className="py-10 text-center space-y-3 p-6 rounded-3xl border border-[rgba(232,183,94,0.1)] bg-[rgba(255,255,255,0.01)]">
                  <Users className="w-8 h-8 text-[#E8B75E]/60 mx-auto" />
                  <div className="space-y-1">
                    <h3 className="font-fraunces font-medium text-sm text-[#F1EEE2]">
                      Aún no tienes amigos conectados
                    </h3>
                    <p className="text-xs text-[#7C9481] max-w-xs mx-auto">
                      Conectar con amigos y guardianes multiplica por 3 el éxito de no fumar.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddFriendModal(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-[#EFC471] to-[#E8B75E] text-[#1B1710] text-xs font-bold hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-md"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Buscar y Añadir Amigos</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingReceived.length > 0 && (
                  <div
                    onClick={() => setShowAddFriendModal(true)}
                    className="p-3 rounded-2xl border border-[rgba(232,183,94,0.3)] bg-[rgba(232,183,94,0.08)] flex items-center justify-between cursor-pointer hover:bg-[rgba(232,183,94,0.14)] transition-all mb-2 shadow-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-[#E8B75E] text-[#1B1710] font-bold text-xs flex items-center justify-center shadow-xs">
                        {pendingReceived.length}
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-[#F1EEE2]">
                          {pendingReceived.length === 1
                            ? '1 solicitud de amistad recibida'
                            : `${pendingReceived.length} solicitudes recibidas`}
                        </h4>
                        <span className="text-[10.5px] text-[#A9BBA4]">Toca para responder</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#E8B75E]" />
                  </div>
                )}

                <div className="flex items-center justify-between pt-1 pb-0.5 px-1">
                  <span className="text-xs text-[#7C9481]">Tus compañeros de camino</span>
                  <button
                    type="button"
                    onClick={() => setShowAddFriendModal(true)}
                    className="px-3 py-1 rounded-full bg-[#E8B75E]/15 border border-[#E8B75E]/30 text-[#E8B75E] text-xs font-semibold flex items-center gap-1.5 hover:bg-[#E8B75E]/25 transition-all cursor-pointer active:scale-95 shadow-xs"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Añadir Amigo</span>
                    {pendingReceived.length > 0 && (
                      <span className="w-2 h-2 rounded-full bg-[#E8547C] animate-pulse" />
                    )}
                  </button>
                </div>
                {friendsList.map((friend) => {
                  const unread = unreadCounts[friend.id] || 0
                  return (
                    <div
                      key={friend.id}
                      onClick={() => setSelectedFriendDetail(friend)}
                      className="p-3 rounded-2xl border border-[rgba(232,183,94,0.12)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(232,183,94,0.28)] hover:bg-[rgba(255,255,255,0.04)] transition-all flex items-center justify-between gap-3 cursor-pointer group"
                    >
                      {/* Avatar y Nombre */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#3B5240] to-[#22321F] border border-[rgba(232,183,94,0.18)] text-[#E8B75E] font-bold text-xs flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                          {friend.initials}
                        </div>

                        <div className="min-w-0">
                          <h4 className="font-medium text-[13.5px] text-[#F1EEE2] truncate leading-tight">
                            {friend.name}
                          </h4>
                          <span className="inline-flex items-center gap-1 text-[11px] text-[#7C9481] mt-0.5">
                            {friend.role === 'smoker' ? (
                              <>
                                <Sparkles className="w-3 h-3 text-emerald-400" />
                                <span className="text-[#A9BBA4] font-medium">{friend.status}</span>
                              </>
                            ) : (
                              <>
                                <Shield className="w-3 h-3 text-sky-300" />
                                <span className="text-sky-300 font-medium">Guardián</span>
                              </>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Botones de Acción: Chat y Riego */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Botón de Chat */}
                        <button
                          type="button"
                          onClick={(e) => handleOpenFriendChat(friend, e)}
                          className="h-8 px-2.5 rounded-full bg-[rgba(232,183,94,0.08)] hover:bg-[rgba(232,183,94,0.2)] border border-[rgba(232,183,94,0.22)] text-[#E8B75E] flex items-center justify-center gap-1 transition-all active:scale-90 relative cursor-pointer"
                          title="Abrir chat individual"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          {unread > 0 && (
                            <span className="min-w-[14px] h-[14px] px-1 rounded-full bg-[#E8547C] text-white text-[8px] font-bold flex items-center justify-center animate-pulse">
                              {unread}
                            </span>
                          )}
                        </button>

                        {/* Botón rápido de Riego */}
                        {friend.role === 'smoker' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleWaterPlant(friend.id, friend.name)
                            }}
                            disabled={!friend.canWater || isWateringActive}
                            className="w-8 h-8 rounded-full bg-[rgba(82,183,136,0.1)] hover:bg-[rgba(82,183,136,0.25)] border border-[rgba(82,183,136,0.3)] text-[#52B788] flex items-center justify-center text-xs disabled:opacity-40 transition-all active:scale-90 cursor-pointer"
                            title={friend.canWater ? 'Regar su planta' : 'Regado recientemente'}
                          >
                            <Droplets className="w-3.5 h-3.5 fill-current" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          ) : (
            /* =============================================================== */
            /* PESTAÑA GRUPOS DE AMIGOS CON MENSAJES EN DIRECTO                */
            /* =============================================================== */
            <div className="space-y-3">
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-[#7C9481]">Tus salas comunitarias</span>
                <button
                  type="button"
                  onClick={() => setShowCreateGroupModal(true)}
                  className="px-3 py-1 rounded-full bg-[#E8B75E]/15 border border-[#E8B75E]/30 text-[#E8B75E] text-xs font-semibold flex items-center gap-1 hover:bg-[#E8B75E]/25 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Crear Grupo</span>
                </button>
              </div>

              {groupsList.length === 0 ? (
                <div className="py-10 text-center space-y-3 p-6 rounded-3xl border border-[rgba(232,183,94,0.1)] bg-[rgba(255,255,255,0.01)]">
                  <Users className="w-8 h-8 text-[#E8B75E]/60 mx-auto" />
                  <div className="space-y-1">
                    <h3 className="font-fraunces font-medium text-sm text-[#F1EEE2]">
                      No perteneces a ningún grupo aún
                    </h3>
                    <p className="text-xs text-[#7C9481] max-w-xs mx-auto">
                      Crea un grupo de apoyo mutuo para chatear en directo con tus amigos.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCreateGroupModal(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-[#EFC471] to-[#E8B75E] text-[#1B1710] text-xs font-bold shadow-md cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Crear Mi Primer Grupo</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {groupsList.map((grp) => {
                    const hasUnread = Boolean(unreadGroupCounts[grp.id])
                    return (
                      <div
                        key={grp.id}
                        onClick={() => handleOpenGroupChat(grp)}
                        className="p-3.5 rounded-2xl border border-[rgba(232,183,94,0.14)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(232,183,94,0.35)] hover:bg-[rgba(255,255,255,0.04)] transition-all flex items-center justify-between gap-3 cursor-pointer group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#EFC471] to-[#E8B75E] text-[#1B1710] font-bold text-sm flex items-center justify-center shrink-0 shadow-sm">
                            <Users className="w-4 h-4 text-[#1B1710]" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-[13.5px] text-[#F1EEE2] truncate">
                                {grp.name}
                              </h4>
                              {hasUnread && (
                                <span className="w-2 h-2 rounded-full bg-[#E8547C] animate-pulse" />
                              )}
                            </div>
                            <p className="text-[11px] text-[#7C9481] truncate mt-0.5">
                              {grp.last_message?.content || `${grp.member_count} participantes`}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] text-[#E8B75E] font-medium bg-[#E8B75E]/10 px-2.5 py-1 rounded-full border border-[#E8B75E]/20 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>En vivo</span>
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </main>

        {/* =================================================================== */}
        {/* 6. BOTONES FLOTANTES: SOS (DERECHA) Y TROPIEZO 1€ (IZQUIERDA)       */}
        {/* =================================================================== */}
        {/* BOTÓN FLOTANTE REGISTRAR TROPIEZO (1 €) - ABAJO A LA IZQUIERDA */}
        {profile?.role !== 'friend' && (
          <button
            type="button"
            onClick={() => setShowRelapseModal(true)}
            aria-label="Registrar tropiezo (1 €)"
            title="Registrar cigarrillo fumado (1 € de aportación al bote)"
            className="fixed bottom-[66px] left-[max(16px,calc(50%-175px))] w-[46px] h-[46px] rounded-full flex items-center justify-center z-50 cursor-pointer shadow-[0_8px_24px_rgba(0,0,0,0.5)] transition-transform hover:scale-105 active:scale-90"
            style={{
              background: 'rgba(232, 183, 94, 0.16)',
              backdropFilter: 'blur(8px)',
              border: '1.5px solid rgba(232, 183, 94, 0.45)',
              color: '#E8B75E',
            }}
          >
            <Coins className="w-5 h-5 text-[#E8B75E]" />
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-gradient-to-r from-[#EFC471] to-[#E8B75E] text-[#1B1710] font-black text-[9px] rounded-full flex items-center justify-center shadow-md">
              1€
            </span>
          </button>
        )}

        {/* BOTÓN FLOTANTE SOS - ABAJO A LA DERECHA */}
        <button
          type="button"
          onClick={handleTriggerSOS}
          aria-label="Activar alerta SOS"
          className="fixed bottom-[66px] right-[max(16px,calc(50%-175px))] w-[46px] h-[46px] rounded-full flex items-center justify-center z-50 cursor-pointer shadow-[0_8px_24px_rgba(0,0,0,0.5)] transition-transform hover:scale-105 active:scale-90"
          style={{
            background: 'rgba(232, 84, 124, 0.16)',
            backdropFilter: 'blur(8px)',
            border: '1.5px solid rgba(232, 84, 124, 0.5)',
            color: '#E8547C',
          }}
        >
          <HeartPulse className="w-5 h-5 text-[#E8547C]" />
          <span className="absolute -inset-[5px] rounded-full border-[1.5px] border-[rgba(232,84,124,0.3)] animate-pulse-ring pointer-events-none" />
        </button>

        {/* =================================================================== */}
        {/* 7. NAVEGACIÓN INFERIOR (2 BOTONES: INICIO Y PERFIL)                 */}
        {/* =================================================================== */}
        <BottomNav currentTab="home" unreadFriendsCount={totalUnreadMessages} />
      </div>

      {/* =================================================================== */}
      {/* 8. MODAL DETALLADO DE AMIGO: JARDÍN BOTÁNICO Y GANANCIAS (SOLICITADO)*/}
      {/* =================================================================== */}
      {selectedFriendDetail && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200 select-none">
          <div
            className="w-full sm:w-[390px] max-h-[90vh] rounded-t-[32px] sm:rounded-[32px] border border-[rgba(232,183,94,0.18)] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300"
            style={{
              background: 'radial-gradient(120% 90% at 50% -10%, #223729 0%, #16241C 45%, #0F1913 100%)',
              color: '#F1EEE2',
            }}
          >
            {/* CABECERA DEL DETALLE */}
            <header className="pt-4 px-5 pb-3 border-b border-[rgba(232,183,94,0.12)] flex items-center justify-between bg-[rgba(255,255,255,0.02)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#EFC471] to-[#E8B75E] text-[#1B1710] font-bold text-xs flex items-center justify-center shrink-0 shadow-md">
                  {selectedFriendDetail.initials}
                </div>
                <div>
                  <h3 className="font-fraunces font-medium text-[16px] text-[#F1EEE2] leading-tight">
                    {selectedFriendDetail.name}
                  </h3>
                  <span className="text-[11px] text-[#7C9481]">
                    {selectedFriendDetail.status}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedFriendDetail(null)}
                className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#A9BBA4] hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            {/* CONTENIDO SCROLLABLE DEL AMIGO */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4 no-scrollbar">
              {/* 1. SECCIÓN JARDÍN BOTÁNICO VIVO DEL AMIGO */}
              <div
                className="rounded-[24px] p-5 border border-[rgba(232,183,94,0.18)] text-center space-y-3 relative overflow-hidden"
                style={{
                  background: 'linear-gradient(180deg, rgba(232,183,94,0.06), rgba(255,255,255,0.01))',
                }}
              >
                <div className="flex justify-between items-center">
                  <span className="text-[10.5px] uppercase font-bold tracking-wider text-[#E8B75E] bg-[#E8B75E]/10 border border-[#E8B75E]/20 px-2.5 py-0.5 rounded-full">
                    Jardín Botánico
                  </span>
                  <span className="text-xs text-[#7C9481]">
                    Etapa {(selectedFriendDetail.totalWaterings || 0) % 30}/30
                  </span>
                </div>

                {/* Visualizador de la Planta */}
                <div className="py-2">
                  <GardenPlantVisualizer
                    stage={(selectedFriendDetail.totalWaterings || 0) % 30}
                    speciesIndex={Math.floor((selectedFriendDetail.totalWaterings || 0) / 30)}
                    size="md"
                  />
                </div>

                <div>
                  <h4 className="font-fraunces font-medium text-[18px] text-[#F1EEE2]">
                    {selectedFriendDetail.plantSpecies || 'Bonsái Zen de Jade'}
                  </h4>
                  <p className="text-[11.5px] text-[#7C9481] mt-0.5">
                    {selectedFriendDetail.totalWaterings || 0} riegos acumulados de vitalidad
                  </p>
                </div>

                {/* Botón de Riego de Apoyo */}
                <button
                  type="button"
                  onClick={() => handleWaterPlant(selectedFriendDetail.id, selectedFriendDetail.name)}
                  disabled={!selectedFriendDetail.canWater || isWateringActive}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#EFC471] to-[#E8B75E] text-[#1B1710] font-bold text-xs flex items-center justify-center gap-1.5 shadow-md hover:scale-[1.01] active:scale-[0.98] disabled:opacity-40 transition-all cursor-pointer"
                >
                  <Droplets className="w-4 h-4 fill-[#1B1710]" />
                  <span>
                    {selectedFriendDetail.canWater
                      ? 'Regar su planta (+1 vitalidad)'
                      : 'Planta regada recientemente'}
                  </span>
                </button>
              </div>

              {/* 2. SECCIÓN GANANCIAS ACUMULADAS Y DINERO AHORRADO */}
              {selectedFriendDetail.role === 'smoker' && selectedFriendDetail.smokeFreeSince && (
                (() => {
                  const fDaysClean = Math.max(
                    0,
                    Math.floor((Date.now() - new Date(selectedFriendDetail.smokeFreeSince).getTime()) / (1000 * 60 * 60 * 24))
                  )
                  const fCigsPerDay = selectedFriendDetail.cigsPerDay || 15
                  const fPackPrice = selectedFriendDetail.packPrice || 5.5
                  const fDailySavings = fCigsPerDay * (fPackPrice / 20)
                  const fTotalSaved = fDaysClean * fDailySavings
                  const fCigsAvoided = fDaysClean * fCigsPerDay

                  return (
                    <div
                      className="rounded-[24px] p-5 border border-[rgba(232,183,94,0.18)] space-y-3.5 shadow-md"
                      style={{
                        background: 'radial-gradient(120% 90% at 50% -10%, rgba(232,183,94,0.08) 0%, rgba(22,36,28,0.7) 100%)',
                      }}
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-[rgba(232,183,94,0.1)]">
                        <div className="flex items-center gap-2">
                          <Coins className="w-4 h-4 text-[#E8B75E]" />
                          <h4 className="font-fraunces font-medium text-[15px] text-[#F1EEE2]">
                            Ahorro Financiero
                          </h4>
                        </div>
                        <span className="text-[10px] text-[#52B788] font-bold bg-[#52B788]/10 border border-[#52B788]/20 px-2 py-0.5 rounded-full">
                          +{fTotalSaved.toFixed(2)} €
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 text-center">
                          <span className="text-[10px] text-[#7C9481] block">Cigarrillos evitados</span>
                          <span className="font-fraunces font-bold text-[16px] text-[#F1EEE2] block mt-0.5">
                            {fCigsAvoided.toLocaleString('es-ES')}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 text-center">
                          <span className="text-[10px] text-[#7C9481] block">Ahorro diario</span>
                          <span className="font-fraunces font-bold text-[16px] text-[#E8B75E] block mt-0.5">
                            {fDailySavings.toFixed(2)} €
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })()
              )}

              {/* 3. BOTÓN DE CHAT DIRECTO CON EL AMIGO */}
              <button
                type="button"
                onClick={() => {
                  const targetFr = friendsList.find((f) => f.id === selectedFriendDetail.id)
                  if (targetFr) {
                    setSelectedFriendDetail(null)
                    setActiveChatFriend(targetFr)
                  }
                }}
                className="w-full py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-[#F1EEE2] font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 text-[#E8B75E]" />
                <span>Enviar mensaje a {selectedFriendDetail.name}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 9. MODAL VER PROPIO JARDÍN COMPLETO                                */}
      {/* =================================================================== */}
      {showOwnGardenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-[28px] bg-[#16241C] border border-[#23382B] shadow-2xl flex flex-col overflow-hidden max-h-[85vh]">
            <header className="px-5 py-4 border-b border-[#23382B] flex items-center justify-between">
              <div>
                <h3 className="font-fraunces font-bold text-base text-[#F1EEE2]">
                  Mi Planta Botánica
                </h3>
                <p className="text-[11px] text-[#7C9481]">
                  Nivel {Math.floor(myPlantStage / 5) + 1} • {mySpecies.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowOwnGardenModal(false)}
                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[#7C9481] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            <div className="flex-1 p-5 overflow-y-auto space-y-4 no-scrollbar text-center">
              <div className="py-2">
                <GardenPlantVisualizer
                  stage={myPlantStage}
                  speciesIndex={myPlantIndex}
                  size="lg"
                />
              </div>

              <div>
                <h4 className="font-fraunces font-medium text-[20px] text-[#F1EEE2]">
                  {mySpecies.name}
                </h4>
                <p className="text-xs text-[#E8B75E] italic mt-0.5">
                  {mySpecies.scientificName}
                </p>
                <p className="text-xs text-[#A9BBA4] mt-2 max-w-xs mx-auto leading-relaxed">
                  {mySpecies.healingBenefit}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-black/30 border border-[rgba(232,183,94,0.12)] space-y-2 text-left">
                <div className="flex justify-between text-xs">
                  <span className="text-[#7C9481]">Maduración del espécimen</span>
                  <span className="text-[#E8B75E] font-bold">{myPlantStage} / 30 riegos</span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#52B788] to-[#E8B75E] rounded-full transition-all duration-500"
                    style={{ width: `${myProgressPercent}%` }}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (userId) handleWaterPlant(userId)
                }}
                disabled={myCooldownSeconds > 0 || isWateringActive}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#EFC471] to-[#E8B75E] text-[#1B1710] font-bold text-xs flex items-center justify-center gap-1.5 shadow-md disabled:opacity-40 transition-all cursor-pointer"
              >
                <Droplets className="w-4 h-4 fill-[#1B1710]" />
                <span>
                  {myCooldownSeconds > 0
                    ? `Próximo riego en ${Math.floor(myCooldownSeconds / 3600)}h ${Math.floor((myCooldownSeconds % 3600) / 60)}m`
                    : 'Regar mi planta (+1 vitalidad)'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 10. MODALES DE CHAT, HISTORIAS Y CREAR GRUPO                        */}
      {/* =================================================================== */}
      {activeChatFriend && (
        <FriendChatModal
          friend={activeChatFriend}
          currentUserId={userId}
          currentUserName={userName}
          onClose={() => setActiveChatFriend(null)}
        />
      )}

      {activeChatGroup && (
        <GroupChatModal
          group={activeChatGroup}
          currentUserId={userId}
          currentUserName={userName}
          currentUserAvatarUrl={profile?.avatar_url || null}
          friends={friendsList.map((f) => ({
            id: f.id,
            name: f.name,
            initials: f.initials,
            role: f.role,
          }))}
          onClose={() => setActiveChatGroup(null)}
          onMembersAdded={() => {
            if (userId) loadGroupsData(userId)
          }}
        />
      )}

      {/* =================================================================== */}
      {/* 11. MODAL AÑADIR AMIGOS EN INICIO (CÓDIGO DE ESCUADRÓN Y BÚSQUEDA)  */}
      {/* =================================================================== */}
      {showAddFriendModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200 select-none">
          <div
            className="w-full sm:w-[390px] max-h-[88vh] rounded-t-[32px] sm:rounded-[32px] border border-[rgba(232,183,94,0.2)] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300"
            style={{
              background: 'radial-gradient(120% 90% at 50% -10%, #253A2C 0%, #16241C 50%, #0F1913 100%)',
              color: '#F1EEE2',
            }}
          >
            {/* Cabecera */}
            <header className="pt-4 px-5 pb-3 border-b border-[rgba(232,183,94,0.12)] flex items-center justify-between bg-[rgba(255,255,255,0.02)]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[rgba(232,183,94,0.12)] border border-[rgba(232,183,94,0.25)] flex items-center justify-center text-[#E8B75E]">
                  <UserPlus className="w-4 h-4 text-[#E8B75E]" />
                </div>
                <div>
                  <h3 className="font-fraunces font-medium text-[16px] text-[#F1EEE2] leading-tight">
                    Añadir Amigos
                  </h3>
                  <p className="text-[11px] text-[#7C9481]">
                    Tu escuadrón de apoyo sin humo
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowAddFriendModal(false)
                  setSearchQuery('')
                  setSearchResults([])
                }}
                className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#A9BBA4] hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            <div className="flex-1 p-5 overflow-y-auto space-y-4 no-scrollbar">
              {/* 1. Tarjeta Código de Escuadrón Propio */}
              <div
                className="p-4 rounded-2xl border border-[rgba(232,183,94,0.2)] space-y-2.5"
                style={{
                  background: 'linear-gradient(180deg, rgba(232,183,94,0.08), rgba(255,255,255,0.015))',
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] uppercase font-bold tracking-wider text-[#E8B75E]">
                    Tu Código de Escuadrón
                  </span>
                  <span className="text-[10px] text-[#7C9481]">Comparte con amigos</span>
                </div>

                <div className="flex items-center justify-between bg-black/40 border border-white/10 px-3.5 py-2.5 rounded-xl">
                  <span className="font-mono font-bold text-sm tracking-widest text-[#F1EEE2]">
                    {squadCode || `EXHALA-${userId?.slice(0, 5).toUpperCase() || 'RED'}`}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleCopySquadCode}
                      className="px-2.5 py-1 rounded-lg bg-[rgba(232,183,94,0.15)] border border-[rgba(232,183,94,0.3)] text-[#E8B75E] text-xs font-semibold flex items-center gap-1 hover:bg-[rgba(232,183,94,0.25)] transition-all cursor-pointer active:scale-95"
                      title="Copiar código"
                    >
                      {copiedCode ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 text-[11px]">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span className="text-[11px]">Copiar</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleShareInvite}
                      className="p-1 rounded-lg bg-white/5 border border-white/10 text-[#A9BBA4] hover:text-[#F1EEE2] transition-colors cursor-pointer"
                      title="Compartir enlace"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* 2. Solicitudes Recibidas Pendientes (si hay) */}
              {pendingReceived.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between px-1">
                    <span className="font-fraunces font-medium text-xs text-[#E8B75E]">
                      Solicitudes pendientes ({pendingReceived.length})
                    </span>
                    <span className="text-[10px] text-[#7C9481]">Esperan tu respuesta</span>
                  </div>

                  <div className="space-y-2">
                    {pendingReceived.map((req) => (
                      <div
                        key={req.id}
                        className="p-3 rounded-2xl border border-[rgba(232,183,94,0.25)] bg-[rgba(232,183,94,0.06)] flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#EFC471] to-[#E8B75E] text-[#1B1710] font-bold text-xs flex items-center justify-center shrink-0">
                            {req.initials}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-medium text-[13px] text-[#F1EEE2] truncate">
                              {req.name}
                            </h4>
                            <span className="text-[10.5px] text-[#A9BBA4]">
                              {req.role === 'smoker' ? 'Dejando de fumar' : 'Guardián'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleAcceptRequest(req)}
                            disabled={processingFriendId === req.id}
                            className="h-8 px-3 rounded-full bg-gradient-to-r from-[#EFC471] to-[#E8B75E] text-[#1B1710] text-xs font-bold flex items-center gap-1 shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                          >
                            {processingFriendId === req.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <>
                                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>Aceptar</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRejectRequest(req)}
                            disabled={processingFriendId === req.id}
                            className="w-8 h-8 rounded-full bg-white/5 border border-white/10 text-[#A9BBA4] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                            title="Rechazar"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Buscador en vivo de usuarios */}
              <div className="space-y-2 pt-1">
                <span className="text-xs text-[#A9BBA4] font-medium block px-1">
                  Buscar personas por nombre o código:
                </span>

                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7C9481]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Escribe un nombre o EXHALA-XXXXX..."
                    className="w-full h-11 pl-10 pr-10 rounded-2xl bg-white/5 border border-[rgba(232,183,94,0.18)] text-[#F1EEE2] text-xs placeholder:text-[#7C9481] focus:outline-none focus:border-[#E8B75E] transition-colors"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7C9481] hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Resultados de búsqueda */}
                {isSearching ? (
                  <div className="py-8 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-[#E8B75E]" />
                    <span className="text-xs text-[#7C9481]">Buscando en la comunidad...</span>
                  </div>
                ) : searchQuery.trim() && searchResults.length === 0 ? (
                  <div className="py-8 text-center space-y-1 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                    <Users className="w-6 h-6 text-[#7C9481] mx-auto opacity-60" />
                    <p className="text-xs text-[#A9BBA4]">No se encontraron usuarios</p>
                    <p className="text-[11px] text-[#7C9481]">
                      Prueba con otro nombre o asegúrate de que el código sea correcto.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {searchResults.map((user) => {
                      const isFriend = friendsList.some((f) => f.id === user.id)
                      const isSent = Boolean(sentRequestMap[user.id])
                      const isProcessing = processingFriendId === user.id

                      return (
                        <div
                          key={user.id}
                          className="p-3 rounded-2xl border border-[rgba(232,183,94,0.12)] bg-[rgba(255,255,255,0.025)] hover:border-[rgba(232,183,94,0.25)] transition-all flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#3B5240] to-[#22321F] border border-[rgba(232,183,94,0.18)] text-[#E8B75E] font-bold text-xs flex items-center justify-center shrink-0">
                              {getInitials(user.full_name || 'Compañero')}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-medium text-[13px] text-[#F1EEE2] truncate">
                                {user.full_name || 'Compañero'}
                              </h4>
                              <span className="text-[10.5px] text-[#7C9481]">
                                {user.role === 'smoker' ? 'Dejando de fumar' : 'Guardián'}
                              </span>
                            </div>
                          </div>

                          <div className="shrink-0">
                            {isFriend ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#52B788] bg-[rgba(82,183,136,0.1)] border border-[rgba(82,183,136,0.25)] px-2.5 py-1 rounded-full">
                                <Check className="w-3 h-3" />
                                <span>Amigo</span>
                              </span>
                            ) : isSent ? (
                              <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-[#E8B75E] bg-[rgba(232,183,94,0.1)] border border-[rgba(232,183,94,0.25)] px-2.5 py-1 rounded-full">
                                <Clock className="w-3 h-3" />
                                <span>Enviada</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSendFriendRequest(user)}
                                disabled={isProcessing}
                                className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-[#1B1710] bg-gradient-to-r from-[#EFC471] to-[#E8B75E] px-3.5 py-1.5 rounded-full hover:scale-105 active:scale-95 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                              >
                                {isProcessing ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <>
                                    <UserPlus className="w-3.5 h-3.5" />
                                    <span>Añadir</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Pie del modal */}
            <footer className="p-3.5 border-t border-[rgba(232,183,94,0.1)] bg-[rgba(0,0,0,0.25)] flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowAddFriendModal(false)
                  setSearchQuery('')
                  setSearchResults([])
                }}
                className="text-xs font-semibold text-[#E8B75E] hover:text-[#F1EEE2] py-2 px-4 rounded-xl bg-white/5 border border-white/10 transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </footer>
          </div>
        </div>
      )}

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
          onGroupCreated={(newGrp) => {
            setGroupsList((prev) => [newGrp, ...prev])
            handleOpenGroupChat(newGrp)
          }}
        />
      )}

      {showCreateStoryModal && (
        <CreateStoryModal
          currentUserId={userId}
          currentUserName={userName}
          initialImage={initialStoryImage}
          onClose={() => {
            setShowCreateStoryModal(false)
            setInitialStoryImage(null)
          }}
          onStoryCreated={() => {
            if (userId) loadStoriesData(userId)
          }}
        />
      )}

      {activeStoryUserIndex !== null && (
        <StoryViewerModal
          usersWithStories={storiesUsers}
          initialUserIndex={activeStoryUserIndex}
          currentUserId={userId}
          currentUserName={userName}
          onClose={() => setActiveStoryUserIndex(null)}
          onStoryDeleted={(deletedStoryId, authorUserId) => {
            setStoriesUsers((prev) => {
              return prev
                .map((userGrp) => {
                  if (userGrp.userId === authorUserId) {
                    return {
                      ...userGrp,
                      stories: userGrp.stories.filter((s) => s.id !== deletedStoryId),
                    }
                  }
                  return userGrp
                })
                .filter((userGrp) => userGrp.stories.length > 0)
            })
            if (userId) loadStoriesData(userId)
          }}
        />
      )}

      {/* MODAL SOS: RESPIRACIÓN 60s */}
      {sosOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200 select-none">
          <div
            className="w-full max-w-sm rounded-[28px] p-6 space-y-5 border border-[rgba(232,84,124,0.3)] relative text-center shadow-2xl"
            style={{
              background: 'radial-gradient(circle at 50% 0%, #2A171D, #16241C)',
              color: '#F1EEE2',
            }}
          >
            <button
              type="button"
              onClick={() => setSosOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 text-[#A9BBA4] hover:text-white flex items-center justify-center cursor-pointer"
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
                {sosSending ? 'Avisando a tus amigos...' : 'Alerta SOS enviada a tus amigos.'}
              </p>
            </div>

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

      {/* =================================================================== */}
      {/* 11. MODAL REGISTRAR TROPIEZO / CIGARRILLO FUMADO (MULTA 1 €)        */}
      {/* =================================================================== */}
      {showRelapseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200 select-none">
          <div
            className="w-full max-w-sm rounded-[28px] p-6 space-y-4 border border-[rgba(232,183,94,0.25)] relative text-center shadow-2xl"
            style={{
              background: 'radial-gradient(120% 90% at 50% -10%, #253A2C 0%, #16241C 50%, #0F1913 100%)',
              color: '#F1EEE2',
            }}
          >
            <button
              type="button"
              onClick={() => setShowRelapseModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 border border-white/10 text-[#A9BBA4] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 mx-auto rounded-full bg-[rgba(232,183,94,0.14)] border border-[rgba(232,183,94,0.3)] flex items-center justify-center text-[#E8B75E] shadow-sm">
              <Coins className="w-6 h-6 text-[#E8B75E]" />
            </div>

            <div className="space-y-1">
              <span className="text-[10.5px] uppercase font-bold tracking-wider text-[#E8B75E] bg-[#E8B75E]/10 border border-[#E8B75E]/20 px-2.5 py-0.5 rounded-full">
                Compromiso y Honestidad
              </span>
              <h3 className="font-fraunces text-xl font-medium text-[#F1EEE2] pt-1">
                ¿Has fumado un cigarrillo?
              </h3>
              <p className="text-xs text-[#A9BBA4] leading-relaxed max-w-xs mx-auto">
                Un tropiezo no anula lo que has construido. Sé honesto contigo mismo y sigue adelante con más fuerza.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-black/35 border border-[rgba(232,183,94,0.15)] space-y-1 text-center">
              <span className="text-[11px] text-[#7C9481]">Aportación acordada al bote común</span>
              <div className="font-fraunces font-bold text-2xl text-[#E8B75E]">
                +{(Number(profile?.penalty_amount) || 1.0).toFixed(2)} €
              </div>
              <span className="text-[10px] text-[#A9BBA4] block">
                Tu contador limpio se reiniciará hoy para marcar tu nuevo récord.
              </span>
            </div>

            <form onSubmit={handleConfirmRelapse} className="space-y-3 pt-1">
              <input
                type="text"
                value={relapseNotes}
                onChange={(e) => setRelapseNotes(e.target.value)}
                placeholder="Motivo (opcional: estrés, fiesta...)"
                className="w-full h-10 px-3.5 rounded-xl bg-white/5 border border-[rgba(232,183,94,0.18)] text-[#F1EEE2] text-xs placeholder:text-[#7C9481] focus:outline-none focus:border-[#E8B75E] transition-colors"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowRelapseModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-[#A9BBA4] hover:text-[#F1EEE2] text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSubmittingRelapse}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#EFC471] to-[#E8B75E] text-[#1B1710] text-xs font-bold shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isSubmittingRelapse ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>Aportar 1 € y reiniciar</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PlantPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen w-full flex items-center justify-center p-4"
          style={{
            background: 'radial-gradient(120% 90% at 50% -10%, #223729 0%, #16241C 45%, #0F1913 100%)',
          }}
        >
          <div className="w-10 h-10 rounded-full border-2 border-[#E8B75E]/30 border-t-[#E8B75E] animate-spin" />
        </div>
      }
    >
      <PlantPageContent />
    </Suspense>
  )
}
