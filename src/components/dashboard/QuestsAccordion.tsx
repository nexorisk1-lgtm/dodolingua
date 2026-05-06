/**
 * v3.22.4 — Accordéon global sur le bloc quêtes du jour.
 * Replié par défaut. Click sur le header → ouvre / ferme.
 */
'use client'

import { useState, ReactNode } from 'react'

interface Props {
  children: ReactNode
  completedCount: number
  totalCount: number
}

export function QuestsAccordion({ children, completedCount, totalCount }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-baseline justify-between mb-2 cursor-pointer hover:opacity-80 transition"
      >
        <h2 className="text-xs uppercase font-bold text-gray-500 flex items-center gap-2">
          <span className="text-base text-gray-700">{open ? '▼' : '▶'}</span>
          {completedCount === totalCount && totalCount > 0
            ? `🎉 Toutes les quêtes faites ! Bravo ✨`
            : `👉 Clique ici pour faire ta quête du jour (${completedCount}/${totalCount})`}
        </h2>
        {completedCount === totalCount && totalCount > 0 && (
          <span className="text-xs font-bold text-ok">⭐</span>
        )}
      </button>
      {open && <div className="space-y-2">{children}</div>}
    </div>
  )
}
