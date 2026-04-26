/**
 * FSRS (Free Spaced Repetition Scheduler) — implémentation minimaliste.
 * Basée sur les paramètres v4.5 par défaut.
 * Mappage 3 boutons :
 *   - "Je savais"          → grade 4 (Easy)
 *   - "J'ai hésité"        → grade 2 (Hard)
 *   - "Je ne savais pas"   → grade 1 (Again)
 */

export type Grade = 1 | 2 | 3 | 4 // 1=Again 2=Hard 3=Good 4=Easy
export type ButtonGrade = 'savais' | 'hesite' | 'pas_su'

export interface FSRSState {
  due: string                  // ISO datetime
  stability: number            // jours
  difficulty: number           // 1..10
  elapsed_days: number
  scheduled_days: number
  reps: number
  lapses: number
  state: 'new' | 'learning' | 'review' | 'relearning'
  last_review?: string
}

const W = [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61]
const REQUEST_RETENTION = 0.9
const MAX_INTERVAL = 36500
const FACTOR = 19 / 81

export function buttonToGrade(b: ButtonGrade): Grade {
  if (b === 'savais') return 4
  if (b === 'hesite') return 2
  return 1
}

export function newState(): FSRSState {
  return {
    due: new Date().toISOString(),
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: 0,
    lapses: 0,
    state: 'new',
  }
}

function initStability(g: Grade): number {
  return Math.max(W[g - 1], 0.1)
}
function initDifficulty(g: Grade): number {
  return clamp(W[4] - (g - 3) * W[5], 1, 10)
}
function clamp(x: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, x)) }

function nextDifficulty(d: number, g: Grade): number {
  const next_d = d - W[6] * (g - 3)
  return clamp(W[4] + (next_d - W[4]) * Math.exp(-W[7]), 1, 10)
}

function nextRecallStability(d: number, s: number, r: number, g: Grade) {
  const hardPenalty = g === 2 ? W[15] : 1
  const easyBonus = g === 4 ? W[16] : 1
  return s * (1 + Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp((1 - r) * W[10]) - 1) * hardPenalty * easyBonus)
}

function nextForgetStability(d: number, s: number, r: number) {
  return W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp((1 - r) * W[14])
}

function intervalFromStability(s: number) {
  const i = (s / FACTOR) * (Math.pow(REQUEST_RETENTION, 1 / -0.5) - 1)
  return clamp(Math.round(i), 1, MAX_INTERVAL)
}

export function review(state: FSRSState, grade: Grade, now: Date = new Date()): FSRSState {
  const due = new Date(state.due)
  const elapsed = state.last_review
    ? Math.max(0, (now.getTime() - new Date(state.last_review).getTime()) / 86400000)
    : 0
  const r = state.last_review
    ? Math.exp(Math.log(0.9) * elapsed / Math.max(state.stability, 0.1))
    : 1
  let s: number, d: number, nextState: FSRSState['state'], lapses = state.lapses
  if (state.state === 'new') {
    s = initStability(grade)
    d = initDifficulty(grade)
    nextState = grade === 1 ? 'learning' : 'review'
  } else if (grade === 1) {
    s = nextForgetStability(state.difficulty, state.stability, r)
    d = nextDifficulty(state.difficulty, grade)
    nextState = 'relearning'
    lapses += 1
  } else {
    s = nextRecallStability(state.difficulty, state.stability, r, grade)
    d = nextDifficulty(state.difficulty, grade)
    nextState = 'review'
  }
  const interval = grade === 1 ? 1 : intervalFromStability(s)
  const newDue = new Date(now.getTime() + interval * 86400000).toISOString()
  return {
    due: newDue,
    stability: s,
    difficulty: d,
    elapsed_days: elapsed,
    scheduled_days: interval,
    reps: state.reps + 1,
    lapses,
    state: nextState,
    last_review: now.toISOString(),
  }
}
