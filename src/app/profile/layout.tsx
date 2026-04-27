import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppHeader } from '@/components/AppHeader'
import { BottomNav } from '@/components/BottomNav'

export default async function ProfileLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <AppHeader />
      <main className="py-6 pb-24">{children}</main>
      <BottomNav />
    </div>
  )
}
