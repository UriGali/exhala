'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Sprout, Loader2 } from 'lucide-react'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    async function routeUser(userId: string, metaRole?: string) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, full_name')
          .eq('id', userId)
          .maybeSingle()

        if (!profile?.full_name) {
          router.push('/onboarding')
          return
        }

        const userRole = profile.role || metaRole || 'smoker'
        const destination = userRole === 'friend' ? '/dashboard/friends' : '/dashboard/smoker'
        router.push(destination)
      } catch (err) {
        console.error('Error routing user from callback:', err)
        router.push('/onboarding')
      }
    }

    async function handleCallback() {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()

        if (session?.user) {
          await routeUser(session.user.id, session.user.user_metadata?.role)
          return
        }

        // Si la sesión aún se está resolviendo en segundo plano
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event, newSession) => {
          if (newSession?.user) {
            subscription.unsubscribe()
            await routeUser(newSession.user.id, newSession.user.user_metadata?.role)
          }
        })

        // Timeout de seguridad por si falla la autenticación
        const timeout = setTimeout(() => {
          subscription.unsubscribe()
          router.push('/')
        }, 5000)

        return () => {
          clearTimeout(timeout)
          subscription.unsubscribe()
        }
      } catch (e) {
        console.error('Error handling auth callback:', e)
        router.push('/')
      }
    }

    handleCallback()
  }, [router])

  return (
    <div className="min-h-[100dvh] w-full bg-[#F8FAF9] flex flex-col items-center justify-center p-6 space-y-4 max-w-md mx-auto select-none">
      <div className="w-14 h-14 rounded-3xl bg-white border border-neutral-200/80 shadow-sm flex items-center justify-center animate-pulse">
        <Sprout className="w-7 h-7 text-emerald-600" />
      </div>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-neutral-500">
        <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
        <span>Iniciando sesión con Google...</span>
      </div>
    </div>
  )
}
