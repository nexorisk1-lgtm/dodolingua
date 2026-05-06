import type { LeagueTier } from '@/types/database'

/**
 * v3.23 — 10 niveaux Pacer-like (système hebdomadaire avec promotion/relégation).
 *
 * promote_top : nombre de joueurs (sur 20) qui montent à la fin de la semaine.
 * Plus on monte, plus c'est difficile (moins de places en promotion).
 */
export const LEAGUE_TIERS: { id: LeagueTier; emoji: string; label: string; color: string; promote_top: number }[] = [
  { id: 'bronze',     emoji: '🥉', label: 'Bronze',      color: '#CD7F32', promote_top: 15 },
  { id: 'argent',     emoji: '🥈', label: 'Argent',      color: '#C0C0C0', promote_top: 12 },
  { id: 'or',         emoji: '🥇', label: 'Or',          color: '#FFD700', promote_top: 10 },
  { id: 'saphir',     emoji: '💎', label: 'Saphir',      color: '#0F52BA', promote_top: 8 },
  { id: 'rubis',      emoji: '❤️', label: 'Rubis',       color: '#E0115F', promote_top: 7 },
  { id: 'emeraude',   emoji: '💚', label: 'Émeraude',    color: '#50C878', promote_top: 5 },
  { id: 'amethyste',  emoji: '💜', label: 'Améthyste',   color: '#9966CC', promote_top: 5 },
  { id: 'perle',      emoji: '🤍', label: 'Perle',       color: '#F0EAD6', promote_top: 4 },
  { id: 'obsidienne', emoji: '⬛', label: 'Obsidienne',  color: '#3D3D3D', promote_top: 4 },
  { id: 'diamant',    emoji: '💎', label: 'Diamant',     color: '#B9F2FF', promote_top: 0 },  // niveau max
]

export const RELEGATE_BOTTOM = 4  // les 4 derniers (places 17-20) descendent

export function tierMeta(tier: LeagueTier) {
  return LEAGUE_TIERS.find(t => t.id === tier) || LEAGUE_TIERS[0]
}

export function nextTier(tier: LeagueTier): LeagueTier | null {
  const i = LEAGUE_TIERS.findIndex(t => t.id === tier)
  return i >= 0 && i < LEAGUE_TIERS.length - 1 ? LEAGUE_TIERS[i + 1].id : null
}

export function prevTier(tier: LeagueTier): LeagueTier | null {
  const i = LEAGUE_TIERS.findIndex(t => t.id === tier)
  return i > 0 ? LEAGUE_TIERS[i - 1].id : null
}

/**
 * Calcule le multiplicateur de fidélité selon le respect de l'objectif perso.
 * - Si days_active >= target → +30%
 * - Si days_active > target → +50% (dépassement)
 * - Sinon ×1.0
 */
export function fidelityMultiplier(daysActive: number, weeklyTarget: number): number {
  if (daysActive > weeklyTarget) return 1.5
  if (daysActive >= weeklyTarget) return 1.3
  return 1.0
}
