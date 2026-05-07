/**
 * v3.24.0 — Endpoint /api/courses?level=A1
 * Intercale grammaire dans le parcours :
 *   pattern de bloc = 5 vocab + 1 grammar (× 3) + 1 checkpoint
 *   bloc = 18 leçons (15 vocab + 3 grammar) puis 1 checkpoint
 * Le checkpoint teste 15 mots vocab + 3 topics grammaire mélangés (un seul format).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const WORDS_PER_COURSE = 5
const VOCAB_PER_BLOCK = 5            // 5 leçons vocab par mini-bloc
const GRAMMAR_PER_BLOCK = 1          // 1 leçon grammaire par mini-bloc
const BLOCKS_BEFORE_CHECKPOINT = 3   // 3 mini-blocs → 1 checkpoint (15 vocab + 3 grammar)
const VALID_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

const COURSE_EMOJIS = ['🌱', '🌿', '🌳', '🌲', '🌸', '🌺', '🌻', '🌷', '🌹', '🌼']

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const level = (searchParams.get('level') || 'A1').toUpperCase()
  if (!VALID_LEVELS.includes(level)) {
    return NextResponse.json({ error: 'invalid level' }, { status: 400 })
  }

  // ───────── 1. Récupérer tous les concepts vocab du niveau ─────────
  const allConcepts: any[] = []
  let from = 0
  const PAGE = 1000
  while (true) {
    const { data: page } = await supabase
      .from('concepts')
      .select('id, frequency_rank, gloss_fr, definition_en, translations!inner(lemma, ipa)')
      .eq('cefr_min', level)
      .eq('translations.lang_code', 'en-GB')
      .eq('enrichment_status', 'enriched')
      .order('frequency_rank', { ascending: true, nullsFirst: false })
      .range(from, from + PAGE - 1)
    if (!page || page.length === 0) break
    allConcepts.push(...page)
    if (page.length < PAGE) break
    from += PAGE
  }

  // ───────── 2. Récupérer tous les topics grammaire du niveau ─────────
  const { data: grammarTopics } = await supabase
    .from('grammar_topics')
    .select('id, slug, position, title_fr, emoji')
    .eq('level', level)
    .order('position', { ascending: true })

  if (allConcepts.length === 0 && (!grammarTopics || grammarTopics.length === 0)) {
    return NextResponse.json({ courses: [], level, total_words: 0 })
  }

  // ───────── 3. Progression vocab ─────────
  const conceptIds = allConcepts.map(c => c.id)
  const masteredSet = new Set<string>()
  const fragileSet = new Set<string>()
  const seenSet = new Set<string>()
  let upFrom = 0
  while (true) {
    const upPage = conceptIds.slice(upFrom, upFrom + PAGE)
    if (upPage.length === 0) break
    const { data: progress } = await supabase
      .from('user_progress')
      .select('concept_id, consec_correct')
      .eq('user_id', user.id)
      .in('concept_id', upPage)
    for (const p of (progress || [])) {
      const cid = (p as any).concept_id
      const cc = (p as any).consec_correct || 0
      if (cc >= 2) masteredSet.add(cid)
      else if (cc >= 1) fragileSet.add(cid)
      seenSet.add(cid)
    }
    upFrom += PAGE
    if (upPage.length < PAGE) break
  }

  // ───────── 4. Progression grammaire ─────────
  const grammarMastered = new Set<string>()
  const grammarFragile = new Set<string>()
  const grammarSeen = new Set<string>()
  if (grammarTopics && grammarTopics.length > 0) {
    const { data: gp } = await supabase
      .from('grammar_progress')
      .select('topic_id, consec_correct')
      .eq('user_id', user.id)
      .in('topic_id', grammarTopics.map(t => t.id))
    for (const p of (gp || [])) {
      const cc = (p as any).consec_correct || 0
      const tid = (p as any).topic_id
      if (cc >= 2) grammarMastered.add(tid)
      else if (cc >= 1) grammarFragile.add(tid)
      grammarSeen.add(tid)
    }
  }

  // ───────── 5. Construction du parcours intercalé ─────────
  type CourseStatus = 'locked' | 'available' | 'in_progress' | 'completed'
  type CourseKind = 'lesson' | 'grammar' | 'checkpoint'

  interface CourseItem {
    id: string
    level: string
    number: number
    name: string
    emoji: string
    kind: CourseKind
    total: number
    mastered: number
    fragile: number
    seen: number
    stars: number
    status: CourseStatus
    preview_words: { lemma: string; gloss_fr: string | null }[]
    concept_ids: string[]
    topic_id?: string
  }

  // Nombre total de mini-blocs basé sur le min(vocab, grammar)
  const totalVocabLessons = Math.ceil(allConcepts.length / WORDS_PER_COURSE)
  const totalGrammarTopics = grammarTopics?.length || 0

  // On intercale tant qu'on a du vocab. Si plus de grammaire que de blocs vocab, on cycle.
  // Si moins de grammaire, on saute la leçon grammaire (qui sera null).
  const courses: CourseItem[] = []
  let vocabIdx = 0
  let grammarIdx = 0
  let blockNum = 1            // numéro du mini-bloc courant (1, 2, 3, ...)
  let checkpointNum = 0

  while (vocabIdx < totalVocabLessons || grammarIdx < totalGrammarTopics) {
    // ─── 5a. 5 leçons vocab ───
    for (let i = 0; i < VOCAB_PER_BLOCK && vocabIdx < totalVocabLessons; i++, vocabIdx++) {
      const startWord = vocabIdx * WORDS_PER_COURSE
      const slice = allConcepts.slice(startWord, startWord + WORDS_PER_COURSE)
      const courseNum = vocabIdx + 1
      const mastered = slice.filter(c => masteredSet.has(c.id)).length
      const fragile = slice.filter(c => fragileSet.has(c.id)).length
      const seen = slice.filter(c => seenSet.has(c.id)).length
      const total = slice.length

      let stars = 0
      if (seen > 0) stars = 1
      if (seen === total) stars = 2
      if ((mastered + fragile) >= Math.ceil(total / 2)) stars = 3
      if (mastered === total) stars = 4

      const prevHasStar = courses.length === 0
        || (courses[courses.length - 1].stars > 0)
      const status: CourseStatus = (!prevHasStar && courseNum > 1)
        ? 'locked'
        : (stars === 4 ? 'completed' : (stars > 0 ? 'in_progress' : 'available'))

      courses.push({
        id: `${level}-${courseNum}`,
        level,
        number: courseNum,
        name: `Leçon ${courseNum}`,
        emoji: COURSE_EMOJIS[(courseNum - 1) % COURSE_EMOJIS.length],
        kind: 'lesson',
        total, mastered, fragile, seen, stars, status,
        preview_words: slice.slice(0, 3).map(c => {
          const t = Array.isArray(c.translations) ? c.translations[0] : c.translations
          return { lemma: t?.lemma, gloss_fr: c.gloss_fr }
        }),
        concept_ids: slice.map(c => c.id),
      })
    }

    // ─── 5b. 1 leçon grammaire ───
    if (grammarTopics && grammarIdx < totalGrammarTopics) {
      const topic = grammarTopics[grammarIdx]
      grammarIdx++
      const tid = (topic as any).id as string
      const isMastered = grammarMastered.has(tid)
      const isFragile = grammarFragile.has(tid)
      const isSeen = grammarSeen.has(tid)
      let gStars = 0
      if (isSeen) gStars = 1
      if (isFragile || isMastered) gStars = 2
      if (isMastered) gStars = 4

      const prevHasStar = courses.length === 0
        || (courses[courses.length - 1].stars > 0)
      const gStatus: CourseStatus = !prevHasStar
        ? 'locked'
        : (gStars === 4 ? 'completed' : (gStars > 0 ? 'in_progress' : 'available'))

      courses.push({
        id: `grammar-${tid}`,
        level,
        number: grammarIdx,
        name: (topic as any).title_fr,
        emoji: (topic as any).emoji || '📘',
        kind: 'grammar',
        total: 1, mastered: isMastered ? 1 : 0, fragile: isFragile ? 1 : 0, seen: isSeen ? 1 : 0,
        stars: gStars, status: gStatus,
        preview_words: [],
        concept_ids: [],
        topic_id: tid,
      })
    }

    // ─── 5c. Checkpoint après BLOCKS_BEFORE_CHECKPOINT mini-blocs ───
    if (blockNum % BLOCKS_BEFORE_CHECKPOINT === 0) {
      checkpointNum++
      // 15 vocab des 3 derniers mini-blocs
      const cpVocabStart = (vocabIdx - VOCAB_PER_BLOCK * BLOCKS_BEFORE_CHECKPOINT) * WORDS_PER_COURSE
      const cpVocabEnd = vocabIdx * WORDS_PER_COURSE
      const cpVocab = allConcepts.slice(Math.max(0, cpVocabStart), cpVocabEnd)
      const cpVocabIds = cpVocab.map(c => c.id)
      // 3 grammar topics des 3 derniers mini-blocs
      const cpGrammarStart = grammarIdx - GRAMMAR_PER_BLOCK * BLOCKS_BEFORE_CHECKPOINT
      const cpGrammarTopics = (grammarTopics || []).slice(Math.max(0, cpGrammarStart), grammarIdx)

      const cpVocabMastered = cpVocabIds.filter(id => masteredSet.has(id)).length
      const cpGrammarMastered = cpGrammarTopics.filter(t => grammarMastered.has((t as any).id)).length
      const cpTotal = cpVocab.length + cpGrammarTopics.length
      const cpMastered = cpVocabMastered + cpGrammarMastered

      // Min 2 étoiles sur les 18 leçons précédentes pour débloquer
      const previousLessons = courses.slice(-VOCAB_PER_BLOCK * BLOCKS_BEFORE_CHECKPOINT - GRAMMAR_PER_BLOCK * BLOCKS_BEFORE_CHECKPOINT)
        .filter(c => c.kind === 'lesson' || c.kind === 'grammar')
      const allPrevHaveStar = previousLessons.length > 0 && previousLessons.every(l => l.stars >= 2)

      // Étoiles checkpoint : 0 par défaut, 4 SEULEMENT si tout maîtrisé via le test
      const cpStars = cpMastered === cpTotal && cpTotal > 0 ? 4 : 0
      const cpStatus: CourseStatus = !allPrevHaveStar
        ? 'locked'
        : (cpStars === 4 ? 'completed' : (cpStars > 0 ? 'in_progress' : 'available'))

      courses.push({
        id: `${level}-cp-${checkpointNum}`,
        level,
        number: checkpointNum,
        name: `Checkpoint ${checkpointNum}`,
        emoji: '🎯',
        kind: 'checkpoint',
        total: cpTotal,
        mastered: cpMastered,
        fragile: 0,
        seen: cpMastered,
        stars: cpStars,
        status: cpStatus,
        preview_words: [],
        concept_ids: cpVocabIds,
        topic_id: cpGrammarTopics.map(t => (t as any).id).join(','),  // CSV des topics
      })
    }
    blockNum++

    // Garde-fou : si on a plus de grammaire que de vocab, on s'arrête après cycle
    if (vocabIdx >= totalVocabLessons && grammarIdx >= totalGrammarTopics) break
  }

  return NextResponse.json({
    level,
    total_words: allConcepts.length,
    total_grammar_topics: totalGrammarTopics,
    total_courses: courses.length,
    completed_courses: courses.filter(c => c.status === 'completed').length,
    courses,
  })
}
