/**
 * v3.24.1 — Badge Combo XP + hook useCombo()
 * - 5 réussites consécutives → bonus +20% XP sur la suivante
 * - 10 réussites → +50%
 * - Reset à la première erreur
 * - L'usage se fait côté client (state éphémère, pas de BDD)
 */
'use client'

import { useState, useCallback } from 'react'

export interface ComboState {
  combo: number
  multiplier: number       // 1.0, 1.2, 1.5
  bonusLabel: string | null  // "+20%" ou null
}

export function useCombo() {
  const [combo, setCombo] = useState(0)

  const onCorrect = useCallback(() => {
    setCombo(c => c + 1)
  }, [])

  const onWrong = useCallback(() => {
    setCombo(0)
  }, [])

  const reset = useCallback(() => {
    setCombo(0)
  }, [])

  // Le multiplier s'applique à la PROCHAINE bonne réponse
  // À combo=5 (5 réussies), la 6ème vaut x1.2
  // À combo=10, la 11ème vaut x1.5
  const multiplier = combo >= 10 ? 1.5 : combo >= 5 ? 1.2 : 1.0
  const bonusLabel = multiplier === 1.5 ? '+50%' : multiplier === 1.2 ? '+20%' : null

  return {
    combo,
    multiplier,
    bonusLabel,
    onCorrect,
    onWrong,
    reset,
  }
}

interface BadgeProps {
  combo: number
  bonusLabel: string | null
  className?: string
}

/** Affiché en haut de l'écran exos quand combo >= 3 */
export function ComboBadge({ combo, bonusLabel, className = '' }: BadgeProps) {
  if (combo < 3) return null

  const fire = combo >= 10 ? '🔥🔥🔥' : combo >= 5 ? '🔥🔥' : '🔥'
  const color = combo >= 10
    ? 'from-purple-500 to-pink-500'
    : combo >= 5
    ? 'from-orange-500 to-red-500'
    : 'from-amber-400 to-orange-500'

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r ${color} text-white text-xs font-extrabold shadow-md ${className}`}>
      <span className="text-sm">{fire}</span>
      <span>Combo ×{combo}</span>
      {bonusLabel && (
        <span className="ml-1 px-1.5 py-0.5 bg-white/30 rounded-full text-[10px]">{bonusLabel} XP</span>
      )}
    </div>
  )
}
