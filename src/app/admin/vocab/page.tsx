/**
 * v3.17 — Page admin pour gérer le vocabulaire DodoLingua.
 * Stats, import CSV, lancement enrichissement LLM.
 */
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'

export default function AdminVocabPage() {
  const [stats, setStats] = useState<any>(null)
  const [csv, setCsv] = useState('')
  const [sourceList, setSourceList] = useState('manual')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)
  const [enriching, setEnriching] = useState(false)
  const [enrichResult, setEnrichResult] = useState<any>(null)
  const [batchSize, setBatchSize] = useState(20)
  const [error, setError] = useState<string | null>(null)

  async function loadStats() {
    try {
      const supabase = createClient()
      const { data: byLevel } = await supabase
        .from('concepts').select('cefr_min, enrichment_status')
      const byLevelStats: Record<string, { total: number; pending: number; enriched: number }> = {}
      for (const c of (byLevel || [])) {
        const lvl = (c as any).cefr_min || 'A1'
        if (!byLevelStats[lvl]) byLevelStats[lvl] = { total: 0, pending: 0, enriched: 0 }
        byLevelStats[lvl].total++
        if ((c as any).enrichment_status === 'pending' || (c as any).enrichment_status === 'enriching') {
          byLevelStats[lvl].pending++
        } else if ((c as any).enrichment_status === 'enriched') {
          byLevelStats[lvl].enriched++
        }
      }
      setStats(byLevelStats)
    } catch (e: any) {
      setError(e.message)
    }
  }

  useEffect(() => { loadStats() }, [])

  async function handleImport() {
    if (!csv.trim()) return
    setImporting(true)
    setImportResult(null)
    try {
      const res = await fetch('/api/admin/vocab/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv, source_list: sourceList }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')
      setImportResult(data)
      await loadStats()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setImporting(false)
    }
  }

  async function handleEnrich() {
    setEnriching(true)
    setEnrichResult(null)
    try {
      const res = await fetch('/api/admin/vocab/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_size: batchSize }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')
      setEnrichResult(data)
      await loadStats()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setEnriching(false)
    }
  }

  const totalPending = stats ? Object.values(stats as any).reduce((s: number, v: any) => s + v.pending, 0) : 0
  const totalEnriched = stats ? Object.values(stats as any).reduce((s: number, v: any) => s + v.enriched, 0) : 0
  const totalAll = stats ? Object.values(stats as any).reduce((s: number, v: any) => s + v.total, 0) : 0

  return (
    <Container className="space-y-4 max-w-3xl pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-primary-900">📚 Admin — Vocabulaire</h1>
        <Link href="/admin" className="text-xs text-gray-500 underline">← Admin</Link>
      </div>

      <Card>
        <div className="font-bold mb-3">📊 Stats par niveau CEFR</div>
        {stats ? (
          <div className="space-y-2">
            <div className="text-sm text-gray-700 mb-2">
              Total : <b>{totalAll}</b> mots · <b className="text-emerald-700">{totalEnriched}</b> enrichis · <b className="text-amber-700">{totalPending}</b> en attente
            </div>
            <div className="grid grid-cols-6 gap-2">
              {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(lvl => {
                const s = (stats as any)[lvl] || { total: 0, pending: 0, enriched: 0 }
                return (
                  <div key={lvl} className="bg-gray-50 rounded-lg p-2 text-center">
                    <div className="text-xs font-bold text-primary-900">{lvl}</div>
                    <div className="text-lg font-extrabold">{s.total}</div>
                    {s.pending > 0 && <div className="text-[10px] text-amber-700">{s.pending} en attente</div>}
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500 italic">Chargement…</div>
        )}
      </Card>

      <Card>
        <div className="font-bold mb-3">⬆️ Importer une wordlist (CSV)</div>
        <div className="text-xs text-gray-600 mb-2">
          Format : <code>lemma,cefr_level[,rank][,source]</code> par ligne. Header facultatif. Ex :<br />
          <code className="block bg-gray-50 p-2 rounded mt-1 text-[11px]">
            lemma,cefr_level,rank,source<br />
            hello,A1,1,NGSL<br />
            goodbye,A1,2,NGSL<br />
            beautiful,A2,234,NGSL
          </code>
        </div>
        <div className="space-y-2">
          <input value={sourceList} onChange={e => setSourceList(e.target.value)}
            placeholder="Nom de la source (NGSL, Oxford, manual…)"
            className="w-full px-3 py-2 border border-rule rounded-lg text-sm" />
          <textarea value={csv} onChange={e => setCsv(e.target.value)}
            placeholder="Colle ton CSV ici…"
            rows={8}
            className="w-full px-3 py-2 border border-rule rounded-lg text-sm font-mono" />
          <Button onClick={handleImport} disabled={importing || !csv.trim()}>
            {importing ? '⏳ Import en cours…' : '⬆️ Importer'}
          </Button>
          {importResult && (
            <div className="text-xs bg-emerald-50 border border-emerald-200 rounded p-2 mt-2">
              ✅ {importResult.inserted} mots insérés · {importResult.skipped} déjà existants · {importResult.pending_enrichment} à enrichir
              {importResult.errors?.length > 0 && (
                <details className="mt-1">
                  <summary className="text-warn cursor-pointer">{importResult.errors.length} erreurs</summary>
                  <pre className="text-[10px] mt-1">{importResult.errors.join('\n')}</pre>
                </details>
              )}
            </div>
          )}
        </div>
      </Card>

      <Card>
        <div className="font-bold mb-3">🤖 Enrichir avec LLM (FR + IPA + exemple)</div>
        <div className="text-xs text-gray-600 mb-3">
          Pioche les mots <b>en attente</b> dans l'ordre de fréquence, demande à Groq de générer
          la traduction française, l'IPA et une phrase d'exemple. Mets à jour la BDD.<br />
          Recommandé : faire des batches de 20-30 mots, plusieurs fois (ne dépasse pas le quota Groq).
        </div>
        <div className="flex items-center gap-2 mb-2">
          <label className="text-xs font-semibold">Batch size :</label>
          <input type="number" min={1} max={30} value={batchSize}
            onChange={e => setBatchSize(parseInt(e.target.value, 10) || 20)}
            className="w-16 px-2 py-1 border border-rule rounded text-sm" />
          <Button onClick={handleEnrich} disabled={enriching || totalPending === 0}>
            {enriching ? '⏳ Enrichissement…' : `🤖 Enrichir ${Math.min(batchSize, totalPending)} mots`}
          </Button>
        </div>
        {enrichResult && (
          <div className="text-xs bg-emerald-50 border border-emerald-200 rounded p-2">
            ✅ {enrichResult.enriched} enrichis · {enrichResult.failed || 0} échecs
            {enrichResult.sample_word && <div className="mt-1">Premier mot : <b>{enrichResult.sample_word}</b></div>}
          </div>
        )}
        {totalPending === 0 && (
          <div className="text-xs text-gray-500 italic mt-2">Tous les mots sont enrichis 🎉</div>
        )}
      </Card>

      {error && <div className="text-xs text-warn p-2 bg-red-50 rounded">{error}</div>}
    </Container>
  )
}
