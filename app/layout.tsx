import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Exhala — Respira libertad',
  description: 'Aplicación minimalista y consciente de apoyo para dejar de fumar con gamificación botánica y apoyo mutuo.',
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
      </head>
      <body className="antialiased bg-white text-neutral-900 min-h-screen">
        {children}
      </body>
    </html>
  )
}

