import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { Database, UserRole } from '@/types/database.types'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  if (!code) {
    return NextResponse.redirect(`${origin}/?error=auth_failed`)
  }

  let response = NextResponse.next()

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  try {
    const { data: { session }, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError || !session?.user) {
      console.error('Error exchanging code for session:', exchangeError)
      return NextResponse.redirect(`${origin}/?error=auth_failed`)
    }

    // Si se especificó un destino explícito seguro en el query param 'next'
    if (next && next.startsWith('/') && !next.startsWith('//')) {
      const redirectResponse = NextResponse.redirect(`${origin}${next}`)
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value)
      })
      return redirectResponse
    }

    // Consultar el rol del usuario desde la tabla profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle<{ role: UserRole }>()

    // Determinar el rol (desde el perfil, metadatos de usuario o 'smoker' por defecto)
    const userRole: UserRole =
      profile?.role ||
      (session.user.user_metadata?.role as UserRole) ||
      'smoker'

    // Redirigir según el rol
    const destination = userRole === 'friend' ? '/dashboard/friends' : '/dashboard/smoker'

    const redirectResponse = NextResponse.redirect(`${origin}${destination}`)
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value)
    })
    return redirectResponse
  } catch (err) {
    console.error('Unexpected error in auth callback:', err)
    return NextResponse.redirect(`${origin}/?error=auth_failed`)
  }
}
