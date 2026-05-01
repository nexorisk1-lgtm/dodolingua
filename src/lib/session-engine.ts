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
  discovery: 30,      // lecture + clic
  pronunciation: 45,  // enregistrement + scoring
  flashcard: 20,      // 3-5s reflexion + reveal + grade
  qcm: 15,            // QCM rapide
  cloze: 25,          // lire la phrase + choisir
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

  // Pour chaque mot, on enchaîne les 5 phases.
  // L'utilisateur fait UN mot complet (5 phases) avant de passer au suivant.
  // Plus pédagogique que l'interleaved fatiguant pour un débutant.
  const order = shuffle(wordIds)
  for (const id of order) {
    const phasesForWord: Phase[] = opts.skipDiscovery
      ? ['pronunciation', 'flashcard', 'qcm', 'cloze']
      : ['discovery', 'pronunciation', 'flashcard', 'qcm', 'cloze']
    // Mode oral : skip flashcard + qcm (focus prononciation et contexte)
    const filtered = mode === 'oral'
      ? phasesForWord.filter(p => p !== 'flashcard' && p !== 'qcm')
      : phasesForWord
    for (const ph of filtered) {
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
  } as Record<Phase, string>)[p]
}

export function phaseEmoji(p: Phase): string {
  return ({
    discovery: '🔍',
    pronunciation: '🎙️',
    flashcard: '🃏',
    qcm: '📝',
    cloze: '💬',
  } as Record<Phase, string>)[p]
}
