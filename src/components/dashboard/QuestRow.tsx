/**
 * v3.22.3 — Ligne de quête repliable / dépliable (accordéon).
 * Par défaut compacte (icône + titre + reward). Au click → étend (description + barre).
 */
'use client'

import Link from 'next/link'
import { useState } from 'react'

interface Props {
  href: string
  emoji: string
  title: string
  description: string
  reward: string
  unit: string
  current: number
  target: number
  done: boolean
  inProgress: boolean
  earnedText?: string | null
}

export function QuestRow({ href, emoji, title, description, reward, unit, current, target, done, inProgress, earnedText }: Props) {
  const [open, setOpen] = useState(false)
  const progressPct = Math.round((current / Math.max(1, target)) * 100)

  return (
    <div
      className={`rounded-xl border transition cursor-pointer ${
        done ? 'bg-green-50 border-green-200' :
        inProgress ? 'bg-amber-50 border-amber-200' :
        'bg-white border-rule hover:border-primary-300'
      }`}
    >
      {/* Ligne compacte : toujours visible, click pour ouvrir */}
      <div onClick={() => setOpen(o => !o)} className="p-3 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${
          done ? 'bg-ok text-white' : 'bg-primary-50'
        }`}>
          {done ? '✓' : emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="font-bold text-sm text-primary-900">{title}</div>
            <div className="text-[11px] font-bold whitespace-nowrap">
              {done ? <span className="text-ok">{earnedText || '✨'}</span> : <span className="text-primary-700">{reward}</span>}
            </div>
          </div>
          {/* Mini barre de progression toujours visible */}
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
              <div className={`h-full ${done ? 'bg-ok' : progressPct > 0 ? 'bg-primary-500' : 'bg-gray-200'}`} style={{ width: `${progressPct}%` }} />
            </div>
            <span className={`text-[10px] whitespace-nowrap ${done ? 'text-ok font-bold' : 'text-gray-500'}`}>
              {current}/{target}
            </span>
          </div>
        </div>
        <div className="text-gray-400 text-xs ml-1">{open ? '▲' : '▼'}</div>
      </div>

      {/* Bloc déplié */}
      {open && (
        <div className="px-3 pb-3 pt-0 border-t border-rule/50">
          <div className="text-xs text-gray-700 mt-2">{description}</div>
          <Link href={href as any} onClick={e => e.stopPropagation()}>
            <span className="mt-2 inline-block px-3 py-1.5 bg-primary-700 text-white text-xs font-bold rounded-lg hover:bg-primary-900">
              {done ? 'Refaire' : inProgress ? 'Continuer →' : 'Démarrer →'}
            </span>
          </Link>
        </div>
      )}
    </div>
  )
}
