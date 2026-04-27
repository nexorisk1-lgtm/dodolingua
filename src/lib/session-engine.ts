/**
 * Moteur de session entrelacée — version concise.
 * Pour 5 mots : ~16 items au total (3-4 par mot), réparti en 3 phases.
 */

export type Modality =
  | 'discovery' | 'audio' | 'ipa' | 'micro' | 'translation' | 'example'
  | 'quiz' | 'sentence_builder' | 'listening_cloze' | 'speaking_cloze'
  | 'association' | 'memory' | 'phonetic'

export type Phase = 'discovery' | 'interleaved' | 'mix' | 'anchor'

export interface PlanItem {
  phase: Phase
  type: 'practice' | 'recall' | 'discovery' | 'mix_quiz' | 'anchor'
  word_id: string
  modality: Modality
  est_seconds: number
  recall_count?: number
}

interface BuildOpts {
  mode?: 'oral' | 'complet'
  hasImageMap?: Record<string, boolean>
}

const ORAL_MODS: Modality[] = ['audio', 'micro', 'speaking_cloze', 'listening_cloze']
const FULL_MODS: Modality[] = ['translation', 'micro', 'quiz', 'listening_cloze']

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
  const hasImage = opts.hasImageMap || {}
  const items: PlanItem[] = []
  const pool = mode === 'oral' ? ORAL_MODS : FULL_MODS

  for (const id of wordIds) {
    items.push({ phase: 'discovery', type: 'discovery', word_id: id, modality: 'discovery', est_seconds: 6 })
  }

  const queue = shuffle(wordIds)
  let idx = 0
  for (const id of queue) {
    items.push({ phase: 'interleaved', type: 'practice', word_id: id, modality: pool[idx % pool.length], est_seconds: 14 })
    idx++
  }

  for (const id of shuffle(wordIds)) {
    const useImage = mode === 'complet' && hasImage[id]
    items.push({ phase: 'interleaved', type: 'recall', word_id: id, modality: useImage ? 'association' : 'quiz', est_seconds: 10, recall_count: 1 })
  }

  for (const id of shuffle(wordIds)) {
    items.push({ phase: 'mix', type: 'mix_quiz', word_id: id, modality: mode === 'oral' ? 'speaking_cloze' : 'quiz', est_seconds: 10 })
  }

  return items
}

export function planDurationMin(plan: PlanItem[]): number {
  const sec = plan.reduce((s, it) => s + it.est_seconds, 0)
  return Math.round(sec / 60)
}

export function phaseLabel(p: Phase): string {
  return ({ discovery: 'Découverte', interleaved: 'Pratique', mix: 'Validation', anchor: 'Ancrage' })[p]
}
