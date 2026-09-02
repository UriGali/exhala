'use client'

import React, { useState } from 'react'
import { X, Users, Check, Plus, Loader2 } from 'lucide-react'
import confetti from 'canvas-confetti'

interface FriendSelectable {
  id: string
  name: string
  initials: string
  role: 'smoker' | 'friend'
}

interface CreateGroupModalProps {
  currentUserId: string | null
  friends: FriendSelectable[]
  onClose: () => void
  onGroupCreated: (newGroup: any) => void
}

export default function CreateGroupModal({
  currentUserId,
  friends,
  onClose,
  onGroupCreated,
}: CreateGroupModalProps) {
  const [name, setName] = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const toggleMember = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !currentUserId) return

    setIsSubmitting(true)
    setErrorMsg(null)

    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          created_by: currentUserId,
          member_ids: selectedIds,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'No se pudo crear el grupo.')
      }

      try {
        confetti({
          particleCount: 40,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#E8B75E', '#52B788', '#38BDF8'],
        })
      } catch {}

      const created = data.group || {
        id: 'group-' + Date.now(),
        name: name.trim(),
        description: description.trim(),
        member_count: 1 + selectedIds.length,
      }

      onGroupCreated(created)
      onClose()
    } catch (err: any) {
      console.error('Error creating group:', err)
      setErrorMsg(err.message || 'Error al crear grupo.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200 select-none">
      <div
        className="w-full sm:w-[390px] rounded-t-[28px] sm:rounded-[28px] border border-[rgba(232,183,94,0.18)] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300"
        style={{
          background: 'radial-gradient(120% 90% at 50% -10%, #223729 0%, #16241C 45%, #0F1913 100%)',
          fontFamily: "'Work Sans', sans-serif",
          color: '#F1EEE2',
        }}
      >
        {/* CABECERA */}
        <header className="p-[18px_20px] border-b border-[rgba(232,183,94,0.12)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[rgba(232,183,94,0.12)] border border-[rgba(232,183,94,0.25)] flex items-center justify-center text-[15px] text-[#E8B75E]">
              ✨
            </div>
            <div>
              <h3 className="font-fraunces font-medium text-[16.5px] text-[#F1EEE2] leading-tight">
                Crear nuevo grupo
              </h3>
              <p className="text-[11px] text-[#7C9481]">
                Reúne a tus compañeros para apoyarse juntos
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

        {/* FORMULARIO */}
        <form onSubmit={handleCreate} className="p-[20px] space-y-4">
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-200">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-[12px] font-medium text-[#A9BBA4] mb-1.5">
              Nombre del grupo *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Grupo de amigos"
              required
              maxLength={40}
              className="w-full h-11 px-3.5 rounded-xl bg-[rgba(255,255,255,0.04)] border border-[rgba(232,183,94,0.16)] text-[#F1EEE2] text-[13px] placeholder:text-[#7C9481] focus:outline-none focus:border-[#E8B75E] transition-colors"
            />
          </div>

          <div>
            <label className="block text-[12px] font-medium text-[#A9BBA4] mb-1.5">
              Propósito o descripción (opcional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej. Apoyo mutuo diario y celebración de victorias"
              maxLength={80}
              className="w-full h-11 px-3.5 rounded-xl bg-[rgba(255,255,255,0.04)] border border-[rgba(232,183,94,0.16)] text-[#F1EEE2] text-[13px] placeholder:text-[#7C9481] focus:outline-none focus:border-[#E8B75E] transition-colors"
            />
          </div>

          {/* SELECCIONAR AMIGOS */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[12px] font-medium text-[#A9BBA4]">
                Añadir amigos iniciales ({selectedIds.length})
              </label>
              <span className="text-[10.5px] text-[#7C9481]">
                Podrás añadir más en cualquier momento
              </span>
            </div>

            <div className="max-h-[180px] overflow-y-auto space-y-1.5 no-scrollbar rounded-xl border border-[rgba(232,183,94,0.08)] p-2 bg-[rgba(0,0,0,0.2)]">
              {friends.length === 0 ? (
                <p className="text-center text-xs text-[#7C9481] py-4">
                  No tienes amigos conectados aún. Puedes crear el grupo e invitar luego.
                </p>
              ) : (
                friends.map((fr) => {
                  const isSelected = selectedIds.includes(fr.id)
                  return (
                    <div
                      key={fr.id}
                      onClick={() => toggleMember(fr.id)}
                      className={`p-2 rounded-xl flex items-center justify-between cursor-pointer transition-all border ${
                        isSelected
                          ? 'bg-[rgba(232,183,94,0.12)] border-[rgba(232,183,94,0.3)]'
                          : 'bg-[rgba(255,255,255,0.02)] border-transparent hover:border-[rgba(232,183,94,0.15)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-[#E8B75E]/20 text-[#E8B75E] text-[11px] font-bold flex items-center justify-center shrink-0">
                          {fr.initials}
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs text-[#F1EEE2] font-medium block truncate">
                            {fr.name}
                          </span>
                          <span className="text-[10px] text-[#7C9481]">
                            {fr.role === 'smoker' ? 'Fumador en racha' : 'Guardián'}
                          </span>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-[#E8B75E] border-[#E8B75E] text-[#1B1710]'
                            : 'border-[rgba(232,183,94,0.3)]'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={!name.trim() || isSubmitting}
            className="w-full h-11 rounded-full bg-gradient-to-r from-[#EFC471] to-[#E8B75E] text-[#1B1710] font-semibold text-xs flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-40 disabled:scale-100 shadow-md cursor-pointer mt-2"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Crear Grupo</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
