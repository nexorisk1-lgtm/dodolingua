'use client'

import Link from 'next/link'

import { usePathname, useRouter } from 'next/navigation'

import { Container } from '@/components/ui/Container'

export function AppHeader() {

  const pathname = usePathname()

  const router = useRouter()

  const isDashboard = pathname === '/dashboard'

  return (

    <header className="bg-white border-b border-rule sticky top-0 z-30">

      <Container className="flex items-center justify-between py-3 gap-3">

        <div className="flex items-center gap-2">

          {!isDashboard && (

            <button

              onClick={() => router.back()}

              className="text-sm text-gray-600 hover:text-primary-700 px-2 py-1 rounded-md hover:bg-primary-50"

              title="Retour"

            >

              ← Retour

            </button>

          )}

          <Link href="/dashboard" className="font-extrabold text-primary-700 text-lg">

            DodoLingua

          </Link>

        </div>

        <nav className="flex items-center gap-3 text-sm">

          <Link href="/dashboard" className="text-gray-700 hover:text-primary-700">🏠 Accueil</Link>

          <Link href="/profile" className="text-gray-700 hover:text-primary-700">👤 Profil</Link>

          <form action="/api/auth/signout" method="post">

            <button className="text-gray-500 hover:text-warn text-sm">Déconnexion</button>

          </form>

        </nav>

      </Container>

    </header>

  )

}
