import type { LeagueTier } from '@/types/database'

export const LEAGUE_TIERS: { id: LeagueTier; emoji: string; label: string; color: string; promote_min?: number }[] = [
  { id: 'bronze',     emoji: '🥉', label: 'Bronze',      color: '#CD7F32', promote_min: 100 },
  { id: 'argent',     emoji: '🥈', label: 'Argent',      color: '#C0C0C0', promote_min: 200 },
  { id: 'or',         emoji: '🥇', label: 'Or',          color: '#FFD700', promote_min: 350 },
  { id: 'saphir',     emoji: '💎', label: 'Saphir',      color: '#0F52BA', promote_min: 500 },
  { id: 'emeraude',   emoji: '🟢', label: 'Émeraude',    color: '#50C878', promote_min: 700 },
  { id: 'obsidienne', emoji: '⬛', label: 'Obsidienne',  color: '#3D3D3D' },
]

export function tierMeta(tier: LeagueTier) {
  return LEAGUE_TIERS.find(t => t.id === tier) || LEAGUE_TIERS[0]
}

export function nextTier(tier: LeagueTier): LeagueTier | null {
  const i = LEAGUE_TIERS.findIndex(t => t.id === tier)
  return i >= 0 && i < LEAGUE_TIERS.length - 1 ? LEAGUE_TIERS[i + 1].id : null
}
