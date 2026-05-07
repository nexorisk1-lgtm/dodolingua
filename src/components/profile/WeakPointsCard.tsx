/**
 * v3.24.1 — Carte "Tes 3 points faibles" sur /profile
 * Affiche jusqu'à 3 mots vocab fragiles + 3 topics grammaire à retravailler
 * Liens directs : vocab → /revision, grammar → /grammar/{id}
 */
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface WeakVocab {
  concept_id: string
  lemma: string
  gloss_fr: string | null
}

interface WeakGrammar {
  topic_id: string
  title_fr: string
  level: string
  emoji: string
  success_rate: number
  attempts: number
}

export function WeakPointsCard() {
  const [data, setData] = useState<{ vocab: WeakVocab[]; grammar: WeakGrammar[] } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/weak-points')
      .then(r => r.json())
      .then(d => setData({ vocab: d.vocab || [], grammar: d.grammar || [] }))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-rule p-4 text-xs text-gray-500 italic text-center">
        Analyse de tes points faibles…
      </div>
    )
  }

  const empty = !data || (data.vocab.length === 0 && data.grammar.length === 0)

  return (
    <section className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl border-2 border-orange-200 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="text-2xl">🎯</div>
        <h2 className="text-base font-extrabold text-orange-900">À retravailler</h2>
      </div>

      {empty && (
        <div className="text-center py-4">
          <div className="text-3xl mb-2 opacity-40">✨</div>
          <p className="text-xs text-orange-900 font-medium">Pas encore de points faibles repérés.</p>
          <p className="text-[11px] text-orange-700 mt-1">Continue à pratiquer, je suivrai tes erreurs pour t'aider à progresser.</p>
        </div>
      )}

      {data && data.vocab.length > 0 && (
        <div className="mb-3">
          <h3 className="text-xs font-bold text-orange-700 mb-2">📚 Vocabulaire fragile</h3>
          <div className="space-y-1.5">
            {data.vocab.map(v => (
              <Link
                key={v.concept_id}
                href={"/revision" as any}
                className="flex items-center gap-2 bg-white rounded-lg p-2 hover:shadow-sm border border-orange-100"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-primary-900 truncate">{v.lemma}</div>
                  {v.gloss_fr && <div className="text-[11px] text-gray-600 truncate">{v.gloss_fr}</div>}
                </div>
                <div className="text-[10px] text-orange-700 font-bold shrink-0">À revoir</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {data && data.grammar.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-orange-700 mb-2">📘 Grammaire à consolider</h3>
          <div className="space-y-1.5">
            {data.grammar.map(g => (
              <Link
                key={g.topic_id}
                href={`/grammar/${g.topic_id}` as any}
                className="flex items-center gap-2 bg-white rounded-lg p-2 hover:shadow-sm border border-orange-100"
              >
                <div className="text-xl shrink-0">{g.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-primary-900 truncate">{g.title_fr}</div>
                  <div className="text-[11px] text-gray-600">{g.level} · réussite {g.success_rate}%</div>
                </div>
                <div className="text-[10px] text-orange-700 font-bold shrink-0">→</div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
