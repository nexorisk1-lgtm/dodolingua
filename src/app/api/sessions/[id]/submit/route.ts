import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { newState, review, buttonToGrade, type FSRSState, type ButtonGrade } from '@/lib/fsrs'
import { questPoints } from '@/lib/points'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const finalize = searchParams.get('finalize') === '1'
  const body = await req.json().catch(() => ({}))

  const { data: session, error: sessionError } = await supabase
    .from('learning_sessions')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (sessionError || !session) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  // ===== SOUMISSION D'UNE PHASE (v3.7) =====
  // Body : { word_id, phase, ...payload }
  // phase = 'discovery' | 'pronunciation' | 'flashcard' | 'qcm' | 'cloze'
  // Selon la phase, on dérive ou non un grade FSRS pour user_progress.
  if (body.word_id && body.phase) {
    const wordId = body.word_id as string
    const phase = body.phase as string
    const lang = session.lang_code

    // Dérive le grade FSRS selon la phase
    let derivedButton: ButtonGrade | null = null
    if (phase === 'flashcard' && body.grade) {
      derivedButton = body.grade as ButtonGrade
    } else if (phase === 'qcm') {
      derivedButton = body.qcm_correct ? 'savais' : 'pas_su'
    } else if (phase === 'cloze') {
      derivedButton = body.cloze_correct ? 'savais' : 'pas_su'
    }
    // discovery, pronunciation : pas de grade FSRS, on enregistre juste la complétion

    // Si on a un grade dérivé, applique FSRS
    if (derivedButton) {
      const grade = buttonToGrade(derivedButton)

    const { data: prog } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('lang_code', lang)
      .eq('concept_id', wordId)
      .maybeSingle()

    const state: FSRSState = (prog?.fsrs_state as FSRSState) || newState()
    const next = review(state, grade)

    await supabase.from('user_progress').upsert({
      user_id: user.id,
      lang_code: lang,
      concept_id: wordId,
      fsrs_state: next,
      last_review: next.last_review,
      next_review: next.due,
      lapses: next.lapses,
      consec_correct: grade >= 3 ? (prog?.consec_correct || 0) + 1 : 0,
      total_reviews: (prog?.total_reviews || 0) + 1,
    }, {
      onConflict: 'user_id,lang_code,concept_id'
    })

    } // end if(derivedButton)

    const results = [...(session.results_json || []), {
      word_id: wordId,
      phase,
      grade: body.grade || (body.qcm_correct !== undefined ? (body.qcm_correct ? 'savais' : 'pas_su') : undefined),
      pronunciation_score: body.pronunciation_score,
      qcm_correct: body.qcm_correct,
      cloze_correct: body.cloze_correct,
      at: new Date().toISOString()
    }]

    const hesitation = (session.hesitation_count || 0) + (body.grade === 'hesite' ? 1 : 0)
    const failFromGrade = body.grade === 'pas_su'
    const failFromQcm = body.qcm_correct === false
    const failFromCloze = body.cloze_correct === false
    const fail = (session.fail_count || 0) + ((failFromGrade || failFromQcm || failFromCloze) ? 1 : 0)

    await supabase
      .from('learning_sessions')
      .update({
        results_json: results,
        hesitation_count: hesitation,
        fail_count: fail
      })
      .eq('id', params.id)

    // v1.7 — Suivi progression incrémentale Apprentissage/Révision pour la barre du dashboard
    // On compte les mots uniques traités dans cette session.
    try {
      const uniqueWords = new Set(results.map((r: any) => r.word_id)).size
      const today = new Date().toISOString().slice(0, 10)
      const isReview = (new URL(req.url).searchParams.get('mode') === 'revision')
      const questType = isReview ? 'revision' : 'apprentissage'
      const { data: q } = await supabase.from('daily_quests')
        .select('status, points_earned, content_ref')
        .eq('user_id', user.id).eq('lang_code', lang)
        .eq('date', today).eq('quest_type', questType).maybeSingle()
      // Ne touche pas si déjà completed
      if (q?.status !== 'completed') {
        await supabase.from('daily_quests').upsert({
          user_id: user.id, lang_code: lang, date: today,
          quest_type: questType, status: 'in_progress',
          content_ref: { session_id: params.id, progress: uniqueWords },
        }, { onConflict: 'user_id,lang_code,date,quest_type' })
      }
    } catch (e) {
      // log mais ne casse pas la requête
      console.warn('quest progress update failed', e)
    }

    return NextResponse.json({ ok: true })
  }

  // ===== FINALISATION =====
  if (finalize) {
    const results: any[] = session.results_json || []
    // v3.7 — failures peuvent venir de grade=pas_su, qcm_correct=false, cloze_correct=false
    const failures = results.filter(r =>
      r.grade === 'pas_su'
      || r.qcm_correct === false
      || r.cloze_correct === false
    ).length
    const perfect = failures === 0 && results.length > 0

    const start = new Date(session.started_at).getTime()
    const dur = (Date.now() - start) / 1000

    const pts = questPoints({
      perfect,
      fastSeconds: dur < 600 ? dur : undefined,
      combo: 0,
    })

    await supabase
      .from('learning_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', params.id)

    const today = new Date().toISOString().slice(0, 10)

    // v1.7 — Distingue Révision vs Apprentissage selon le mode de session
    const isReviewMode = (new URL(req.url).searchParams.get('mode') === 'revision')
    const finalQuestType = isReviewMode ? 'revision' : 'apprentissage'
    const wordsCovered = new Set(results.map((r: any) => r.word_id)).size
    await supabase.from('daily_quests').upsert({
      user_id: user.id,
      lang_code: session.lang_code,
      date: today,
      quest_type: finalQuestType,
      status: 'completed',
      points_earned: pts.total,
      completed_at: new Date().toISOString(),
      content_ref: { session_id: params.id, progress: wordsCovered },
    }, {
      onConflict: 'user_id,lang_code,date,quest_type'
    })

    // ✅ FIX CRITIQUE ICI (remplace .catch)
    const rpcRes = await supabase.rpc('increment_user_points', {
      p_user: user.id,
      p_lang: session.lang_code,
      p_amount: pts.total,
    })

    if (rpcRes.error) {
      const { data } = await supabase
        .from('user_languages')
        .select('total_points, weekly_points')
        .eq('user_id', user.id)
        .eq('lang_code', session.lang_code)
        .single()

      if (data) {
        await supabase
          .from('user_languages')
          .update({
            total_points: (data.total_points || 0) + pts.total,
            weekly_points: (data.weekly_points || 0) + pts.total,
            last_activity: new Date().toISOString(),
          })
          .eq('user_id', user.id)
          .eq('lang_code', session.lang_code)
      }
    }

    return NextResponse.json({ ok: true, points: pts })
  }

  return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
}
