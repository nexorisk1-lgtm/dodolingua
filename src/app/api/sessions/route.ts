import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildInterleavedPlan } from '@/lib/session-engine'

// v1.4 — Liste des niveaux CEFR <= au niveau utilisateur (inclusif)
function levelsAtOrBelow(target: string | null | undefined): string[] {
  const order = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
  const t = (target || 'A1').toUpperCase()
  const idx = order.indexOf(t)
  return idx < 0 ? ['A1'] : order.slice(0, idx + 1)
}


export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const lang_code = body.lang_code || 'en-GB'
  const wordCount = Math.min(Math.max(body.word_count || 5, 3), 8)
  const lesson_id = body.lesson_id || null

  const { data: prefs } = await supabase
    .from('user_preferences').select('mode').eq('user_id', user.id).eq('lang_code', lang_code).single()
  const mode = (prefs?.mode || 'complet') as 'oral' | 'complet'

  let concepts: { id: string; image_url: string | null }[] = []

  if (lesson_id) {
    const { data } = await supabase.from('lesson_concepts')
      .select('concepts(id, image_url)').eq('lesson_id', lesson_id)
    concepts = (data || []).flatMap((r: any) => r.concepts ? [r.concepts] : []).slice(0, wordCount)
  }

  if (concepts.length < wordCount) {
    // v1.4 — Filtre CEFR : ne propose que les niveaux <= niveau utilisateur
    const { data: ulang } = await supabase
      .from('user_languages').select('cefr_global').eq('user_id', user.id)
      .eq('lang_code', lang_code).maybeSingle()
    const allowedLevels = levelsAtOrBelow(ulang?.cefr_global)
    const need = wordCount - concepts.length
    const knownIds = new Set(concepts.map(c => c.id))
    const { data: unseen } = await supabase
      .from('concepts').select('id, image_url')
      .in('cefr_min', allowedLevels)
      .limit(need * 3)
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
