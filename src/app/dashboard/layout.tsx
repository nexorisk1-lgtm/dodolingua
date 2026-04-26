import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Container } from '@/components/ui/Container'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <header className="bg-white border-b border-rule">
        <Container className="flex items-center justify-between py-3">
          <Link href="/dashboard" className="font-extrabold text-primary-700">DodoLingua</Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/dashboard" className="text-gray-700 hover:text-primary-700">Accueil</Link>
            <Link href="/profile" className="text-gray-700 hover:text-primary-700">Profil</Link>
            <form action="/api/auth/signout" method="post">
              <button className="text-gray-500 hover:text-warn text-sm">Déconnexion</button>
            </form>
          </nav>
        </Container>
      </header>
      <main className="py-6">{children}</main>
    </div>
  )
}
