import type { Metadata, Viewport } from 'next'
import './globals.css'

export const viewport: Viewport = {
  themeColor: '#064e3b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  title: 'Exhala — Respira libertad',
  description: 'Aplicación minimalista y consciente de apoyo para dejar de fumar con gamificación botánica y apoyo mutuo.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Exhala',
  },
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
    shortcut: '/icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="icon" href="/icon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/icon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400;1,9..144,500&family=Work+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="antialiased bg-[#0F1913] text-[#F1EEE2] min-h-screen">
        {children}
      </body>
    </html>
  )
}
