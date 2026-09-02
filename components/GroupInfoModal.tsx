'use client'

import React, { useState, useEffect } from 'react'
import { X, UserPlus, Check, Users, Sparkles, Shield, Clock, Loader2 } from 'lucide-react'
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

interface GroupInfoModalProps {
  groupId: string
  groupName: string
  groupDescription?: string
  currentUserId: string | null
  currentUserName: string
  onClose: () => void
  onFriendAdded?: (friendId: string) => void
}

export default function GroupInfoModal({
  groupId,
  groupName,
  groupDescription,
  currentUserId,
  currentUserName,
  onClose,
  onFriendAdded,
}: GroupInfoModalProps) {
  const [members, setMembers] = useState<GroupMemberItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [pendingMap, setPendingMap] = useState<Record<string, boolean>>({})
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  // Cargar miembros del grupo
  useEffect(() => {
    async function loadMembers() {
      setLoading(true)
      try {
        const res = await fetch(`/api/groups/${groupId}/members?viewerId=${currentUserId || ''}`)
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

    loadMembers()
  }, [groupId, currentUserId])

  // Manejar solicitud de amistad para miembros no amigos
  const handleAddFriend = async (member: GroupMemberItem) => {
    if (!currentUserId || member.isViewer || pendingMap[member.user_id]) return

    setPendingMap((prev) => ({ ...prev, [member.user_id]: true }))

    try {
      // Registrar solicitud de amistad en Supabase
      if (!member.user_id.startsWith('demo-')) {
        await supabase.from('friendships').insert({
          smoker_id: currentUserId,
          friend_id: member.user_id,
          status: 'pending',
        })
      }

      setMembers((prev) =>
        prev.map((m) =>
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

      showToast(`✨ Solicitud de amistad enviada a ${member.name.split(' ')[0]}`)
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
            <span className="text-[#E8B75E]">✨</span>
            <span className="font-medium text-xs">{toastMessage}</span>
          </div>
        )}

        {/* CABECERA */}
        <header className="p-[18px_20px] border-b border-[rgba(232,183,94,0.12)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[rgba(232,183,94,0.12)] border border-[rgba(232,183,94,0.25)] flex items-center justify-center text-[15px] text-[#E8B75E]">
              👥
            </div>
            <div>
              <h3 className="font-fraunces font-medium text-[16.5px] text-[#F1EEE2] leading-tight">
                Información del grupo
              </h3>
              <p className="text-[11px] text-[#7C9481]">
                {members.length} {members.length === 1 ? 'miembro' : 'miembros'}
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

        {/* RESUMEN DEL GRUPO */}
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

        {/* LISTADO DE INTEGRANTES */}
        <div className="flex-1 overflow-y-auto p-[16px_20px] space-y-2.5 no-scrollbar">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-fraunces italic text-[13px] text-[#A9BBA4]">
              Participantes del grupo
            </span>
            <span className="text-[10.5px] text-[#7C9481]">
              Puedes conectar con nuevos compañeros
            </span>
          </div>

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-[#E8B75E]" />
              <span className="text-xs text-[#7C9481]">Cargando participantes...</span>
            </div>
          ) : (
            members.map((member, idx) => {
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
                      className="w-[38px] h-[38px] rounded-full flex items-center justify-center text-[12.5px] font-semibold text-[#1B1710] shrink-0"
                      style={{ background: gradientBg }}
                    >
                      {member.initials}
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
                        {member.role === 'smoker' ? 'Dejando de fumar 🌿' : 'Guardián de apoyo 🛡️'}
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
                      /* BOTÓN AÑADIR A AMIGOS PARA MIEMBROS NO AMIGOS */
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

        {/* PIE DEL MODAL */}
        <footer className="p-[14px_20px] border-t border-[rgba(232,183,94,0.1)] bg-[rgba(0,0,0,0.2)] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="text-[13px] font-semibold text-[#E8B75E] hover:text-[#F1EEE2] transition-colors py-1.5 px-4 rounded-xl bg-[rgba(232,183,94,0.08)] border border-[rgba(232,183,94,0.2)] cursor-pointer"
          >
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  )
}
