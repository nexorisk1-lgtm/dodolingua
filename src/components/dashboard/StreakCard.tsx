/**
 * v3.24.1 — Carte streak compact pour le dashboard.
 * Affiche : 🔥 X jours · 🛡️ Y protection(s)
 * Si freeze utilisé aujourd'hui → toast bref "Ta protection a sauvé ton streak !"
 */
'use client'

import { useEffect, useState } from 'react'

export function StreakCard() {
  const [data, setData] = useState<{ streak_count: number; tokens: number; freezeUsed: boolean } | null>(null)

  useEffect(() => {
    fetch('/api/streak')
      .then(r => r.json())
      .then(d => setData({
        streak_count: d.streak_count || 0,
        tokens: d.streak_freeze_tokens || 0,
        freezeUsed: d.freeze_used || false,
      }))
      .catch(() => setData({ streak_count: 0, tokens: 0, freezeUsed: false }))
  }, [])

  if (!data) return null
  if (data.streak_count === 0 && data.tokens === 0) return null

  return (
    <div className="flex items-center gap-3 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl px-3 py-2">
      <div className="flex items-center gap-1">
        <span className="text-xl">🔥</span>
        <span className="font-extrabold text-orange-900 text-base">{data.streak_count}</span>
        <span className="text-xs text-orange-700">jour{data.streak_count > 1 ? 's' : ''}</span>
      </div>
      {data.tokens > 0 && (
        <div className="flex items-center gap-1 ml-auto" title="Protections de streak (offertes chaque lundi)">
          <span className="text-base">🛡️</span>
          <span className="text-xs font-bold text-orange-800">×{data.tokens}</span>
        </div>
      )}
      {data.freezeUsed && (
        <div className="text-[10px] text-orange-700 italic ml-2 hidden md:block">protection utilisée</div>
      )}
    </div>
  )
}
