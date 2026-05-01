/**
 * v3.7 — Moteur de session apprentissage à 5 phases par mot.
 *
 * Pour chaque mot, on génère 5 PlanItems exécutés dans l'ordre :
 *   1. discovery       — Voir/écouter le mot pour la 1re fois (image, IPA, traduction, exemple)
 *   2. pronunciation   — Enregistrer sa voix, comparer à la cible, score
 *   3. flashcard       — Rappel actif FR→EN avec FSRS (3 boutons savais/hesite/pas_su)
 *   4. qcm             — Reconnaissance EN→FR avec 4 choix
 *   5. cloze           — Mise en contexte : phrase à compléter avec 3 options
 *
 * Pour 5 mots → 25 items, ~3-4 min par mot, ~20 min de session.
 * Future evolution : mode "révision" peut sauter la phase discovery.
 */

export type Phase =
  | 'discovery' | 'pronunciation' | 'flashcard' | 'qcm' | 'cloze'
  | 'correction_review'  // v3.8.1 — révision FSRS d'une correction coach

export interface PlanItem {
  phase: Phase
  word_id: string
  est_seconds: number
}

interface BuildOpts {
  /** Mode 'oral' : skip flashcard et qcm (focus prononciation/exemple).
   *  Mode 'complet' (défaut) : 5 phases. */
  mode?: 'oral' | 'complet'
  /** Si true (mode révision), on saute discovery (mot déjà connu). */
  skipDiscovery?: boolean
}

const PHASE_DURATION: Record<Phase, number> = {
  discovery: 30,
  pronunciation: 45,
  flashcard: 20,
  qcm: 15,
  cloze: 25,
  correction_review: 25,  // v3.8.1
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function buildInterleavedPlan(
  wordIds: string[],
  opts: BuildOpts = {}
): PlanItem[] {
  const mode = opts.mode || 'complet'
  const items: PlanItem[] = []

  // v3.7.1 — Plan par GROUPE D'EXERCICE (Babbel/Memrise style), pas par mot.
  // Tu vois la découverte des 5 mots, PUIS tu prononces les 5 mots, PUIS tu fais
  // les 5 flashcards, etc. Chaque groupe est mélangé indépendamment pour varier
  // l'ordre des mots à chaque phase.
  const phasesAll: Phase[] = opts.skipDiscovery
    ? ['pronunciation', 'flashcard', 'qcm', 'cloze']
    : ['discovery', 'pronunciation', 'flashcard', 'qcm', 'cloze']
  // Mode oral : skip flashcard + qcm (focus prononciation et contexte)
  const phases = mode === 'oral'
    ? phasesAll.filter(p => p !== 'flashcard' && p !== 'qcm')
    : phasesAll
  for (const ph of phases) {
    const groupOrder = shuffle(wordIds)
    for (const id of groupOrder) {
      items.push({ phase: ph, word_id: id, est_seconds: PHASE_DURATION[ph] })
    }
  }
  return items
}

export function planDurationMin(plan: PlanItem[]): number {
  const sec = plan.reduce((s, it) => s + it.est_seconds, 0)
  return Math.round(sec / 60)
}

export function phaseLabel(p: Phase): string {
  return ({
    discovery: 'Découverte',
    pronunciation: 'Prononciation',
    flashcard: 'Flashcard',
    qcm: 'Traduction',
    cloze: 'Mise en contexte',
    correction_review: 'Révision corrections',
  } as Record<Phase, string>)[p]
}

export function phaseEmoji(p: Phase): string {
  return ({
    discovery: '🔍',
    pronunciation: '🎙️',
    flashcard: '🃏',
    qcm: '📝',
    cloze: '💬',
    correction_review: '✏️',
  } as Record<Phase, string>)[p]
}
