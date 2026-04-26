/**
 * Calcul des points pour les quêtes, jeux, défis.
 */
import type { QuestType } from '@/types/database'

export interface PointsBreakdown {
  base: number
  perfect_bonus: number
  speed_bonus: number
  combo_bonus: number
  total: number
}

export function questPoints(opts: {
  perfect: boolean
  fastSeconds?: number
  combo?: number
}): PointsBreakdown {
  const base = 10
  const perfect_bonus = opts.perfect ? 5 : 0
  const speed_bonus = opts.fastSeconds !== undefined && opts.fastSeconds < 120 ? 2 : 0
  const combo_bonus = opts.combo ? Math.min(opts.combo, 5) : 0
  return {
    base, perfect_bonus, speed_bonus, combo_bonus,
    total: base + perfect_bonus + speed_bonus + combo_bonus,
  }
}

export const QUADRIFECTA_BONUS = 35   // 4/4 quêtes du jour
export const TRIFECTA_BONUS = 25      // 3/4 quêtes
export const STREAK_MILESTONES: Record<number, number> = {
  7: 50, 30: 200, 100: 1000, 365: 5000,
}

export const QUEST_TYPES: QuestType[] = ['apprentissage', 'revision', 'pratique', 'jeu']
export const QUEST_LABELS: Record<QuestType, string> = {
  apprentissage: 'Apprentissage',
  revision: 'Révision',
  pratique: 'Pratique',
  jeu: 'Jeu',
}
export const QUEST_ICONS: Record<QuestType, string> = {
  apprentissage: '📖', revision: '🔄', pratique: '💬', jeu: '🎮',
}
