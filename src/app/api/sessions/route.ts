import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildInterleavedPlan } from '@/lib/session-engine'

/**
 * POST /api/sessions
 * Body: { lang_code, lesson_id?, word_count? }
 * Crée une session entrelacée. Sélectionne automatiquement les concepts à apprendre.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const lang_code = body.lang_code || 'en-GB'
  const wordCount = Math.min(Math.max(body.word_count || 8, 4), 12)
  const lesson_id = body.lesson_id || null

  // Préférences user (mode)
  const { data: prefs } = await supabase
    .from('user_preferences').select('mode').eq('user_id', user.id).eq('lang_code', lang_code).single()
  const mode = (prefs?.mode || 'complet') as 'oral' | 'complet'

  // Sélectionner les concepts (priorité : items dus en SRS, sinon nouveaux concepts)
  let concepts: { id: string; image_url: string | null }[] = []
  if (lesson_id) {
    const { data } = await supabase.from('lesson_concepts')
      .select('concepts(id, image_url)').eq('lesson_id', lesson_id)
    concepts = (data || []).flatMap((r: any) => r.concepts ? [r.concepts] : []).slice(0, wordCount)
  }
  if (concepts.length < wordCount) {
    const need = wordCount - concepts.length
    const knownIds = new Set(concepts.map(c => c.id))
    // Concepts non encore vus par l'utilisateur
    const { data: unseen } = await supabase
      .from('concepts').select('id, image_url').limit(need * 2)
    for (const c of unseen || []) {
      if (concepts.length >= wordCount) break
      if (!knownIds.has(c.id)) concepts.push(c)
    }
  }

  if (concepts.length === 0) {
    return NextResponse.json({ error: 'Aucun concept disponible' }, { status: 400 })
  }

  const wordIds = concepts.map(c => c.id)
  const hasImageMap: Record<string, boolean> = {}
  for (const c of concepts) hasImageMap[c.id] = !!c.image_url

  const plan = buildInterleavedPlan(wordIds, { mode, hasImageMap })

  const { data: session, error } = await supabase
    .from('learning_sessions').insert({
      user_id: user.id, lang_code, lesson_id,
      plan_json: plan, results_json: [], started_at: new Date().toISOString(),
    }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: session.id, plan, word_ids: wordIds })
}
