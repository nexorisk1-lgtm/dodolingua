/**
 * Moteur de session entrelacée — 4 phases.
 * Génère un plan d'exercices alterné pour une liste de mots à apprendre.
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
  hasImageMap?: Record<string, boolean>   // word_id → true si concept a une image
}

const ORAL_MODS: Modality[] = ['audio', 'ipa', 'micro', 'speaking_cloze', 'phonetic', 'listening_cloze']
const FULL_MODS: Modality[] = ['audio', 'ipa', 'micro', 'translation', 'example', 'quiz', 'sentence_builder', 'listening_cloze', 'speaking_cloze', 'phonetic']

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pickPracticeModality(mode: 'oral' | 'complet', usedCount: number): Modality {
  const pool = mode === 'oral' ? ORAL_MODS : FULL_MODS
  // Légère variation pour ne pas répéter
  return pool[(usedCount * 7) % pool.length]
}

function pickRecallModality(mode: 'oral' | 'complet', recallIdx: number): Modality {
  const recallPool: Modality[] = mode === 'oral'
    ? ['speaking_cloze', 'listening_cloze', 'phonetic']
    : ['quiz', 'sentence_builder', 'listening_cloze', 'speaking_cloze']
  return recallPool[recallIdx % recallPool.length]
}

export function buildInterleavedPlan(
  wordIds: string[],
  opts: BuildOpts = {}
): PlanItem[] {
  const mode = opts.mode || 'complet'
  const hasImage = opts.hasImageMap || {}
  const items: PlanItem[] = []

  // ---- Phase 1 — Discovery burst ----
  for (const id of wordIds) {
    items.push({
      phase: 'discovery',
      type: 'discovery',
      word_id: id,
      modality: 'discovery',
      est_seconds: 7,
    })
  }

  // ---- Phase 2 — Pratique entrelacée ----
  // Chaque mot reçoit 2-3 expositions : 1 practice + 1-2 recalls.
  const queue = shuffle(wordIds)
  const recall: { id: string; count: number }[] = []
  const practiceCount: Record<string, number> = {}

  let safety = 0
  while ((queue.length > 0 || recall.length > 0) && safety++ < 200) {
    const wantRecall = Math.random() < 0.4 && recall.length > 0
    if (wantRecall) {
      const r = recall.shift()!
      items.push({
        phase: 'interleaved',
        type: 'recall',
        word_id: r.id,
        modality: pickRecallModality(mode, r.count),
        est_seconds: 12,
        recall_count: r.count + 1,
      })
      if (r.count + 1 < 2) recall.push({ id: r.id, count: r.count + 1 })
    } else if (queue.length > 0) {
      const id = queue.shift()!
      const used = (practiceCount[id] = (practiceCount[id] || 0) + 1)
      items.push({
        phase: 'interleaved',
        type: 'practice',
        word_id: id,
        modality: pickPracticeModality(mode, used),
        est_seconds: 18,
      })
      recall.push({ id, count: 0 })
    }
  }

  // ---- Phase 3 — Mix quiz final ----
  for (const id of shuffle(wordIds)) {
    const useImage = mode === 'complet' && hasImage[id]
    items.push({
      phase: 'mix',
      type: 'mix_quiz',
      word_id: id,
      modality: useImage ? 'association' : 'quiz',
      est_seconds: 10,
    })
  }
  // 2e format
  for (const id of shuffle(wordIds)) {
    items.push({
      phase: 'mix',
      type: 'mix_quiz',
      word_id: id,
      modality: mode === 'oral' ? 'speaking_cloze' : 'sentence_builder',
      est_seconds: 12,
    })
  }

  // ---- Phase 4 — Ancrage ----
  // Phase générique ; les mots hésitants seront ré-injectés à l'exécution
  for (const id of wordIds) {
    items.push({
      phase: 'anchor',
      type: 'anchor',
      word_id: id,
      modality: 'translation',
      est_seconds: 8,
    })
  }

  return items
}

export function planDurationMin(plan: PlanItem[]): number {
  const sec = plan.reduce((s, it) => s + it.est_seconds, 0)
  return Math.round(sec / 60)
}

export function phaseLabel(p: Phase): string {
  return ({ discovery: 'Discovery', interleaved: 'Pratique entrelacée', mix: 'Mix quiz', anchor: 'Ancrage' })[p]
}
