/**
 * v3.22 — Endpoint /api/courses?level=A1
 * Découpe les mots d'un niveau CEFR en "cours" de 5 mots (option C).
 * Renvoie la liste avec progression de l'utilisateur (mots maîtrisés sur 5).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const WORDS_PER_COURSE = 5
const VALID_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

// Emojis thématiques pour les cours (cyclent par bloc de 10)
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

  // Récupère tous les concepts du niveau, ordonnés par frequency_rank puis lemma
  // (pagination boucle pour dépasser la limite Supabase de 1000)
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

  if (allConcepts.length === 0) {
    return NextResponse.json({ courses: [], level, total_words: 0 })
  }

  // Récupère la progression user (consec_correct >= 2 = maîtrisé)
  const conceptIds = allConcepts.map(c => c.id)
  const masteredSet = new Set<string>()
  const fragileSet = new Set<string>()  // 1 réussite sans maîtrise
  const seenSet = new Set<string>()  // v3.22.4 : tout concept déjà vu (présent dans user_progress)
  // Pagination user_progress aussi
  let upFrom = 0
  while (true) {
    const upPage = conceptIds.slice(upFrom, upFrom + PAGE)
    if (upPage.length === 0) break
    const { data: progress } = await supabase
      .from('user_progress')
      .select('concept_id, consec_correct, last_seen_at')
      .eq('user_id', user.id)
      .in('concept_id', upPage)
    for (const p of (progress || [])) {
      const cid = (p as any).concept_id
      const cc = (p as any).consec_correct || 0
      if (cc >= 2) masteredSet.add(cid)
      else if (cc >= 1) fragileSet.add(cid)
      // v3.22.4 : tout concept présent dans user_progress = "started" (au moins vu)
      seenSet.add(cid)
    }
    upFrom += PAGE
    if (upPage.length < PAGE) break
  }

  // Découpe en cours de 5 mots
  type CourseStatus = 'locked' | 'available' | 'in_progress' | 'completed'

  interface CourseItem {
    id: string
    level: string
    number: number
    name: string
    emoji: string
    total: number
    mastered: number
    fragile: number
    stars: number
    status: CourseStatus
    seen: number
    preview_words: { lemma: string; gloss_fr: string | null }[]
    concept_ids: string[]
  }

  const courses: CourseItem[] = []
  for (let i = 0; i < allConcepts.length; i += WORDS_PER_COURSE) {
    const slice = allConcepts.slice(i, i + WORDS_PER_COURSE)
    const courseNum = Math.floor(i / WORDS_PER_COURSE) + 1
    const mastered = slice.filter(c => masteredSet.has(c.id)).length
    const fragile = slice.filter(c => fragileSet.has(c.id)).length
    const seen = slice.filter(c => seenSet.has(c.id)).length
    const total = slice.length

    // v3.22.4 — Étoiles plus généreuses :
    // 1 étoile = leçon faite au moins 1 fois (au moins 1 mot vu)
    // 2 étoiles = >= 50% des mots vus avec succès (mastered + fragile)
    // 3 étoiles = tous les mots maîtrisés (consec_correct >= 2)
    let stars = 0
    if (seen > 0) stars = 1
    if ((mastered + fragile) >= Math.ceil(total / 2)) stars = 2
    if (mastered === total) stars = 3

    // v3.22.4 — Unlock plus généreux : la précédente doit avoir au moins 1 étoile (pas être complétée)
    const status: CourseStatus = (courses.length > 0 && courses[courses.length - 1].stars === 0 && courseNum > 1)
      ? 'locked'
      : (stars === 3 ? 'completed' : (stars > 0 ? 'in_progress' : 'available'))

    courses.push({
      id: `${level}-${courseNum}`,
      level,
      number: courseNum,
      name: `Leçon ${courseNum}`,
      emoji: COURSE_EMOJIS[(courseNum - 1) % COURSE_EMOJIS.length],
      total,
      mastered,
      fragile,
      seen,
      stars,
      status,
      // 3 premiers mots en preview
      preview_words: slice.slice(0, 3).map(c => {
        const t = Array.isArray(c.translations) ? c.translations[0] : c.translations
        return { lemma: t?.lemma, gloss_fr: c.gloss_fr }
      }),
      // IDs concept pour démarrer la session
      concept_ids: slice.map(c => c.id),
    })
  }

  return NextResponse.json({
    level,
    total_words: allConcepts.length,
    total_courses: courses.length,
    completed_courses: courses.filter(c => c.status === 'completed').length,
    courses,
  })
}
