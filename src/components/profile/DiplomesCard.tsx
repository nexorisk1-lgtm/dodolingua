/**
 * v3.23.3 — Carte "Diplômes obtenus" (haut de /profile).
 * - Liste les niveaux validés via /api/certificate
 * - Click → ouvre le PDF dans un nouvel onglet
 * - Empty state : encouragement + CTA parcours
 */
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { cefrFull } from '@/lib/cefr_labels'

interface Cert {
  level: string
  mention: 'Passable' | 'Bien' | 'Très Bien' | 'Excellent'
  score: number
  issued_at: string
  serial: string
}

const MENTION_COLOR: Record<Cert['mention'], string> = {
  Passable: 'text-gray-700 bg-gray-100',
  Bien: 'text-blue-700 bg-blue-100',
  'Très Bien': 'text-purple-700 bg-purple-100',
  Excellent: 'text-amber-700 bg-amber-100',
}

export function DiplomesCard() {
  const [certs, setCerts] = useState<Cert[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/certificate')
      .then(r => r.json())
      .then(d => setCerts(d.certificates || []))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-rule p-4 text-xs text-gray-500 italic text-center">
        Chargement des diplômes…
      </div>
    )
  }

  return (
    <section className="bg-gradient-to-br from-amber-50 to-yellow-100 rounded-2xl border-2 border-amber-200 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="text-2xl">🎓</div>
        <h2 className="text-base font-extrabold text-amber-900">Diplômes obtenus</h2>
        <div className="ml-auto text-[11px] font-bold text-amber-700 bg-white/70 px-2 py-0.5 rounded-full">
          {certs?.length || 0}
        </div>
      </div>

      {(!certs || certs.length === 0) && (
        <div className="text-center py-4">
          <div className="text-4xl mb-2 opacity-40">🎓</div>
          <p className="text-xs text-amber-900 font-medium">Aucun diplôme pour l'instant.</p>
          <p className="text-[11px] text-amber-700 mt-1">
            Termine ton parcours et passe le test final pour décrocher ton premier certificat&nbsp;!
          </p>
          <Link
            href="/parcours"
            className="mt-3 inline-block px-4 py-1.5 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600"
          >
            Aller au parcours →
          </Link>
        </div>
      )}

      {certs && certs.length > 0 && (
        <div className="space-y-2">
          {certs.map(c => (
            <a
              key={c.level}
              href={`/api/certificate?level=${c.level}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-white rounded-xl p-3 hover:shadow-md transition border border-amber-100"
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-200 to-amber-400 flex items-center justify-center text-2xl shadow-inner">
                🎓
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-extrabold text-amber-900">Niveau {c.level}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${MENTION_COLOR[c.mention]}`}>
                    {c.mention}
                  </span>
                </div>
                <div className="text-[11px] text-gray-600 truncate">
                  {cefrFull(c.level)} · {Math.round(c.score)}/100
                </div>
                <div className="text-[10px] text-gray-400">
                  Délivré le {new Date(c.issued_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              </div>
              <div className="text-amber-600 text-lg shrink-0">📄</div>
            </a>
          ))}
        </div>
      )}
    </section>
  )
}
