/**
 * v3.6 — Page de révision des corrections coach.
 * Affiche les corrections dues (next_review <= now), une à la fois,
 * avec 3 boutons FSRS : Je savais / J'ai hésité / Je ne savais pas.
 */
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface CorrectionItem {
  id: string
  original_text: string
  corrected_text: string
  corrected_fr: string | null  // v3.8.1
  reason: string | null
  source_mode: string
  next_review: string
  lapses: number
  consec_correct: number
  created_at: string
}

export default function CorrectionsPage() {
  const [items, setItems] = useState<CorrectionItem[]>([])
  const [counts, setCounts] = useState<{ due: number; total: number }>({ due: 0, total: 0 })
  const [idx, setIdx] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [loading, setLoading] = useState(true)
  const [grading, setGrading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/corrections/due')
      const txt = await res.text()
      let data: any = {}
      if (txt) { try { data = JSON.parse(txt) } catch {} }
      if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`)
      setItems(data.items || [])
      setCounts(data.counts || { due: 0, total: 0 })
      setIdx(0)
      setShowAnswer(false)
    } catch (e: any) {
      setError(e.message || 'Erreur réseau')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  async function grade(button: 'savais' | 'hesite' | 'pas_su') {
    const cur = items[idx]
    if (!cur || grading) return
    setGrading(true)
    try {
      const res = await fetch('/api/corrections/grade', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cur.id, button }),
      })
      // v3.8.1 — parse safe : on lit text() puis on tente JSON pour éviter
      // 'Unexpected end of JSON input' quand la réponse est vide.
      const txt = await res.text()
      let data: any = {}
      if (txt) { try { data = JSON.parse(txt) } catch {} }
      if (!res.ok) {
        throw new Error(data.error || `Erreur ${res.status}`)
      }
      // Avance à la suivante
      setShowAnswer(false)
      if (idx + 1 < items.length) {
        setIdx(idx + 1)
      } else {
        await load()
      }
    } catch (e: any) {
      setError(e.message || 'Erreur réseau')
    } finally {
      setGrading(false)
    }
  }

  const current = items[idx]

  return (
    <Container className="max-w-2xl space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-primary-900">📝 Révision des corrections</h1>
          <div className="text-xs text-gray-500">
            {counts.due} à revoir · {counts.total} au total
          </div>
        </div>
        <Link href="/dashboard" className="text-xs text-gray-500 underline">← Dashboard</Link>
      </div>

      {loading && (
        <Card className="!p-6 text-center text-sm text-gray-500 italic">Chargement…</Card>
      )}

      {!loading && error && (
        <Card className="!p-4 text-sm text-warn">{error}</Card>
      )}

      {!loading && !error && items.length === 0 && (
        <Card className="!p-8 text-center space-y-3">
          <div className="text-5xl">🎉</div>
          <div className="text-lg font-bold text-primary-900">Tout est à jour !</div>
          <div className="text-sm text-gray-600">
            Aucune correction à revoir maintenant.
            {counts.total > 0 && <> Tu as {counts.total} correction{counts.total > 1 ? 's' : ''} archivée{counts.total > 1 ? 's' : ''} pour des révisions futures.</>}
          </div>
          <div className="text-xs text-gray-500 italic pt-2">
            Astuce : utilise le mode 🎓 Tuteur dans le coach et clique sur 💡 sur tes phrases pour générer de nouvelles corrections.
          </div>
          <Link href="/coach"><Button size="sm">Aller au coach</Button></Link>
        </Card>
      )}

      {!loading && !error && current && (
        <Card className="!p-5 space-y-4">
          <div className="flex items-center justify-between text-[11px] text-gray-500">
            <span>{idx + 1} / {items.length}</span>
            <span>Source : {current.source_mode}</span>
          </div>

          <div>
            <div className="text-[10px] uppercase font-bold text-gray-500 mb-1">Ta phrase initiale</div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm">
              {current.original_text}
            </div>
          </div>

          {!showAnswer ? (
            <button onClick={() => setShowAnswer(true)}
              className="w-full py-3 rounded-xl bg-primary-700 text-white font-semibold text-sm hover:bg-primary-900">
              Voir la correction
            </button>
          ) : (
            <>
              <div>
                <div className="text-[10px] uppercase font-bold text-emerald-700 mb-1">Correction</div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm font-bold text-emerald-900">
                  {current.corrected_text}
                </div>
                {current.corrected_fr && (
                  <div className="mt-2 bg-purple-50 border border-purple-200 rounded-lg p-2.5 text-sm text-purple-900">
                    <span className="text-[10px] uppercase font-bold text-purple-700 mr-2">🇫🇷 Traduction</span>
                    <span className="italic">{current.corrected_fr}</span>
                  </div>
                )}
                {current.reason && (
                  <div className="mt-2 text-xs italic text-gray-600">📖 {current.reason}</div>
                )}
              </div>

              <div>
                <div className="text-[10px] uppercase font-bold text-gray-500 mb-1">Comment tu te débrouilles ?</div>
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => grade('pas_su')} disabled={grading}
                    className="p-3 rounded-xl bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50 text-xs font-bold">
                    😖 Je ne savais pas
                  </button>
                  <button onClick={() => grade('hesite')} disabled={grading}
                    className="p-3 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50 text-xs font-bold">
                    🤔 J&apos;ai hésité
                  </button>
                  <button onClick={() => grade('savais')} disabled={grading}
                    className="p-3 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 text-xs font-bold">
                    ✅ Je savais
                  </button>
                </div>
              </div>
            </>
          )}
        </Card>
      )}
    </Container>
  )
}
