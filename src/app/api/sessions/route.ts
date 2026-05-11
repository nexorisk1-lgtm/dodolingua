/**
 * v3.7 — Création d'une session d'apprentissage avec données enrichies.
 *
 * Le client reçoit :
 *  - id : session id
 *  - plan : PlanItem[] (liste des phases ordonnées)
 *  - words : Record<word_id, WordData> (toutes les infos pour render chaque phase)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildInterleavedPlan } from '@/lib/session-engine'

function levelsAtOrBelow(target: string | null | undefined): string[] {
  const order = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
  const t = (target || 'A1').toUpperCase()
  const idx = order.indexOf(t)
  return idx < 0 ? ['A1'] : order.slice(0, idx + 1)
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const lang_code = body.lang_code || 'en-GB'
  const wordCount = Math.min(Math.max(body.word_count || 5, 3), 30)
  const lesson_id = body.lesson_id || null
  const isReview = body.mode === 'revision'
  // v3.12 — type filter : 'words' (skip corrections), 'grammar' (only corrections), undefined (both)
  const typeFilter = body.type === 'words' || body.type === 'grammar' ? body.type : undefined
  // v3.22 — course_id : ?course=A1-1 → on pioche les 5 mots du cours dans l'ordre
  const courseId: string | undefined = body.course_id

  const { data: prefs } = await supabase
    .from('user_preferences').select('mode').eq('user_id', user.id).eq('lang_code', lang_code).single()
  const mode = (prefs?.mode || 'complet') as 'oral' | 'complet'

  // 1. Sélection des concepts
  let concepts: { id: string; image_url: string | null; image_alt?: string | null; gloss_fr?: string | null; cefr_min?: string }[] = []

  // v3.22 — Si course_id fourni : pioche les 5 mots du cours
  // v3.24.6 — IMPORTANT : on filtre par translations!inner pour aligner avec /api/courses
  // Sinon, certains concepts sans traduction en-GB sont dans la session mais pas dans le calcul d'étoiles
  // → décalage du découpage → mots qui se répètent (ex: 'apartment' apparaît dans plusieurs leçons)
  // v3.31.0 — Support du nouveau format `${level}-${lesson_id}` (ex A1-A1_L002)
  // ET de l'ancien format `${level}-${num}` (ex A1-1) pour compat ascendante
  if (courseId) {
    // Nouveau format thématique : A1-A1_L002, B2-B2_L135, etc.
    const newFormatMatch = courseId.match(/^([A-C][12]\+?)-([A-Z][12]\+?_L\d+)$/)
    // Ancien format ordinal : A1-1, B2-23
    const oldFormatMatch = courseId.match(/^([A-C][12])-(\d+)$/)

    if (newFormatMatch) {
      const lessonIdParam = newFormatMatch[2]
      const { data: courseConcepts } = await supabase
        .from('concepts')
        .select('id, image_url, image_alt, gloss_fr, cefr_min, frequency_rank, translations!inner(lemma)')
        .eq('lesson_id', lessonIdParam)
        .eq('enrichment_status', 'enriched')
        .eq('translations.lang_code', 'en-GB')
        .order('frequency_rank', { ascending: true, nullsFirst: false })
      if (courseConcepts && courseConcepts.length > 0) {
        concepts = courseConcepts as any
      }
    } else if (oldFormatMatch) {
      const level = oldFormatMatch[1]
      const courseNum = parseInt(oldFormatMatch[2], 10)
      const offset = (courseNum - 1) * 5
      const { data: courseConcepts } = await supabase
        .from('concepts')
        .select('id, image_url, image_alt, gloss_fr, cefr_min, translations!inner(lemma)')
        .eq('cefr_min', level)
        .eq('enrichment_status', 'enriched')
        .eq('translations.lang_code', 'en-GB')
        .order('frequency_rank', { ascending: true, nullsFirst: false })
        .range(offset, offset + 4)
      if (courseConcepts && courseConcepts.length > 0) {
        concepts = courseConcepts as any
      }
    }
  }

  if (lesson_id) {
    const { data } = await supabase.from('lesson_concepts')
      .select('concepts(id, image_url, image_alt, gloss_fr, cefr_min)').eq('lesson_id', lesson_id)
    concepts = (data || []).flatMap((r: any) => r.concepts ? [r.concepts] : []).slice(0, wordCount)
  }

  if (concepts.length < wordCount) {
    const { data: ulang } = await supabase
      .from('user_languages').select('cefr_global').eq('user_id', user.id)
      .eq('lang_code', lang_code).maybeSingle()
    const allowedLevels = levelsAtOrBelow(ulang?.cefr_global)
    const need = wordCount - concepts.length
    const knownIds = new Set(concepts.map(c => c.id))

    if (isReview) {
      // Mode révision : pioche dans les concepts déjà vus avec next_review <= now
      const nowIso = new Date().toISOString()
      const { data: due } = await supabase
        .from('user_progress')
        .select('concept_id')
        .eq('user_id', user.id).eq('lang_code', lang_code)
        .lte('next_review', nowIso)
        .order('next_review', { ascending: true })
        .limit(need)
      const dueIds = (due || []).map((d: any) => d.concept_id)
      if (dueIds.length > 0) {
        const { data: dueConcepts } = await supabase
          .from('concepts').select('id, image_url, image_alt, gloss_fr, cefr_min').in('id', dueIds)
        for (const c of dueConcepts || []) {
          if (concepts.length >= wordCount) break
          if (!knownIds.has(c.id)) concepts.push(c)
        }
      }
    }

    // Si toujours pas assez : nouveaux concepts dans le niveau
    if (concepts.length < wordCount) {
      const { data: unseen } = await supabase
        .from('concepts').select('id, image_url, image_alt, gloss_fr, cefr_min')
        .in('cefr_min', allowedLevels)
        .limit((wordCount - concepts.length) * 4)
      for (const c of unseen || []) {
        if (concepts.length >= wordCount) break
        if (!knownIds.has(c.id)) concepts.push(c)
      }
    }
  }

  if (concepts.length === 0) {
    return NextResponse.json({ error: 'Aucun concept disponible' }, { status: 400 })
  }

  // 2. Récupère translations EN pour ces concepts
  const wordIds = concepts.map(c => c.id)
  const { data: trData } = await supabase
    .from('translations')
    .select('concept_id, lemma, ipa, audio_url, example')
    .in('concept_id', wordIds)
    .eq('lang_code', lang_code)

  const trMap: Record<string, { lemma: string; ipa: string | null; audio_url: string | null; example: string | null }> = {}
  for (const t of trData || []) {
    trMap[t.concept_id] = {
      lemma: t.lemma,
      ipa: t.ipa,
      audio_url: t.audio_url,
      example: t.example,
    }
  }

  // 3. Pool de distracteurs (autres concepts du même niveau, pour QCM et Cloze)
  // On prend ~20 concepts random du même niveau pour avoir des distracteurs variés
  // v3.24.4 — Pool distracteurs via RPC SQL ORDER BY random() (vraiment aléatoire)
  // Avant : limit(1000) sans ORDER BY = toujours les 1000 premiers (apartment apparaissait dans 50/1000 = 5% des sessions)
  // Après : ORDER BY random() côté Postgres = vraiment 50 mots tirés au hasard parmi 11000+
  const { data: pool } = await supabase.rpc('get_random_concepts', { p_count: 50 })

  // v3.24.4 — Lemmas pour distracteurs Cloze : RPC random aussi (50 mots aléatoires)
  const { data: poolTr } = await supabase.rpc('get_random_lemmas', { p_count: 50, p_lang: lang_code })

  const poolGlossFr = (pool || []).map((p: any) => p.gloss_fr).filter(Boolean) as string[]
  const poolLemmas = (poolTr || []).map((p: any) => p.lemma).filter(Boolean) as string[]

  // 4. Construit la donnée par word avec distracteurs
  const words: Record<string, any> = {}
  for (const c of concepts) {
    const tr = trMap[c.id]
    if (!tr) continue
    // QCM (EN→FR) : 3 distracteurs FR
    const qcmDistractors = shuffle(poolGlossFr.filter(g => g !== c.gloss_fr)).slice(0, 3)
    const qcmOptions = shuffle([c.gloss_fr || '', ...qcmDistractors]).filter(Boolean)
    // Cloze : 2 distracteurs lemma + le bon
    const clozeDistractors = shuffle(poolLemmas.filter(l => l !== tr.lemma)).slice(0, 2)
    const clozeOptions = shuffle([tr.lemma, ...clozeDistractors])
    // Cloze sentence : on prend l'exemple, on remplace le mot cible par ___
    const clozeSentence = tr.example
      ? tr.example.replace(new RegExp(`\\b${escapeRegex(tr.lemma)}\\b`, 'i'), '___')
      : null

    words[c.id] = {
      id: c.id,
      lemma: tr.lemma,
      ipa: tr.ipa,
      audio_url: tr.audio_url,
      example: tr.example,
      gloss_fr: c.gloss_fr || null,
      image_url: c.image_url,
      image_alt: c.image_alt || null,
      qcm: { correct: c.gloss_fr || '', options: qcmOptions },
      cloze: clozeSentence ? { sentence: clozeSentence, correct: tr.lemma, options: clozeOptions } : null,
    }
  }

  // 5. Construit le plan
  // v3.12 — En mode révision avec type='grammar', on ne fait QUE les corrections (pas de mots)
  const plan = (isReview && typeFilter === 'grammar')
    ? []
    : buildInterleavedPlan(wordIds, { mode, skipDiscovery: isReview })

  // v3.8.1 + v3.12 — En mode révision, ajoute aussi les corrections coach dûes (FSRS)
  // sauf si typeFilter='words' (utilisateur veut juste vocabulaire)
  let corrections: any[] = []
  if (isReview && typeFilter !== 'words') {
    const nowIso = new Date().toISOString()
    const { data: dueCorr } = await supabase
      .from('coach_corrections')
      .select('id, original_text, corrected_text, corrected_fr, reason, grammar_rule, source_mode, is_drill_variant')
      .eq('user_id', user.id)
      .lte('next_review', nowIso)
      .order('next_review', { ascending: true })
      .limit(10)
    if (dueCorr && dueCorr.length > 0) {
      corrections = dueCorr
      // Ajoute des PlanItems 'correction_review' à la fin du plan
      for (const c of dueCorr) {
        plan.push({ phase: 'correction_review' as any, word_id: `corr-${c.id}`, est_seconds: 25 })
      }
    }
  }

  const { data: session, error } = await supabase
    .from('learning_sessions').insert({
      user_id: user.id, lang_code, lesson_id,
      plan_json: plan, results_json: [], started_at: new Date().toISOString(),
    }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ id: session.id, plan, words, corrections })
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
