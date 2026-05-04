/**
 * v3.19 — Import vocabulaire CSV avec BULK INSERT (rapide).
 *
 * Format minimal : lemma,cefr_level[,frequency_rank][,source_list]
 * Format rich :   lemma,cefr_level,ipa,def_en[,source_list]
 *
 * BULK INSERT : un seul appel SQL pour toute la liste, au lieu d'un par mot.
 * Performance : ~500 mots/seconde (vs 5 mots/seconde en séquentiel).
 *
 * IMPORTANT : taille max recommandée 1000 lignes par appel pour rester
 * sous le timeout Vercel free (10s). Le client doit chunker au-dessus.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const VALID_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const MAX_PER_REQUEST = 1500

interface ImportItem {
  lemma: string
  cefr: string
  rank: number | null
  source: string
  ipa?: string
  def_en?: string
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'admin required' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const csv = String(body.csv || '').trim()
  const defaultSource = String(body.source_list || 'manual')
  if (!csv) return NextResponse.json({ error: 'csv required' }, { status: 400 })

  const lines = csv.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0)
  if (lines.length === 0) return NextResponse.json({ error: 'empty csv' }, { status: 400 })

  let headers: string[] = []
  let dataLines = lines
  if (/^(lemma|word|term)\b/i.test(lines[0])) {
    headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    dataLines = lines.slice(1)
  } else {
    headers = ['lemma', 'cefr_level', 'frequency_rank', 'source_list']
  }

  if (dataLines.length > MAX_PER_REQUEST) {
    return NextResponse.json({
      error: `Trop de lignes (${dataLines.length}). Max ${MAX_PER_REQUEST} par appel pour éviter timeout. Découpe ton CSV.`,
      max_per_request: MAX_PER_REQUEST,
    }, { status: 413 })
  }

  const idx = (name: string) => headers.indexOf(name)
  const idxLemma = idx('lemma') >= 0 ? idx('lemma') : 0
  const idxCefr = idx('cefr_level') >= 0 ? idx('cefr_level') : 1
  const idxRank = idx('frequency_rank')
  const idxSource = idx('source_list')
  const idxIpa = idx('ipa')
  const idxDef = idx('def_en') >= 0 ? idx('def_en') : idx('definition_en')

  const items: ImportItem[] = []
  for (const line of dataLines) {
    const cols = parseCsvLine(line)
    const lemma = (cols[idxLemma] || '').toLowerCase().trim()
    const cefr = (cols[idxCefr] || 'A1').toUpperCase().trim()
    const rank = idxRank >= 0 && cols[idxRank] ? parseInt(cols[idxRank], 10) || null : null
    const source = (idxSource >= 0 && cols[idxSource]) || defaultSource
    const ipa = idxIpa >= 0 ? (cols[idxIpa] || '').trim() : undefined
    const def_en = idxDef >= 0 ? (cols[idxDef] || '').trim() : undefined
    if (!lemma || !VALID_LEVELS.includes(cefr)) continue
    items.push({ lemma, cefr, rank, source, ipa, def_en })
  }

  if (items.length === 0) {
    return NextResponse.json({ error: 'no valid rows' }, { status: 400 })
  }

  // ANTI-DOUBLON : récupère les lemmas déjà existants
  const lemmas = items.map(i => i.lemma)
  const { data: existing } = await supabase
    .from('translations').select('lemma').eq('lang_code', 'en-GB').in('lemma', lemmas)
  const existingSet = new Set((existing || []).map((r: any) => r.lemma.toLowerCase()))
  const toInsert = items.filter(i => !existingSet.has(i.lemma))

  if (toInsert.length === 0) {
    return NextResponse.json({
      inserted: 0, skipped: items.length, total_input: items.length,
      pending_enrichment: 0, errors: [],
    })
  }

  // BULK INSERT concepts (avec definition_en si rich)
  const conceptRows = toInsert.map(item => ({
    cefr_min: item.cefr,
    source_list: item.source,
    frequency_rank: item.rank,
    domain: 'general',
    gloss_fr: null,
    enrichment_status: 'pending',
    definition_en: item.def_en || null,
  }))

  const { data: insertedConcepts, error: ce } = await supabase
    .from('concepts').insert(conceptRows).select('id')

  if (ce || !insertedConcepts) {
    return NextResponse.json({
      error: `Bulk insert concepts failed: ${ce?.message || 'unknown'}`,
      inserted: 0, skipped: items.length - toInsert.length,
    }, { status: 500 })
  }

  // BULK INSERT translations (1 par concept inséré, dans le même ordre)
  const transRows = insertedConcepts.map((c: any, idx: number) => ({
    concept_id: c.id,
    lang_code: 'en-GB',
    lemma: toInsert[idx].lemma,
    ipa: toInsert[idx].ipa || null,
  }))

  const { error: te } = await supabase.from('translations').insert(transRows)
  if (te) {
    return NextResponse.json({
      error: `Bulk insert translations failed: ${te.message}`,
      inserted: 0,
    }, { status: 500 })
  }

  return NextResponse.json({
    inserted: toInsert.length,
    skipped: items.length - toInsert.length,
    total_input: items.length,
    pending_enrichment: toInsert.length,
    errors: [],
  })
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (c === '"') inQuotes = false
      else cur += c
    } else {
      if (c === ',') { out.push(cur); cur = '' }
      else if (c === '"') inQuotes = true
      else cur += c
    }
  }
  out.push(cur)
  return out.map(s => s.trim())
}
