import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'DodoLingua — Apprends efficacement',
  description: "Application d'apprentissage des langues. Anglais UK, multi-langues, gamification, coach IA.",
  manifest: '/manifest.json',
  applicationName: 'DodoLingua',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'DodoLingua',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: '#1F4E79',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="font-sans antialiased min-h-screen">{children}</body>
    </html>
  )
}
