/**
 * v3.22.4 — Accordéon global sur le bloc quêtes du jour.
 * Replié par défaut. Click sur le header → ouvre / ferme.
 */
'use client'

import { useState, ReactNode } from 'react'
import { Mascot } from '@/components/Mascot'

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
        className="w-full flex items-center gap-3 mb-2 cursor-pointer hover:opacity-90 transition bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-3 shadow-sm"
      >
        <div className="shrink-0">
          <Mascot
            pose={completedCount === totalCount ? 'champion' : 'happy'}
            size={48}
            animation={open ? 'breathe' : 'bounce'}
          />
        </div>
        <div className="flex-1 text-left">
          <div className="text-xs uppercase font-bold text-amber-700">{open ? '▼ Réduire' : '▶ Déplier'}</div>
          <div className="text-sm font-bold text-gray-900">
            {completedCount === totalCount && totalCount > 0
              ? `Toutes les quêtes faites ! Bravo 🎉`
              : `Clique ici pour faire ta quête du jour (${completedCount}/${totalCount})`}
          </div>
        </div>
        {completedCount === totalCount && totalCount > 0 && (
          <span className="text-xl">✨</span>
        )}
      </button>
      {open && <div className="space-y-2">{children}</div>}
    </div>
  )
}
