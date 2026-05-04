/**
 * v3.16 — Quiz CEFR multi-sections, adaptatif au mode oral/complet de l'utilisateur.
 *
 * Sections générées :
 * - reading_vocab : QCM EN → FR (lecture + compréhension écrite)
 * - reading_inverse : QCM FR → EN (production écrite simple)
 * - listening : TTS prononce le mot → user pick le sens FR
 * - speaking : user prononce le mot → score audio comparé à la cible
 *
 * Filter selon user_preferences.mode :
 * - mode = 'oral' : listening + speaking uniquement (skip reading)
 * - mode = 'complet' (default) : toutes les sections
 *
 * Pondération : chaque question vaut 1 point. Threshold pass = 70% global.
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
const QUESTIONS_PER_SECTION = 5

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const level = (searchParams.get('level') || 'A1').toUpperCase()
  if (!LEVEL_ORDER.includes(level)) {
    return NextResponse.json({ error: 'invalid level' }, { status: 400 })
  }

  // Mode utilisateur : oral ou complet
  const { data: prefs } = await supabase
    .from('user_preferences').select('mode').eq('user_id', user.id).maybeSingle()
  const userMode = (prefs?.mode === 'oral') ? 'oral' : 'complet'

  // Pool concepts du level
  const { data: concepts } = await supabase
    .from('concepts')
    .select('id, gloss_fr, cefr_min')
    .in('cefr_min', [level])
    .not('gloss_fr', 'is', null)
    .limit(80)

  if (!concepts || concepts.length < 4) {
    return NextResponse.json({ error: `Pas assez de contenu ${level} dans la biblio (besoin min 4 mots)` }, { status: 400 })
  }

  const conceptIds = concepts.map((c: any) => c.id)
  const { data: trs } = await supabase
    .from('translations')
    .select('concept_id, lemma, ipa')
    .eq('lang_code', 'en-GB')
    .in('concept_id', conceptIds)

  const trByConcept: Record<string, { lemma: string; ipa: string | null }> = {}
  for (const t of (trs || [])) {
    trByConcept[(t as any).concept_id] = { lemma: (t as any).lemma, ipa: (t as any).ipa }
  }

  const validItems = concepts
    .filter((c: any) => trByConcept[c.id]?.lemma && c.gloss_fr)
    .map((c: any) => ({ id: c.id, lemma: trByConcept[c.id].lemma, ipa: trByConcept[c.id].ipa, gloss_fr: c.gloss_fr }))

  if (validItems.length < 4) {
    return NextResponse.json({ error: 'Pas assez de mots avec traduction FR' }, { status: 400 })
  }

  const allLemmas = validItems.map(v => v.lemma)
  const allGlossFr = validItems.map(v => v.gloss_fr)

  // Helper : pioche 5 items uniques dans validItems
  function pickN(n: number) {
    return shuffle(validItems).slice(0, Math.min(n, validItems.length))
  }

  const sections: any[] = []

  // === LISTENING (toujours présent) — TTS prononce, user pick le sens FR ===
  {
    const items = pickN(QUESTIONS_PER_SECTION)
    sections.push({
      key: 'listening',
      label: '🎧 Compréhension orale',
      description: 'Écoute le mot et choisis le bon sens',
      questions: items.map((item, i) => {
        const distractors = shuffle(allGlossFr.filter(g => g !== item.gloss_fr)).slice(0, 3)
        return {
          id: `${item.id}-listen-${i}`,
          type: 'listening',
          // Le client jouera item.lemma via speak() au montage de la question
          tts_text: item.lemma,
          ipa: item.ipa,
          choices: shuffle([item.gloss_fr, ...distractors]),
          correct: item.gloss_fr,
        }
      }),
    })
  }

  // === SPEAKING (toujours présent) — user prononce le mot ===
  {
    const items = pickN(QUESTIONS_PER_SECTION)
    sections.push({
      key: 'speaking',
      label: '🎙️ Expression orale',
      description: 'Prononce le mot proposé',
      questions: items.map((item, i) => ({
        id: `${item.id}-speak-${i}`,
        type: 'speaking',
        target_lemma: item.lemma,
        target_fr: item.gloss_fr,
        ipa: item.ipa,
        // Pas de choices, c'est un score audio (>= 60% de match = correct)
      })),
    })
  }

  // === READING / WRITING uniquement en mode complet ===
  if (userMode === 'complet') {
    // Reading vocab : EN → FR (lecture + compréhension)
    const itemsR = pickN(QUESTIONS_PER_SECTION)
    sections.push({
      key: 'reading_vocab',
      label: '📖 Compréhension écrite',
      description: 'Lis le mot et choisis sa traduction',
      questions: itemsR.map((item, i) => {
        const distractors = shuffle(allGlossFr.filter(g => g !== item.gloss_fr)).slice(0, 3)
        return {
          id: `${item.id}-read-${i}`,
          type: 'word_to_fr',
          prompt: item.lemma,
          ipa: item.ipa,
          choices: shuffle([item.gloss_fr, ...distractors]),
          correct: item.gloss_fr,
        }
      }),
    })

    // Writing vocab : FR → EN (production écrite, ici en QCM pour rester rapide)
    const itemsW = pickN(QUESTIONS_PER_SECTION)
    sections.push({
      key: 'writing_vocab',
      label: '✍️ Expression écrite',
      description: 'Choisis le mot anglais correspondant',
      questions: itemsW.map((item, i) => {
        const distractors = shuffle(allLemmas.filter(l => l !== item.lemma)).slice(0, 3)
        return {
          id: `${item.id}-write-${i}`,
          type: 'fr_to_word',
          prompt: item.gloss_fr,
          choices: shuffle([item.lemma, ...distractors]),
          correct: item.lemma,
        }
      }),
    })
  }

  const totalQuestions = sections.reduce((s, sec) => s + sec.questions.length, 0)

  return NextResponse.json({
    level,
    user_mode: userMode,
    sections,
    total_questions: totalQuestions,
    pass_threshold_pct: 70,
  })
}
