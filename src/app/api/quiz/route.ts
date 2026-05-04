/**
 * v3.14 — Génère un quiz d'évaluation CEFR pour un niveau donné.
 * 20 questions QCM mixant :
 * - Mots du niveau (sens EN→FR)
 * - Mots du niveau (sens FR→EN)
 * - Si dispo : mots du niveau supérieur (pour test de promotion)
 *
 * Distracteurs piochés dans le pool de concepts du même niveau.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const level = (searchParams.get('level') || 'A1').toUpperCase()
  if (!LEVEL_ORDER.includes(level)) {
    return NextResponse.json({ error: 'invalid level' }, { status: 400 })
  }

  // Pool de concepts au level + level suivant pour distracteurs
  const { data: concepts } = await supabase
    .from('concepts')
    .select('id, gloss_fr, cefr_min')
    .in('cefr_min', [level])
    .not('gloss_fr', 'is', null)
    .limit(50)

  if (!concepts || concepts.length < 4) {
    return NextResponse.json({ error: `Pas assez de contenu ${level} dans la biblio (besoin min 4 mots)` }, { status: 400 })
  }

  const conceptIds = concepts.map((c: any) => c.id)
  const { data: trs } = await supabase
    .from('translations')
    .select('concept_id, lemma')
    .eq('lang_code', 'en-GB')
    .in('concept_id', conceptIds)

  const lemmaByConcept: Record<string, string> = {}
  for (const t of (trs || [])) {
    lemmaByConcept[(t as any).concept_id] = (t as any).lemma
  }

  // Build pool of valid items (avec lemma + gloss_fr)
  const validItems = concepts
    .filter((c: any) => lemmaByConcept[c.id] && c.gloss_fr)
    .map((c: any) => ({ id: c.id, lemma: lemmaByConcept[c.id], gloss_fr: c.gloss_fr }))

  if (validItems.length < 4) {
    return NextResponse.json({ error: `Pas assez de mots avec traduction FR pour ce niveau` }, { status: 400 })
  }

  const allLemmas = validItems.map(v => v.lemma)
  const allGlossFr = validItems.map(v => v.gloss_fr)

  // Génère 20 questions max, alternant types
  const TARGET = Math.min(20, validItems.length * 2)
  const questions: any[] = []
  const shuffled = shuffle(validItems)
  let usedIdx = 0

  while (questions.length < TARGET) {
    const item = shuffled[usedIdx % shuffled.length]
    usedIdx++
    const isWordToFr = questions.length % 2 === 0  // alterne

    if (isWordToFr) {
      // Prompt EN, choices FR
      const distractors = shuffle(allGlossFr.filter(g => g !== item.gloss_fr)).slice(0, 3)
      const choices = shuffle([item.gloss_fr, ...distractors])
      questions.push({
        id: `${item.id}-w2f-${questions.length}`,
        prompt: item.lemma,
        choices,
        correct: item.gloss_fr,
        type: 'word_to_fr',
      })
    } else {
      // Prompt FR, choices EN
      const distractors = shuffle(allLemmas.filter(l => l !== item.lemma)).slice(0, 3)
      const choices = shuffle([item.lemma, ...distractors])
      questions.push({
        id: `${item.id}-f2w-${questions.length}`,
        prompt: item.gloss_fr,
        choices,
        correct: item.lemma,
        type: 'fr_to_word',
      })
    }
    if (usedIdx > shuffled.length * 3) break  // garde-fou anti-boucle
  }

  return NextResponse.json({ level, questions })
}
