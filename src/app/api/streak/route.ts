/**
 * v3.24.1 — Endpoint /api/streak
 * GET → maintenance + état actuel (streak_count, freeze_tokens, freeze_used_today)
 * POST → bump (incrémente streak après une activité réussie)
 *
 * Appelé :
 *  - GET sur le dashboard (auto-maintenance + affichage)
 *  - POST par session/submit ou grammar/post quand l'utilisateur a une bonne réponse
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const lang = (new URL(req.url).searchParams.get('lang') || 'en-GB')

  // Lance la maintenance (gestion freeze + auto-grant)
  const { data, error } = await supabase
    .rpc('streak_maintenance', { p_user: user.id, p_lang: lang })
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    streak_count: (data as any)?.streak_count ?? 0,
    streak_freeze_tokens: (data as any)?.streak_freeze_tokens ?? 0,
    freeze_used: (data as any)?.freeze_used ?? false,
  })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const lang = String(body.lang || 'en-GB')

  const { data, error } = await supabase
    .rpc('streak_bump', { p_user: user.id, p_lang: lang })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ streak_count: data })
}
