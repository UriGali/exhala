'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { UserRole } from '@/types/database.types'
import { Eye, EyeOff, Lock, Mail, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react'

import Image from 'next/image'

export default function OnboardingLoginPage() {
  const router = useRouter()
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null)
  const [isExistingUser, setIsExistingUser] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 1. Manejo de Login con Google OAuth
  const handleGoogleLogin = async () => {
    setLoading(true)
    setMessage(null)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
            role: selectedRole || 'smoker',
          },
        },
      })
      if (error) throw error
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || 'Error al conectar con Google. Por favor, intenta de nuevo.',
      })
      setLoading(false)
    }
  }

  // 2. Manejo de Autenticación con Email + Contraseña (Registro e Inicio de Sesión)
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    if (!email || !email.includes('@')) {
      setMessage({ type: 'error', text: 'Por favor, introduce un correo electrónico válido.' })
      return
    }

    if (!password || password.length < 6) {
      setMessage({ type: 'error', text: 'La contraseña debe tener al menos 6 caracteres.' })
      return
    }

    setLoading(true)

    try {
      if (isExistingUser) {
        // --- MODO INICIO DE SESIÓN ---
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            throw new Error('Correo o contraseña incorrectos. Comprueba tus credenciales.')
          }
          if (error.message.includes('Email not confirmed')) {
            throw new Error('Por favor, confirma tu correo electrónico antes de iniciar sesión.')
          }
          throw error
        }

        if (data.user) {
          // Consultar el rol del usuario en la base de datos
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', data.user.id)
            .maybeSingle<{ role: UserRole }>()

          const userRole: UserRole =
            profile?.role ||
            (data.user.user_metadata?.role as UserRole) ||
            'smoker'

          const destination = userRole === 'friend' ? '/dashboard/friends' : '/dashboard/smoker'
          router.push(destination)
        }
      } else {
        // --- MODO REGISTRO (NUEVO USUARIO) ---
        const currentRole = selectedRole || 'smoker'

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              role: currentRole,
            },
          },
        })

        if (error) {
          if (error.message.includes('User already registered') || error.message.includes('already registered')) {
            throw new Error('Ya existe una cuenta con este correo. Por favor, inicia sesión.')
          }
          if (error.message.includes('Password should be at least')) {
            throw new Error('La contraseña debe tener al menos 6 caracteres.')
          }
          throw error
        }

        if (data.session && data.user) {
          // Si el registro devuelve sesión activa directamente
          const destination = currentRole === 'friend' ? '/dashboard/friends' : '/onboarding'
          router.push(destination)
        } else if (data.user) {
          // Si Supabase requiere confirmación de email
          setMessage({
            type: 'success',
            text: '¡Cuenta creada con éxito! Revisa tu correo electrónico para confirmar tu cuenta y continuar.',
          })
          setLoading(false)
        }
      }
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || 'Ha ocurrido un error inesperado al procesar la solicitud.',
      })
      setLoading(false)
    }
  }

  const resetFlow = () => {
    setSelectedRole(null)
    setIsExistingUser(false)
    setMessage(null)
    setEmail('')
    setPassword('')
  }

  const switchToLogin = () => {
    setIsExistingUser(true)
    setSelectedRole(null)
    setMessage(null)
  }

  const switchToSignup = () => {
    setIsExistingUser(false)
    setSelectedRole(null)
    setMessage(null)
  }

  return (
    <main className="min-h-[100dvh] w-full bg-white text-neutral-900 flex flex-col justify-between p-6 sm:p-8 max-w-md mx-auto select-none antialiased">
      {/* HEADER / BRANDING OFICIAL */}
      <header className="pt-2 sm:pt-4 flex flex-col items-center text-center">
        <div className="relative w-48 h-16 sm:w-56 sm:h-20 mb-2">
          <Image
            src="/logo-wordmark.png"
            alt="Exhala — Respira y Florece"
            fill
            sizes="(max-width: 640px) 192px, 224px"
            className="object-contain"
          />
        </div>

        <p className="mt-1 text-xs sm:text-sm text-neutral-500 font-normal leading-relaxed max-w-xs">
          {isExistingUser
            ? 'Bienvenido de vuelta a tu espacio libre de humo.'
            : selectedRole === 'smoker'
            ? 'Tu camino hacia una vida sin tabaco empieza hoy.'
            : selectedRole === 'friend'
            ? 'Acompaña y motiva a quien más te importa.'
            : 'Un nuevo comienzo, respiración a respiración.'}
        </p>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <div className="my-auto py-6 w-full">
        {/* PASO 1: Selección de Rol para Nuevos Usuarios */}
        {!selectedRole && !isExistingUser ? (
          <div className="space-y-3.5">
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest text-center mb-4">
              Elige tu objetivo
            </p>

            {/* Botón: Quiero dejar de fumar */}
            <button
              onClick={() => setSelectedRole('smoker')}
              className="w-full h-14 bg-neutral-950 text-white font-medium text-base rounded-2xl flex items-center justify-between px-6 transition-transform active:scale-[0.98] active:bg-neutral-800"
            >
              <span>Quiero dejar de fumar</span>
              <ArrowRight className="w-5 h-5 text-neutral-400" />
            </button>

            {/* Botón: Vengo a apoyar a un amigo */}
            <button
              onClick={() => setSelectedRole('friend')}
              className="w-full h-14 bg-neutral-100 text-neutral-900 font-medium text-base rounded-2xl flex items-center justify-between px-6 transition-transform active:scale-[0.98] active:bg-neutral-200"
            >
              <span>Vengo a apoyar a un amigo</span>
              <ArrowRight className="w-5 h-5 text-neutral-500" />
            </button>
          </div>
        ) : (
          /* PASO 2: Formulario de Autenticación (Email + Contraseña) */
          <div className="space-y-4">
            {/* Tag del camino seleccionado o modo login */}
            <div className="flex items-center justify-between px-1 mb-1">
              <span className="text-xs font-medium text-neutral-500">
                {isExistingUser
                  ? 'Iniciando sesión'
                  : `Modo: ${selectedRole === 'smoker' ? 'Fumador' : 'Amigo de apoyo'}`}
              </span>
              <button
                type="button"
                onClick={resetFlow}
                className="text-xs font-medium text-neutral-600 underline hover:text-neutral-900"
              >
                Cambiar
              </button>
            </div>

            {/* Botón Google OAuth */}
            <button
              type="button"
              disabled={loading}
              onClick={handleGoogleLogin}
              className="w-full h-13 bg-white border border-neutral-200 hover:border-neutral-300 text-neutral-800 font-medium text-sm rounded-2xl flex items-center justify-center gap-3 transition-transform active:scale-[0.98] active:bg-neutral-50 disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>Continuar con Google</span>
            </button>

            {/* Divisor fino minimalista */}
            <div className="relative py-1 flex items-center justify-center">
              <div className="w-full border-t border-neutral-100"></div>
              <span className="absolute bg-white px-3 text-[11px] text-neutral-400 font-normal">
                o con correo y contraseña
              </span>
            </div>

            {/* Formulario Email + Password */}
            <form onSubmit={handleAuthSubmit} className="space-y-3">
              {/* Campo Email */}
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">
                  Correo electrónico
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nombre@ejemplo.com"
                    autoComplete="email"
                    required
                    disabled={loading}
                    className="w-full h-13 pl-11 pr-4 bg-white text-neutral-900 placeholder:text-neutral-400 border border-neutral-200 rounded-2xl text-sm focus:outline-none focus:border-neutral-900 transition-colors disabled:opacity-50"
                  />
                  <Mail className="w-4 h-4 text-neutral-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Campo Contraseña */}
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isExistingUser ? 'Tu contraseña' : 'Mínimo 6 caracteres'}
                    autoComplete={isExistingUser ? 'current-password' : 'new-password'}
                    required
                    minLength={6}
                    disabled={loading}
                    className="w-full h-13 pl-11 pr-11 bg-white text-neutral-900 placeholder:text-neutral-400 border border-neutral-200 rounded-2xl text-sm focus:outline-none focus:border-neutral-900 transition-colors disabled:opacity-50"
                  />
                  <Lock className="w-4 h-4 text-neutral-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-neutral-700 absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Botón de Enviar */}
              <button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full h-13 bg-neutral-950 text-white font-medium text-sm rounded-2xl flex items-center justify-center gap-2 transition-transform active:scale-[0.98] active:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed mt-2"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <span>{isExistingUser ? 'Iniciar sesión' : 'Crear cuenta y comenzar'}</span>
                )}
              </button>
            </form>

            {/* Mensajes de Feedback */}
            {message && (
              <div
                className={`p-3.5 rounded-2xl text-xs leading-relaxed border flex items-start gap-2.5 animate-in fade-in duration-200 ${
                  message.type === 'success'
                    ? 'bg-emerald-50/80 text-emerald-900 border-emerald-200'
                    : 'bg-red-50/80 text-red-800 border-red-200'
                }`}
              >
                {message.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <span>{message.text}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* FOOTER: Alternar entre Login / Registro y Legal */}
      <footer className="pb-3 pt-2 text-center flex flex-col items-center gap-3">
        {!isExistingUser ? (
          <button
            type="button"
            onClick={switchToLogin}
            className="text-xs font-medium text-neutral-700 hover:text-neutral-950 transition-colors py-1.5"
          >
            ¿Ya tienes una cuenta?{' '}
            <span className="text-neutral-950 font-semibold underline underline-offset-4">
              Inicia sesión
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={switchToSignup}
            className="text-xs font-medium text-neutral-700 hover:text-neutral-950 transition-colors py-1.5"
          >
            ¿No tienes cuenta todavía?{' '}
            <span className="text-neutral-950 font-semibold underline underline-offset-4">
              Regístrate aquí
            </span>
          </button>
        )}

        <p className="text-[11px] text-neutral-400 max-w-xs leading-relaxed">
          Al continuar, aceptas nuestros términos de servicio y política de privacidad.
        </p>
      </footer>
    </main>
  )
}
