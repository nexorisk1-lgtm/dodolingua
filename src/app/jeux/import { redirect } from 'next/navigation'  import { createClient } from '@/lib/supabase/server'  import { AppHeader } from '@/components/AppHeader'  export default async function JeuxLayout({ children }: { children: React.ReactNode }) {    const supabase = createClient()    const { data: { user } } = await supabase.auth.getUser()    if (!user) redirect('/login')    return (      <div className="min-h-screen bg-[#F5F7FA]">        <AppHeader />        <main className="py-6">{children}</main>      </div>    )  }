import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

import { AppHeader } from '@/components/AppHeader'

export default async function JeuxLayout({ children }: { children: React.ReactNode }) {

  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (

    <div className="min-h-screen bg-[#F5F7FA]">

      <AppHeader />

      <main className="py-6">{children}</main>

    </div>

  )

}
