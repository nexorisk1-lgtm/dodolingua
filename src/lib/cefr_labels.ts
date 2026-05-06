/**
 * v3.22 — Labels CEFR avec correspondance Simpler-like.
 * On garde le code CEFR officiel + nom commun pour mieux parler à l'utilisateur.
 */

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

export const CEFR_LABEL: Record<CefrLevel, string> = {
  A1: 'Elementary',
  A2: 'Pre-Intermediate',
  B1: 'Intermediate',
  B2: 'Upper-Intermediate',
  C1: 'Advanced',
  C2: 'Proficient',
}

export const CEFR_EMOJI: Record<CefrLevel, string> = {
  A1: '🌱',
  A2: '🌿',
  B1: '🌳',
  B2: '🌲',
  C1: '⭐',
  C2: '🏆',
}

/** Format complet : "A1 = Elementary" */
export function cefrFull(level: string | null | undefined): string {
  if (!level) return 'A1 = Elementary'
  const lvl = level.toUpperCase() as CefrLevel
  return CEFR_LABEL[lvl] ? `${lvl} = ${CEFR_LABEL[lvl]}` : level
}

/** Format compact : "A1" si level connu */
export function cefrShort(level: string | null | undefined): string {
  return (level || 'A1').toUpperCase()
}

/** Label seul : "Elementary" */
export function cefrLabel(level: string | null | undefined): string {
  if (!level) return 'Elementary'
  const lvl = level.toUpperCase() as CefrLevel
  return CEFR_LABEL[lvl] || level
}
