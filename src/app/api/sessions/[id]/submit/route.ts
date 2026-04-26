import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { newState, review, buttonToGrade, type FSRSState, type ButtonGrade } from '@/lib/fsrs'
import { questPoints } from '@/lib/points'

/**
 * PATCH /api/sessions/:id/submit
 * Body: { word_id, grade: 'savais'|'hesite'|'pas_su' }
 * Met à jour user_progress (FSRS) + ajoute un résultat à la session.
 * Quand session terminée (PATCH avec ?finalize=1), incrémente quête + points.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const finalize = searchParams.get('finalize') === '1'
  const body = await req.json().catch(() => ({}))

  const { data: session } = await supabase
    .from('learning_sessions').select('*').eq('id', params.id).eq('user_id', user.id).single()
  if (!session) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // ---- Soumission d'un item ----
  if (body.word_id && body.grade) {
    const wordId = body.word_id as string
    const grade = buttonToGrade(body.grade as ButtonGrade)
    const lang = session.lang_code

    const { data: prog } = await supabase.from('user_progress')
      .select('*').eq('user_id', user.id).eq('lang_code', lang).eq('concept_id', wordId).maybeSingle()

    const state: FSRSState = (prog?.fsrs_state as FSRSState) || newState()
    const next = review(state, grade)

    await supabase.from('user_progress').upsert({
      user_id: user.id, lang_code: lang, concept_id: wordId,
      fsrs_state: next, last_review: next.last_review,
      next_review: next.due, lapses: next.lapses,
      consec_correct: grade >= 3 ? (prog?.consec_correct || 0) + 1 : 0,
      total_reviews: (prog?.total_reviews || 0) + 1,
    }, { onConflict: 'user_id,lang_code,concept_id' })

    const results = [...(session.results_json || []), {
      word_id: wordId, grade: body.grade, at: new Date().toISOString()
    }]
    const hesitation = (session.hesitation_count || 0) + (body.grade === 'hesite' ? 1 : 0)
    const fail = (session.fail_count || 0) + (body.grade === 'pas_su' ? 1 : 0)

    await supabase.from('learning_sessions')
      .update({ results_json: results, hesitation_count: hesitation, fail_count: fail })
      .eq('id', params.id)

    return NextResponse.json({ ok: true, next_review: next.due })
  }

  // ---- Finalisation : marquer la quête + points ----
  if (finalize) {
    const results: any[] = session.results_json || []
    const failures = results.filter(r => r.grade === 'pas_su').length
    const perfect = failures === 0 && results.length > 0
    const start = new Date(session.started_at).getTime()
    const dur = (Date.now() - start) / 1000

    const pts = questPoints({
      perfect,
      fastSeconds: dur < 600 ? dur : undefined,
      combo: 0,
    })

    await supabase.from('learning_sessions').update({ ended_at: new Date().toISOString() }).eq('id', params.id)

    const today = new Date().toISOString().slice(0, 10)
    await supabase.from('daily_quests').upsert({
      user_id: user.id, lang_code: session.lang_code,
      date: today, quest_type: 'apprentissage',
      status: 'completed', points_earned: pts.total,
      completed_at: new Date().toISOString(),
      content_ref: { session_id: params.id },
    }, { onConflict: 'user_id,lang_code,date,quest_type' })

    // Total points par langue
    await supabase.rpc('increment_user_points', {
      p_user: user.id, p_lang: session.lang_code, p_amount: pts.total,
    }).then(() => {}).catch(async () => {
      // Fallback : update direct
      const { data } = await supabase.from('user_languages')
        .select('total_points, weekly_points').eq('user_id', user.id).eq('lang_code', session.lang_code).single()
      if (data) {
        await supabase.from('user_languages')
          .update({
            total_points: (data.total_points || 0) + pts.total,
            weekly_points: (data.weekly_points || 0) + pts.total,
            last_activity: new Date().toISOString(),
          })
          .eq('user_id', user.id).eq('lang_code', session.lang_code)
      }
    })

    return NextResponse.json({ ok: true, points: pts })
  }

  return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
}
