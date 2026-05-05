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
  const [autoLoop, setAutoLoop] = useState(false)
  const [autoLoopProgress, setAutoLoopProgress] = useState<{done: number; total: number; failed: number; lastWord: string} | null>(null)
  const stopAutoRef = useState({ stop: false })[0]
  const [error, setError] = useState<string | null>(null)

  async function loadStats() {
    try {
      const supabase = createClient()
      // Pagination pour contourner la limite Supabase de 1000 lignes
      const allRows: any[] = []
      let from = 0
      const pageSize = 1000
      while (true) {
        const { data: page, error } = await supabase
          .from('concepts')
          .select('cefr_min, enrichment_status, image_url')
          .range(from, from + pageSize - 1)
        if (error || !page || page.length === 0) break
        allRows.push(...page)
        if (page.length < pageSize) break
        from += pageSize
      }
      const byLevel = allRows
      const byLevelStats: Record<string, { total: number; pending: number; enriched: number; without_image: number }> = {}
      for (const c of (byLevel || [])) {
        const lvl = (c as any).cefr_min || 'A1'
        if (!byLevelStats[lvl]) byLevelStats[lvl] = { total: 0, pending: 0, enriched: 0, without_image: 0 }
        byLevelStats[lvl].total++
        if ((c as any).enrichment_status === 'pending' || (c as any).enrichment_status === 'enriching') {
          byLevelStats[lvl].pending++
        } else if ((c as any).enrichment_status === 'enriched') {
          byLevelStats[lvl].enriched++
        }
        if (!(c as any).image_url) byLevelStats[lvl].without_image++
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
    setError(null)
    try {
      // Découpage auto en chunks de 1000 lignes pour éviter timeout Vercel
      const lines = csv.split(/\r?\n/).filter(l => l.trim())
      const hasHeader = /^(lemma|word|term)/i.test(lines[0])
      const header = hasHeader ? lines[0] : 'lemma,cefr_level,frequency_rank,source_list'
      const dataLines = hasHeader ? lines.slice(1) : lines
      const CHUNK = 1000

      let totalInserted = 0, totalSkipped = 0, totalErrors: string[] = []
      const totalChunks = Math.ceil(dataLines.length / CHUNK)

      for (let i = 0; i < dataLines.length; i += CHUNK) {
        const chunkLines = dataLines.slice(i, i + CHUNK)
        const chunkCsv = header + '\n' + chunkLines.join('\n')
        const chunkNum = Math.floor(i / CHUNK) + 1
        setImportResult({ progress: `Chunk ${chunkNum}/${totalChunks}…`, inserted: totalInserted, skipped: totalSkipped })

        const res = await fetch('/api/admin/vocab/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csv: chunkCsv, source_list: sourceList }),
        })
        const data = await res.json()
        if (!res.ok) {
          totalErrors.push(`Chunk ${chunkNum}: ${data.error || 'erreur inconnue'}`)
          continue
        }
        totalInserted += data.inserted || 0
        totalSkipped += data.skipped || 0
        if (data.errors?.length) totalErrors.push(...data.errors)
      }

      setImportResult({
        inserted: totalInserted,
        skipped: totalSkipped,
        pending_enrichment: totalInserted,
        errors: totalErrors,
        total_chunks: totalChunks,
      })
      await loadStats()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setImporting(false)
    }
  }

  async function handleAutoEnrich() {
    if (totalPending === 0) return
    setAutoLoop(true)
    stopAutoRef.stop = false
    const startPending = totalPending
    let done = 0, failed = 0, lastWord = ''
    setAutoLoopProgress({ done: 0, total: startPending, failed: 0, lastWord: '' })

    try {
      // Boucle jusqu'à pending = 0 ou stop
      while (!stopAutoRef.stop) {
        const res = await fetch('/api/admin/vocab/enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batch_size: batchSize }),
        })
        const data = await res.json()
        if (!res.ok) {
          // Quota dépassé → pause 30s puis retry
          if (res.status === 503 || res.status === 429) {
            setAutoLoopProgress({ done, total: startPending, failed, lastWord: `⏸️ Pause 30s (quota)…` })
            await new Promise(r => setTimeout(r, 30000))
            continue
          }
          // Parse JSON cassé (500 retryable) → wait 5s puis retry (l'endpoint a déjà reset à pending)
          if (res.status === 500 && data.retryable) {
            setAutoLoopProgress({ done, total: startPending, failed, lastWord: `🔄 JSON Groq cassé, retry dans 5s…` })
            await new Promise(r => setTimeout(r, 5000))
            continue
          }
          // Autre erreur → log mais continue
          failed += batchSize
          setAutoLoopProgress({ done, total: startPending, failed, lastWord: `⚠️ Erreur batch : ${data.error || 'inconnue'}` })
          await new Promise(r => setTimeout(r, 3000))
          continue
        }
        if (data.enriched === 0 && data.message?.includes('no pending')) break
        done += data.enriched || 0
        failed += data.failed || 0
        lastWord = data.sample_word || lastWord
        setAutoLoopProgress({ done, total: startPending, failed, lastWord })
        // Délai 2s entre batches pour respecter quota Groq (~30 req/min)
        await new Promise(r => setTimeout(r, 2000))
      }
      await loadStats()
    } finally {
      setAutoLoop(false)
    }
  }

  function stopAutoLoop() {
    stopAutoRef.stop = true
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
  const totalWithoutImage = stats ? Object.values(stats as any).reduce((s: number, v: any) => s + (v.without_image || 0), 0) : 0

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
              Total : <b>{totalAll}</b> mots · <b className="text-emerald-700">{totalEnriched}</b> avec FR · <b className="text-amber-700">{totalPending}</b> sans FR · <b className="text-blue-700">📷 {totalWithoutImage}</b> sans image
            </div>
            <div className="grid grid-cols-6 gap-2">
              {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(lvl => {
                const s = (stats as any)[lvl] || { total: 0, pending: 0, enriched: 0 }
                return (
                  <div key={lvl} className="bg-gray-50 rounded-lg p-2 text-center">
                    <div className="text-xs font-bold text-primary-900">{lvl}</div>
                    <div className="text-lg font-extrabold">{s.total}</div>
                    {s.pending > 0 && <div className="text-[10px] text-amber-700">{s.pending} sans FR</div>}
                    {s.without_image > 0 && <div className="text-[10px] text-blue-700">📷 {s.without_image} sans image</div>}
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
            <div className={`text-xs rounded p-2 mt-2 border ${importResult.progress ? 'bg-blue-50 border-blue-200' : 'bg-emerald-50 border-emerald-200'}`}>
              {importResult.progress ? (
                <div>⏳ <b>{importResult.progress}</b> — {importResult.inserted} insérés · {importResult.skipped} déjà existants jusqu'ici</div>
              ) : (
                <div>✅ <b>{importResult.inserted}</b> mots insérés · {importResult.skipped} déjà existants · {importResult.pending_enrichment || 0} à enrichir{importResult.total_chunks ? ` (${importResult.total_chunks} chunks)` : ''}</div>
              )}
              {importResult.errors?.length > 0 && (
                <details className="mt-1">
                  <summary className="text-warn cursor-pointer">{importResult.errors.length} erreurs</summary>
                  <pre className="text-[10px] mt-1 max-h-40 overflow-auto">{importResult.errors.join('\n')}</pre>
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
          <Button onClick={handleEnrich} disabled={enriching || autoLoop || totalPending === 0}>
            {enriching ? '⏳ Enrichissement…' : `🤖 Enrichir ${Math.min(batchSize, totalPending)} mots`}
          </Button>
        </div>

        {/* Auto-loop : enrichir tout automatiquement */}
        <div className="border-t border-rule pt-3 mt-3">
          <div className="text-xs text-gray-600 mb-2">
            <b>Auto-loop</b> : enrichit tous les mots pending automatiquement, par batches de {batchSize}, avec délai 2s entre appels (respecte quota Groq).
          </div>
          {!autoLoop ? (
            <Button onClick={handleAutoEnrich} disabled={enriching || totalPending === 0} variant="primary">
              ⚡ Enrichir TOUT en automatique ({totalPending} mots)
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs">
                {autoLoopProgress && (
                  <>
                    <div className="font-bold">⏳ Auto-loop en cours…</div>
                    <div>Enrichis : <b className="text-emerald-700">{autoLoopProgress.done}</b> / {autoLoopProgress.total}</div>
                    {autoLoopProgress.failed > 0 && <div className="text-warn">Échecs : {autoLoopProgress.failed}</div>}
                    {autoLoopProgress.lastWord && <div className="opacity-70">Dernier : <code>{autoLoopProgress.lastWord}</code></div>}
                    <div className="mt-1 h-2 bg-gray-200 rounded overflow-hidden">
                      <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, (autoLoopProgress.done / autoLoopProgress.total) * 100)}%` }}></div>
                    </div>
                    <div className="text-[10px] mt-1">~{Math.ceil((autoLoopProgress.total - autoLoopProgress.done) / batchSize * 2 / 60)} min restantes</div>
                  </>
                )}
              </div>
              <Button onClick={stopAutoLoop} variant="ghost">⛔ Arrêter l'auto-loop</Button>
            </div>
          )}
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
