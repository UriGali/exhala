'use client'

import React, { useState, useRef, useEffect } from 'react'
import { X, Camera, Image as ImageIcon, Loader2, Sparkles, RefreshCw } from 'lucide-react'
import confetti from 'canvas-confetti'
import { supabase } from '@/lib/supabase/client'

interface CreateStoryModalProps {
  currentUserId: string | null
  currentUserName: string
  initialImage?: string | null
  onClose: () => void
  onStoryCreated: (story: any) => void
}

export default function CreateStoryModal({
  currentUserId,
  currentUserName,
  initialImage = null,
  onClose,
  onStoryCreated,
}: CreateStoryModalProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(initialImage)
  const [caption, setCaption] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  // Si no hay imagen inicial al montar, intentar abrir la cámara directamente
  useEffect(() => {
    if (!initialImage && !selectedImage) {
      // Pequeño timeout para asegurar que el DOM esté listo
      const timer = setTimeout(() => {
        cameraInputRef.current?.click()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [initialImage])

  // Procesar archivo y redimensionar en canvas para optimizar peso
  const processImageFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_DIM = 1200
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > MAX_DIM) {
            height *= MAX_DIM / width
            width = MAX_DIM
          }
        } else {
          if (height > MAX_DIM) {
            width *= MAX_DIM / height
            height = MAX_DIM
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
          setSelectedImage(dataUrl)
        }
      }
      img.src = event.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      processImageFile(file)
    }
  }

  // Publicar historia
  const handlePublish = async () => {
    if (!selectedImage || !currentUserId || isSubmitting) return

    setIsSubmitting(true)
    setErrorMsg(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const res = await fetch('/api/stories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
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

      onStoryCreated(data.story)
      onClose()
    } catch (err: any) {
      console.error('Error creating story:', err)
      setErrorMsg(err.message || 'Error al publicar la historia.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-0 sm:p-4 select-none animate-in fade-in duration-200">
      {/* INPUTS NATIVOS DE CÁMARA Y GALERÍA */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* CONTENEDOR ESTILO VISOR / CÁMARA DE INSTAGRAM */}
      <div
        className="w-full sm:w-[390px] h-full sm:h-[780px] sm:rounded-[34px] overflow-hidden relative flex flex-col bg-[#0F1913] border sm:border-[rgba(232,183,94,0.18)] shadow-2xl"
        style={{ fontFamily: "'Work Sans', sans-serif" }}
      >
        {/* ============================================================== */}
        {/* CONTENIDO PRINCIPAL: FOTO O DISPARADOR                         */}
        {/* ============================================================== */}
        <div className="relative flex-1 w-full h-full overflow-hidden bg-black flex items-center justify-center">
          {selectedImage ? (
            <>
              {/* IMAGEN SELECCIONADA */}
              <img
                src={selectedImage}
                alt="Captura de historia"
                className="w-full h-full object-cover"
              />

              {/* Degradados sutiles para legibilidad */}
              <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" />
              <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none" />

              {/* CAMPO DE TEXTO DIRECTO SOBRE LA FOTO (ESTILO INSTAGRAM) */}
              <div className="absolute bottom-24 inset-x-4 z-20 flex justify-center">
                <div className="w-full max-w-[340px] relative">
                  <input
                    type="text"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Escribe un mensaje..."
                    maxLength={90}
                    className="w-full h-11 px-4 text-center rounded-full bg-black/55 backdrop-blur-md border border-white/20 text-[#F1EEE2] text-[13.5px] placeholder:text-[#A9BBA4] focus:outline-none focus:border-[#E8B75E] focus:bg-black/70 shadow-lg transition-all"
                  />
                </div>
              </div>
            </>
          ) : (
            /* SI NO HAY FOTO AÚN: PANTALLA TIPO DISPARADOR DE CÁMARA */
            <div className="flex flex-col items-center justify-center gap-6 p-6 text-center">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="w-24 h-24 rounded-full border-4 border-white/40 p-1 flex items-center justify-center group hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-2xl"
                title="Hacer foto"
              >
                <div className="w-full h-full rounded-full bg-gradient-to-tr from-[#EFC471] to-[#E8B75E] flex items-center justify-center shadow-inner">
                  <Camera className="w-9 h-9 text-[#1B1710]" />
                </div>
              </button>

              <span className="text-xs text-[#A9BBA4] font-medium tracking-wide">
                Toca para abrir la cámara
              </span>
            </div>
          )}

          {/* CABECERA SUPERIOR MINIMALISTA */}
          <div className="absolute top-0 inset-x-0 p-4 z-30 flex items-center justify-between pointer-events-auto">
            {/* Botón Cerrar */}
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/15 flex items-center justify-center text-white hover:bg-black/60 active:scale-95 transition-all cursor-pointer"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Si ya hay foto, botón para rehacer foto con cámara */}
            {selectedImage && (
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/15 flex items-center justify-center text-[#E8B75E] hover:bg-black/60 active:scale-95 transition-all cursor-pointer"
                title="Hacer otra foto"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* MENSAJE DE ERROR SI OCURRE */}
          {errorMsg && (
            <div className="absolute top-16 inset-x-4 z-40 p-3 rounded-2xl bg-red-500/90 backdrop-blur-md text-white text-xs text-center font-medium shadow-xl">
              {errorMsg}
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* BARRA INFERIOR: GALERÍA (SOLO LOGO) Y BOTÓN PUBLICAR           */}
        {/* ============================================================== */}
        <footer className="relative z-30 px-5 py-4 bg-black/80 backdrop-blur-md border-t border-white/10 flex items-center justify-between">
          {/* ABAJO A LA IZQUIERDA: BOTÓN DE GALERÍA (SOLO EL LOGO) */}
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 border border-white/15 flex items-center justify-center text-[#E8B75E] transition-all cursor-pointer shadow-md"
            title="Elegir de la galería"
            aria-label="Galería"
          >
            <ImageIcon className="w-6 h-6 stroke-[2]" />
          </button>

          {/* ABAJO A LA DERECHA: BOTÓN PUBLICAR */}
          <button
            type="button"
            onClick={handlePublish}
            disabled={!selectedImage || isSubmitting}
            className={`h-12 px-7 rounded-full font-semibold text-[14px] flex items-center justify-center gap-2 transition-all shadow-lg ${
              selectedImage
                ? 'bg-gradient-to-r from-[#EFC471] to-[#E8B75E] text-[#1B1710] hover:scale-105 active:scale-95 cursor-pointer shadow-[#E8B75E]/20'
                : 'bg-white/10 text-white/35 border border-white/10 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <span>Publicar</span>
            )}
          </button>
        </footer>
      </div>
    </div>
  )
}
