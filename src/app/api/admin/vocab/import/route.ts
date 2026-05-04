/**
 * v3.18 — Import vocabulaire CSV avec support format "rich".
 *
 * Format minimal : lemma,cefr_level[,frequency_rank][,source_list]
 * Format rich :   lemma,cefr_level,ipa,def_en[,source_list]
 *
 * Détection auto du format via le header (présence de "ipa" ou "def_en").
 * Si format rich : enrichment_status='enriched' direct (pas besoin Groq pour FR/IPA).
 * Si format minimal : enrichment_status='pending', à enrichir via /api/admin/vocab/enrich.
 *
 * Anti-doublon : check translations.lemma case-insensitive (lower(lemma)).
 * Idempotent : skip silencieux les mots déjà présents.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const VALID_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

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

  // Header obligatoire pour le mode "rich" (sinon pas moyen de savoir l'ordre des colonnes)
  let headers: string[] = []
  let dataLines = lines
  if (/^(lemma|word|term)\b/i.test(lines[0])) {
    headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    dataLines = lines.slice(1)
  } else {
    headers = ['lemma', 'cefr_level', 'frequency_rank', 'source_list']
  }

  const idx = (name: string) => headers.indexOf(name)
  const idxLemma = idx('lemma') >= 0 ? idx('lemma') : 0
  const idxCefr = idx('cefr_level') >= 0 ? idx('cefr_level') : 1
  const idxRank = idx('frequency_rank')
  const idxSource = idx('source_list')
  const idxIpa = idx('ipa')
  const idxDef = idx('def_en') >= 0 ? idx('def_en') : idx('definition_en')
  const isRich = idxIpa >= 0 || idxDef >= 0

  const items: ImportItem[] = []
  for (const line of dataLines) {
    // CSV simple : split sur virgule (les définitions peuvent contenir des virgules,
    // mais Langeek a déjà été nettoyé côté script Python pour limiter à 200 chars)
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
    return NextResponse.json({
      error: 'no valid rows', expected: 'lemma,cefr_level[,...]',
    }, { status: 400 })
  }

  // Anti-doublon batch (case-insensitive natif via .in() PostgreSQL)
  const lemmas = items.map(i => i.lemma)
  const { data: existing } = await supabase
    .from('translations')
    .select('lemma')
    .eq('lang_code', 'en-GB')
    .in('lemma', lemmas)
  const existingSet = new Set((existing || []).map((r: any) => r.lemma.toLowerCase()))

  const toInsert = items.filter(i => !existingSet.has(i.lemma))
  let inserted = 0
  const skipped = items.length - toInsert.length
  const errors: string[] = []

  for (const item of toInsert) {
    try {
      const conceptInsert: any = {
        cefr_min: item.cefr,
        source_list: item.source,
        frequency_rank: item.rank,
        domain: 'general',
        gloss_fr: null,
        enrichment_status: 'pending', // par défaut, FR manquant
      }
      const { data: c, error: ce } = await supabase
        .from('concepts').insert(conceptInsert).select('id').single()
      if (ce || !c) { errors.push(`${item.lemma}: ${ce?.message || 'concept'}`); continue }

      const transInsert: any = {
        concept_id: c.id,
        lang_code: 'en-GB',
        lemma: item.lemma,
      }
      if (item.ipa) transInsert.ipa = item.ipa
      const { error: te } = await supabase.from('translations').insert(transInsert)
      if (te) { errors.push(`${item.lemma}: ${te.message}`); continue }

      // Si def_en fournie, on la stocke côté concept (champ definition_en si dispo, sinon notes)
      if (item.def_en) {
        await supabase.from('concepts').update({ definition_en: item.def_en }).eq('id', c.id)
      }

      inserted++
    } catch (e: any) {
      errors.push(`${item.lemma}: ${e.message?.slice(0, 100)}`)
    }
  }

  return NextResponse.json({
    inserted,
    skipped,
    total_input: items.length,
    pending_enrichment: inserted, // tous les nouveaux sont pending (FR manquant)
    rich_format: isRich,
    errors: errors.slice(0, 10),
    note: isRich
      ? `Format rich détecté : IPA + def_en stockés. Reste à générer la traduction FR via /api/admin/vocab/enrich.`
      : `Format minimal : il faudra enrichir FR + IPA + exemple via /api/admin/vocab/enrich.`,
  })
}

/** Parse une ligne CSV en respectant les guillemets (pour def_en pouvant contenir des virgules). */
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
