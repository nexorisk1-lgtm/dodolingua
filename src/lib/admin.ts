import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

/**
 * Vérifie que l'utilisateur courant est admin.
 * Redirige vers /dashboard sinon. À utiliser au début de chaque page admin.
 */
export async function requireAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) redirect('/dashboard')
  return { user, supabase }
}

/**
 * Variante pour les routes API : retourne le user si admin, sinon throw.
 */
export async function assertAdminApi() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Response('Non authentifié', { status: 401 })
  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) throw new Response('Admin requis', { status: 403 })
  return { user, supabase }
}
