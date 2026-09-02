'use client'

import React, { useState, useRef } from 'react'
import { X, Camera, Image as ImageIcon, Sparkles, Loader2, Clock, Check } from 'lucide-react'
import confetti from 'canvas-confetti'

interface CreateStoryModalProps {
  currentUserId: string | null
  currentUserName: string
  onClose: () => void
  onStoryCreated: (story: any) => void
}

export default function CreateStoryModal({
  currentUserId,
  currentUserName,
  onClose,
  onStoryCreated,
}: CreateStoryModalProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [caption, setCaption] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  // Procesar archivo y comprimir en canvas
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        // Redimensionar para optimizar peso (máx 1080px de alto)
        const canvas = document.createElement('canvas')
        const MAX_HEIGHT = 1080
        const MAX_WIDTH = 1080
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width
            width = MAX_WIDTH
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height
            height = MAX_HEIGHT
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
          setSelectedImage(dataUrl)
        }
      }
      img.src = event.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  // Publicar historia
  const handlePublish = async () => {
    if (!selectedImage || !currentUserId || isSubmitting) return

    setIsSubmitting(true)
    setErrorMsg(null)

    try {
      const res = await fetch('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUserId,
          media_url: selectedImage,
          caption: caption.trim(),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo publicar la historia.')
      }

      try {
        confetti({
          particleCount: 50,
          spread: 70,
          origin: { y: 0.65 },
          colors: ['#E8B75E', '#52B788', '#38BDF8'],
        })
      } catch {}

      const created = data.story || {
        id: 'story-' + Date.now(),
        user_id: currentUserId,
        media_url: selectedImage,
        caption: caption.trim(),
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      }

      onStoryCreated(created)
      onClose()
    } catch (err: any) {
      console.error('Error creating story:', err)
      setErrorMsg(err.message || 'Error al publicar historia.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200 select-none">
      <div
        className="w-full sm:w-[390px] max-h-[90vh] rounded-t-[32px] sm:rounded-[32px] border border-[rgba(232,183,94,0.18)] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300"
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
              📸
            </div>
            <div>
              <h3 className="font-fraunces font-medium text-[16.5px] text-[#F1EEE2] leading-tight">
                Nueva Historia
              </h3>
              <p className="text-[11px] text-[#7C9481] flex items-center gap-1">
                <Clock className="w-3 h-3 text-[#E8B75E]" />
                <span>Visible durante 24 horas</span>
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

        {/* CONTENIDO */}
        <div className="p-[20px] space-y-4 overflow-y-auto no-scrollbar">
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-200">
              {errorMsg}
            </div>
          )}

          {/* INPUTS OCULTOS DE CÁMARA Y ARCHIVOS */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* ZONA DE PREVIEW O SELECCIÓN DE FOTO */}
          {selectedImage ? (
            <div className="relative rounded-[22px] overflow-hidden border border-[rgba(232,183,94,0.2)] bg-black/40 aspect-[4/5] flex items-center justify-center shadow-inner group">
              <img
                src={selectedImage}
                alt="Historia seleccionada"
                className="w-full h-full object-cover"
              />

              {/* Botón para cambiar foto */}
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors backdrop-blur-sm cursor-pointer"
                title="Elegir otra foto"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 text-[10.5px] text-[#E8B75E] flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span>Vista previa</span>
              </div>
            </div>
          ) : (
            <div className="rounded-[24px] border-2 border-dashed border-[rgba(232,183,94,0.22)] p-8 flex flex-col items-center justify-center text-center gap-4 bg-[rgba(255,255,255,0.015)]">
              <div className="w-16 h-16 rounded-full bg-[rgba(232,183,94,0.1)] border border-[rgba(232,183,94,0.25)] flex items-center justify-center text-2xl text-[#E8B75E]">
                🌿
              </div>

              <div>
                <h4 className="font-fraunces text-[16px] text-[#F1EEE2]">
                  Comparte tu momento sin humo
                </h4>
                <p className="text-xs text-[#7C9481] max-w-xs mt-1 leading-relaxed">
                  Un paseo, un té, tu racha limpia o una foto de tu entorno. Inspira a tus amigos hoy.
                </p>
              </div>

              {/* BOTONES DE CAPTURA */}
              <div className="flex gap-2.5 w-full max-w-xs pt-1">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#EFC471] to-[#E8B75E] text-[#1B1710] font-semibold text-xs flex items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Hacer Foto</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-[rgba(255,255,255,0.05)] border border-[rgba(232,183,94,0.2)] text-[#F1EEE2] font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-[rgba(255,255,255,0.1)] transition-colors cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>Galería</span>
                </button>
              </div>
            </div>
          )}

          {/* PIE DE FOTO */}
          {selectedImage && (
            <div>
              <label className="block text-[12px] font-medium text-[#A9BBA4] mb-1.5">
                Pie de foto o mensaje (opcional)
              </label>
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Ej. Día 4 sin fumar: Paseo respirando aire limpio 🌲"
                maxLength={90}
                className="w-full h-11 px-3.5 rounded-xl bg-[rgba(255,255,255,0.04)] border border-[rgba(232,183,94,0.16)] text-[#F1EEE2] text-[13px] placeholder:text-[#7C9481] focus:outline-none focus:border-[#E8B75E] transition-colors"
              />
            </div>
          )}
        </div>

        {/* PIE DE ACCIÓN */}
        {selectedImage && (
          <footer className="p-[14px_20px] border-t border-[rgba(232,183,94,0.1)] bg-[rgba(0,0,0,0.25)] flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-[rgba(255,255,255,0.04)] border border-[rgba(232,183,94,0.15)] text-xs text-[#A9BBA4] hover:text-[#F1EEE2] transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handlePublish}
              disabled={isSubmitting}
              className="flex-[2] py-2.5 rounded-xl bg-gradient-to-r from-[#EFC471] to-[#E8B75E] text-[#1B1710] font-semibold text-xs flex items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 shadow-md cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Publicar (24 horas)</span>
                </>
              )}
            </button>
          </footer>
        )}
      </div>
    </div>
  )
}
