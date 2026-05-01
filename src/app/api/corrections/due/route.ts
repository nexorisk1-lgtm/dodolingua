/**
 * v3.6 — Liste des corrections coach à réviser (next_review <= now()).
 * Tri : les plus en retard d'abord. Limit configurable (défaut 20).
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const nowIso = new Date().toISOString()
  const { data, error } = await supabase
    .from('coach_corrections')
    .select('id, original_text, corrected_text, reason, source_mode, next_review, lapses, consec_correct, created_at')
    .eq('user_id', user.id)
    .lte('next_review', nowIso)
    .order('next_review', { ascending: true })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Count totals (pending + total)
  const { count: totalDue } = await supabase
    .from('coach_corrections')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .lte('next_review', nowIso)

  const { count: totalAll } = await supabase
    .from('coach_corrections')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  return NextResponse.json({
    items: data || [],
    counts: { due: totalDue || 0, total: totalAll || 0 },
  })
}
