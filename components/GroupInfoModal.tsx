'use client'

import React, { useState, useEffect } from 'react'
import { X, UserPlus, Check, Users, Sparkles, Shield, Clock, Loader2, ArrowLeft, Search } from 'lucide-react'
import confetti from 'canvas-confetti'
import { supabase } from '@/lib/supabase/client'

export interface GroupMemberItem {
  id: string
  user_id: string
  name: string
  initials: string
  role: 'smoker' | 'friend'
  groupRole: 'admin' | 'member'
  avatar_url?: string | null
  smoke_free_since?: string | null
  isFriend: boolean
  friendshipStatus: 'accepted' | 'pending' | 'none'
  isViewer: boolean
}

export interface FriendSummary {
  id: string
  name: string
  initials: string
  role: 'smoker' | 'friend'
  status?: string
}

interface GroupInfoModalProps {
  groupId: string
  groupName: string
  groupDescription?: string
  currentUserId: string | null
  currentUserName: string
  initialOpenAddMembers?: boolean
  availableFriends?: FriendSummary[]
  onClose: () => void
  onFriendAdded?: (friendId: string) => void
  onMembersAdded?: () => void
}

export default function GroupInfoModal({
  groupId,
  groupName,
  groupDescription,
  currentUserId,
  currentUserName,
  initialOpenAddMembers = false,
  availableFriends,
  onClose,
  onFriendAdded,
  onMembersAdded,
}: GroupInfoModalProps) {
  const [members, setMembers] = useState<GroupMemberItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [pendingMap, setPendingMap] = useState<Record<string, boolean>>({})
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Modo añadir amigos al grupo
  const [isAddingMembersMode, setIsAddingMembersMode] = useState<boolean>(initialOpenAddMembers)
  const [friendsList, setFriendsList] = useState<FriendSummary[]>(availableFriends || [])
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([])
  const [isSavingMembers, setIsSavingMembers] = useState<boolean>(false)
  const [friendSearchQuery, setFriendSearchQuery] = useState<string>('')

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  // Cargar miembros del grupo
  const loadMembers = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/groups/${groupId}/members?viewerId=${currentUserId || ''}`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      })
      if (res.ok) {
        const data = await res.json()
        if (data.success && Array.isArray(data.members)) {
          setMembers(data.members)
        }
      }
    } catch (err) {
      console.warn('Error fetching group members:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    loadMembers()
  }, [groupId, currentUserId])

  // Si no se pasaron amigos disponibles, cargarlos desde friendships
  useEffect(() => {
    if (availableFriends && availableFriends.length > 0) {
      setFriendsList(availableFriends)
      return
    }

    if (!currentUserId) return

    async function fetchUserFriends() {
      try {
        const { data: friendships } = await supabase
          .from('friendships')
          .select(`
            id,
            smoker_id,
            friend_id,
            status,
            smoker:profiles!friendships_smoker_id_fkey(id, full_name, role),
            friend:profiles!friendships_friend_id_fkey(id, full_name, role)
          `)
          .or(`smoker_id.eq.${currentUserId},friend_id.eq.${currentUserId}`)
          .eq('status', 'accepted')

        if (!friendships) return

        const list: FriendSummary[] = []
        const seen = new Set<string>()

        friendships.forEach((row: any) => {
          const isMe = row.smoker_id === currentUserId
          const other = isMe ? row.friend : row.smoker
          if (!other || !other.id || other.id === currentUserId || seen.has(other.id)) return
          seen.add(other.id)

          const name = other.full_name || 'Compañero'
          const initials = name
            .split(' ')
            .filter(Boolean)
            .map((n: string) => n[0])
            .join('')
            .slice(0, 2)
            .toUpperCase() || 'AM'

          list.push({
            id: other.id,
            name,
            initials,
            role: other.role || 'smoker',
          })
        })

        setFriendsList(list)
      } catch (e) {
        console.warn('Error fetching user friends for group:', e)
      }
    }

    fetchUserFriends()
  }, [currentUserId, availableFriends])

  // Amigos que NO están aún en el grupo
  const nonMemberFriends = friendsList.filter(
    (f: FriendSummary) => !members.some((m: GroupMemberItem) => m.user_id === f.id)
  )

  const filteredNonMemberFriends = nonMemberFriends.filter((f: FriendSummary) =>
    f.name.toLowerCase().includes(friendSearchQuery.trim().toLowerCase())
  )

  const handleToggleFriend = (friendId: string) => {
    setSelectedFriendIds((prev: string[]) =>
      prev.includes(friendId) ? prev.filter((id: string) => id !== friendId) : [...prev, friendId]
    )
  }

  // Guardar nuevos miembros en el grupo
  const handleConfirmAddMembers = async () => {
    if (selectedFriendIds.length === 0 || isSavingMembers) return
    setIsSavingMembers(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ user_ids: selectedFriendIds }),
      })

      if (res.ok) {
        try {
          confetti({
            particleCount: 40,
            spread: 60,
            origin: { y: 0.6 },
            colors: ['#E8B75E', '#52B788', '#38BDF8'],
          })
        } catch {}

        showToast(
          `¡${selectedFriendIds.length === 1 ? 'Amigo añadido' : 'Amigos añadidos'} al grupo con éxito! 🎉`
        )
        setSelectedFriendIds([])
        setIsAddingMembersMode(false)
        await loadMembers()
        if (onMembersAdded) onMembersAdded()
      } else {
        const err = await res.json().catch(() => ({}))
        showToast(err?.error || 'No se pudieron añadir amigos al grupo.')
      }
    } catch (err) {
      console.error('Error adding members to group:', err)
      showToast('Error al añadir miembros.')
    } finally {
      setIsSavingMembers(false)
    }
  }

  // Manejar solicitud de amistad para miembros no amigos
  const handleAddFriend = async (member: GroupMemberItem) => {
    if (!currentUserId || member.isViewer || pendingMap[member.user_id]) return

    setPendingMap((prev: Record<string, boolean>) => ({ ...prev, [member.user_id]: true }))

    try {
      if (!member.user_id.startsWith('demo-')) {
        await supabase.from('friendships').insert({
          smoker_id: currentUserId,
          friend_id: member.user_id,
          status: 'pending',
        })
      }

      setMembers((prev: GroupMemberItem[]) =>
        prev.map((m: GroupMemberItem) =>
          m.user_id === member.user_id
            ? { ...m, friendshipStatus: 'pending', isFriend: false }
            : m
        )
      )

      try {
        confetti({
          particleCount: 35,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#E8B75E', '#52B788', '#A796D8'],
        })
      } catch {}

      showToast(`Solicitud de amistad enviada a ${member.name.split(' ')[0]}`)
      if (onFriendAdded) onFriendAdded(member.user_id)
    } catch (err: any) {
      console.error('Error sending friend request:', err)
      showToast('No se pudo enviar la solicitud.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        className="w-full sm:w-[390px] max-h-[85vh] rounded-t-[28px] sm:rounded-[28px] border border-[rgba(232,183,94,0.18)] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300"
        style={{
          background: 'radial-gradient(120% 90% at 50% -10%, #223729 0%, #16241C 45%, #0F1913 100%)',
          fontFamily: "'Work Sans', sans-serif",
          color: '#F1EEE2',
        }}
      >
        {/* TOAST DENTRO DEL MODAL */}
        {toastMessage && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-xs bg-[#16241C]/95 border border-[rgba(232,183,94,0.3)] text-[#F1EEE2] text-xs py-2.5 px-3.5 rounded-2xl shadow-xl flex items-center gap-2 backdrop-blur-md">
            <Sparkles className="w-4 h-4 text-[#E8B75E] shrink-0" />
            <span className="font-medium text-xs">{toastMessage}</span>
          </div>
        )}

        {/* CABECERA */}
        <header className="p-[18px_20px] border-b border-[rgba(232,183,94,0.12)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {isAddingMembersMode ? (
              <button
                type="button"
                onClick={() => {
                  setIsAddingMembersMode(false)
                  setSelectedFriendIds([])
                }}
                className="w-8 h-8 rounded-full bg-[rgba(255,255,255,0.06)] border border-[rgba(232,183,94,0.18)] flex items-center justify-center text-[#E8B75E] hover:scale-105 active:scale-95 transition-all cursor-pointer"
                title="Volver a información del grupo"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <div className="w-8 h-8 rounded-full bg-[rgba(232,183,94,0.12)] border border-[rgba(232,183,94,0.25)] flex items-center justify-center text-[#E8B75E]">
                <Users className="w-4 h-4 text-[#E8B75E]" />
              </div>
            )}
            <div>
              <h3 className="font-fraunces font-medium text-[16.5px] text-[#F1EEE2] leading-tight">
                {isAddingMembersMode ? 'Añadir amigos al grupo' : 'Información del grupo'}
              </h3>
              <p className="text-[11px] text-[#7C9481]">
                {isAddingMembersMode
                  ? `${selectedFriendIds.length} ${selectedFriendIds.length === 1 ? 'seleccionado' : 'seleccionados'}`
                  : `${members.length} ${members.length === 1 ? 'miembro' : 'miembros'}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[rgba(255,255,255,0.05)] border border-[rgba(232,183,94,0.12)] flex items-center justify-center text-[#A9BBA4] hover:text-[#F1EEE2] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* RESUMEN DEL GRUPO (SI NO ESTAMOS EN MODO SELECCIÓN) */}
        {!isAddingMembersMode && (
          <div className="p-[16px_20px_12px] bg-[rgba(255,255,255,0.02)] border-b border-[rgba(232,183,94,0.08)]">
            <div className="font-fraunces font-medium text-[18px] text-[#E8B75E]">
              {groupName}
            </div>
            {groupDescription && (
              <p className="text-[12px] text-[#A9BBA4] mt-1 leading-relaxed">
                {groupDescription}
              </p>
            )}
          </div>
        )}

        {/* CONTENIDO PRINCIPAL: PARTICIPANTES O MODO AÑADIR AMIGOS */}
        {isAddingMembersMode ? (
          /* ============================================================== */
          /* MODO AÑADIR AMIGOS AL GRUPO                                    */
          /* ============================================================== */
          <div className="flex-1 overflow-y-auto p-[16px_20px] space-y-3 no-scrollbar">
            {/* Buscador de amigos */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7C9481]" />
              <input
                type="text"
                value={friendSearchQuery}
                onChange={(e) => setFriendSearchQuery(e.target.value)}
                placeholder="Buscar entre tus amigos..."
                className="w-full h-10 pl-10 pr-4 rounded-xl bg-white/5 border border-[rgba(232,183,94,0.16)] text-[#F1EEE2] text-xs placeholder:text-[#7C9481] focus:outline-none focus:border-[#E8B75E] transition-colors"
              />
            </div>

            {nonMemberFriends.length === 0 ? (
              <div className="py-10 text-center space-y-2 p-5 rounded-2xl bg-white/[0.02] border border-[rgba(232,183,94,0.1)]">
                <Users className="w-8 h-8 text-[#E8B75E]/60 mx-auto" />
                <p className="font-medium text-xs text-[#F1EEE2]">
                  {friendsList.length === 0
                    ? 'Aún no tienes amigos en tu lista para añadir'
                    : 'Todos tus amigos ya forman parte de este grupo'}
                </p>
                <p className="text-[11px] text-[#7C9481]">
                  Añade nuevos amigos desde la pantalla de Inicio para poder incluirlos aquí.
                </p>
              </div>
            ) : filteredNonMemberFriends.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#7C9481]">
                No se encontraron amigos que coincidan con &quot;{friendSearchQuery}&quot;
              </div>
            ) : (
              <div className="space-y-2">
                <span className="text-[11px] text-[#A9BBA4] font-medium block px-1">
                  Toca para seleccionar:
                </span>
                {filteredNonMemberFriends.map((friend: FriendSummary) => {
                  const isSelected = selectedFriendIds.includes(friend.id)
                  return (
                    <div
                      key={friend.id}
                      onClick={() => handleToggleFriend(friend.id)}
                      className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer select-none active:scale-[0.99] ${
                        isSelected
                          ? 'border-[#E8B75E] bg-[rgba(232,183,94,0.1)] shadow-sm'
                          : 'border-[rgba(232,183,94,0.12)] bg-[rgba(255,255,255,0.025)] hover:border-[rgba(232,183,94,0.25)]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                            isSelected
                              ? 'bg-gradient-to-br from-[#EFC471] to-[#E8B75E] text-[#1B1710]'
                              : 'bg-white/10 text-[#E8B75E]'
                          }`}
                        >
                          {friend.initials}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-medium text-[13.5px] text-[#F1EEE2] truncate">
                            {friend.name}
                          </h4>
                          <span className="text-[10.5px] text-[#7C9481]">
                            {friend.role === 'smoker' ? 'Dejando de fumar' : 'Guardián'}
                          </span>
                        </div>
                      </div>

                      {/* Checkbox circular */}
                      <div
                        className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-[#E8B75E] border-[#E8B75E] text-[#1B1710]'
                            : 'border-[rgba(232,183,94,0.3)] bg-transparent'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          /* ============================================================== */
          /* MODO LISTADO DE PARTICIPANTES                                  */
          /* ============================================================== */
          <div className="flex-1 overflow-y-auto p-[16px_20px] space-y-2.5 no-scrollbar">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-fraunces italic text-[13px] text-[#A9BBA4]">
                Participantes ({members.length})
              </span>
              <button
                type="button"
                onClick={() => setIsAddingMembersMode(true)}
                className="px-2.5 py-1 rounded-full bg-[#E8B75E]/15 border border-[#E8B75E]/30 text-[#E8B75E] text-[11px] font-semibold flex items-center gap-1 hover:bg-[#E8B75E]/25 transition-all cursor-pointer active:scale-95 shadow-xs"
              >
                <UserPlus className="w-3 h-3" />
                <span>+ Añadir amigos</span>
              </button>
            </div>

            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-[#E8B75E]" />
                <span className="text-xs text-[#7C9481]">Cargando participantes...</span>
              </div>
            ) : (
              members.map((member: GroupMemberItem, idx: number) => {
                const isMe = member.isViewer || member.user_id === currentUserId
                const isAlreadyFriend = member.isFriend
                const isPending = member.friendshipStatus === 'pending' || pendingMap[member.user_id]
                const gradientBg =
                  idx % 3 === 0
                    ? 'linear-gradient(145deg, #9FC98A, #6FA65C)'
                    : idx % 3 === 1
                    ? 'linear-gradient(145deg, #C9BCEF, #A796D8)'
                    : 'linear-gradient(145deg, #F0D08C, #E8B75E)'

                return (
                  <div
                    key={member.id || member.user_id}
                    className="rounded-[18px] border border-[rgba(232,183,94,0.1)] p-[11px_14px] flex items-center justify-between gap-3 bg-[rgba(255,255,255,0.025)] hover:border-[rgba(232,183,94,0.22)] transition-all"
                  >
                    {/* Avatar & Nombre */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-[38px] h-[38px] rounded-full overflow-hidden flex items-center justify-center text-[12.5px] font-semibold text-[#1B1710] shrink-0 border border-white/10 shadow-xs"
                        style={{ background: member.avatar_url ? '#16241C' : gradientBg }}
                      >
                        {member.avatar_url ? (
                          <img
                            src={member.avatar_url}
                            alt={member.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        ) : (
                          member.initials
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13.5px] font-medium text-[#F1EEE2] truncate">
                            {member.name}
                          </span>
                          {isMe && (
                            <span className="text-[10px] text-[#E8B75E] font-medium px-1.5 py-0.5 rounded bg-[rgba(232,183,94,0.12)]">
                              Tú
                            </span>
                          )}
                          {member.groupRole === 'admin' && (
                            <span className="text-[9px] text-[#A796D8] border border-[rgba(167,150,216,0.3)] bg-[rgba(167,150,216,0.1)] px-1 rounded">
                              Admin
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-[#7C9481] mt-0.5">
                          {member.role === 'smoker' ? 'Dejando de fumar' : 'Guardián de apoyo'}
                        </div>
                      </div>
                    </div>

                    {/* ESTADO / ACCIÓN DE AMISTAD */}
                    <div className="shrink-0">
                      {isMe ? null : isAlreadyFriend ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#52B788] bg-[rgba(82,183,136,0.1)] border border-[rgba(82,183,136,0.25)] px-2.5 py-1 rounded-full">
                          <Check className="w-3 h-3" />
                          <span>Amigo</span>
                        </span>
                      ) : isPending ? (
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-[#E8B75E] bg-[rgba(232,183,94,0.1)] border border-[rgba(232,183,94,0.25)] px-2.5 py-1 rounded-full">
                          <Clock className="w-3 h-3" />
                          <span>Pendiente</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAddFriend(member)}
                          className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[#16241C] bg-gradient-to-r from-[#EFC471] to-[#E8B75E] px-3 py-1.5 rounded-full hover:scale-105 active:scale-95 transition-all shadow-sm cursor-pointer"
                          title="Enviar solicitud de amistad"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Añadir</span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* PIE DEL MODAL */}
        <footer className="p-[14px_20px] border-t border-[rgba(232,183,94,0.1)] bg-[rgba(0,0,0,0.2)] flex items-center justify-between gap-3">
          {isAddingMembersMode ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setIsAddingMembersMode(false)
                  setSelectedFriendIds([])
                }}
                className="text-xs font-medium text-[#A9BBA4] hover:text-[#F1EEE2] py-2 px-3.5 rounded-xl bg-white/5 border border-white/10 transition-colors cursor-pointer"
              >
                Volver
              </button>

              <button
                type="button"
                onClick={handleConfirmAddMembers}
                disabled={selectedFriendIds.length === 0 || isSavingMembers}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#EFC471] to-[#E8B75E] text-[#1B1710] font-bold text-xs flex items-center justify-center gap-1.5 shadow-md hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 transition-all cursor-pointer"
              >
                {isSavingMembers ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>
                      {selectedFriendIds.length === 0
                        ? 'Selecciona amigos'
                        : `Añadir (${selectedFriendIds.length}) al grupo`}
                    </span>
                  </>
                )}
              </button>
            </>
          ) : (
            <div className="w-full flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsAddingMembersMode(true)}
                className="text-xs font-semibold text-[#E8B75E] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Invitar más amigos</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="text-[13px] font-semibold text-[#E8B75E] hover:text-[#F1EEE2] transition-colors py-1.5 px-4 rounded-xl bg-[rgba(232,183,94,0.08)] border border-[rgba(232,183,94,0.2)] cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          )}
        </footer>
      </div>
    </div>
  )
}
