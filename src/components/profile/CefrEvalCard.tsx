/**
 * v3.10 — Carte d'évaluation CEFR : déclaré vs estimé IA + bouton "Re-évaluer".
 * Le bouton récupère les threads coach récents et appelle /api/cefr/evaluate.
 */
'use client'

import { useState } from 'react'
import { cefrFull } from '@/lib/cefr_labels'
import { createClient } from '@/lib/supabase/client'

interface Props {
  declared: string
  estimated: string | null
  estimatedAt: string | null
  breakdown: any
}

export function CefrEvalCard({ declared, estimated, estimatedAt, breakdown }: Props) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  async function evaluate() {
    setLoading(true)
    setError(null)
    try {
      // Fetch all recent coach messages to evaluate
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('non auth')
      const { data: threads } = await supabase
        .from('coach_threads')
        .select('messages')
        .eq('user_id', user.id)

      // Aggregate user messages from all modes
      const allMessages: any[] = []
      for (const t of (threads || [])) {
        const ms = (t as any).messages || []
        for (const m of ms) if (m.role === 'user') allMessages.push(m)
      }
      // Take last 30
      const recent = allMessages.slice(-30)

      if (recent.length < 3) {
        setError('Tu dois d\'abord avoir au moins 3 conversations avec le coach pour être évalué.')
        setLoading(false)
        return
      }

      const res = await fetch('/api/cefr/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: recent }),
      })
      const txt = await res.text()
      let data: any = {}
      if (txt) { try { data = JSON.parse(txt) } catch {} }
      if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`)
      setResult(data)
    } catch (e: any) {
      setError(e.message || 'Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  const display = result?.cefr || estimated
  const displayBreakdown = result?.breakdown || breakdown
  const summary = result?.summary

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-[10px] uppercase font-bold text-gray-500">Déclaré (onboarding)</div>
          <div className="text-base font-extrabold text-gray-700 leading-tight">{cefrFull(declared)}</div>
        </div>
        <div className={`rounded-lg p-3 text-center ${display ? 'bg-emerald-50' : 'bg-gray-50'}`}>
          <div className="text-[10px] uppercase font-bold text-emerald-700">Estimé par l'IA</div>
          <div className="text-base font-extrabold text-emerald-700 leading-tight">{display ? cefrFull(display) : '—'}</div>
        </div>
      </div>

      {displayBreakdown && (
        <div className="bg-white border border-rule rounded-lg p-3">
          <div className="text-[10px] uppercase font-bold text-gray-500 mb-2">Détail (1-6)</div>
          <div className="space-y-1.5">
            {Object.entries(displayBreakdown).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2">
                <div className="text-xs font-semibold capitalize w-24">{k}</div>
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${(Number(v) / 6) * 100}%` }} />
                </div>
                <div className="text-xs font-bold text-emerald-700 w-6 text-right">{Number(v)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-[12px] text-blue-900 italic">
          {summary}
        </div>
      )}

      {error && <div className="text-xs text-warn">{error}</div>}

      {estimatedAt && !result && (
        <div className="text-[10px] text-gray-500 italic">
          Dernière évaluation : {new Date(estimatedAt).toLocaleString('fr-FR')}
        </div>
      )}

      <button onClick={evaluate} disabled={loading}
        className="w-full px-4 py-2 rounded-lg bg-primary-700 text-white font-semibold text-sm disabled:opacity-50">
        {loading ? '⏳ Évaluation en cours…' : '📊 Évaluer mon niveau CEFR'}
      </button>
      <div className="text-[10px] text-gray-500 italic">
        Basé sur tes 30 derniers messages au coach. Pour une évaluation fiable, parle avec Dodo régulièrement.
      </div>
    </div>
  )
}
