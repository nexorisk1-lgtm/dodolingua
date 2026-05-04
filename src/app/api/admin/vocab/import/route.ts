/**
 * v3.17 — Import manuel de vocabulaire via CSV.
 * Format attendu : lemma,cefr_level[,frequency_rank][,source_list]
 * Header optionnel détecté automatiquement.
 *
 * Insère uniquement les concepts (lemma + cefr_min + frequency_rank + source_list).
 * Le mot reste avec enrichment_status='pending' tant qu'il n'a pas été enrichi
 * (FR + IPA + example) via /api/admin/vocab/enrich.
 *
 * Idempotent : skip si translation EN avec lemma identique existe déjà.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const VALID_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

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

  // Parse CSV (simple, virgule + 1 entrée par ligne)
  const lines = csv.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0)
  if (lines.length === 0) return NextResponse.json({ error: 'empty csv' }, { status: 400 })

  // Détection du header (si la première ligne contient "lemma" ou "word", on skip)
  let dataLines = lines
  if (/^(lemma|word|term)\b/i.test(lines[0])) {
    dataLines = lines.slice(1)
  }

  const items: { lemma: string; cefr: string; rank: number | null; source: string }[] = []
  for (const line of dataLines) {
    const cols = line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''))
    const lemma = cols[0]?.toLowerCase()
    const cefr = (cols[1] || 'A1').toUpperCase()
    const rank = cols[2] ? parseInt(cols[2], 10) || null : null
    const source = cols[3] || defaultSource
    if (!lemma || !VALID_LEVELS.includes(cefr)) continue
    items.push({ lemma, cefr, rank, source })
  }

  if (items.length === 0) {
    return NextResponse.json({ error: 'no valid rows in csv', expected: 'lemma,cefr_level[,rank][,source]' }, { status: 400 })
  }

  // Récupère les lemmas déjà existants pour skip
  const lemmas = items.map(i => i.lemma)
  const { data: existing } = await supabase
    .from('translations').select('lemma').eq('lang_code', 'en-GB').in('lemma', lemmas)
  const existingSet = new Set((existing || []).map((r: any) => r.lemma.toLowerCase()))

  // Insertion batch : on insert les concepts puis les translations vides
  const toInsert = items.filter(i => !existingSet.has(i.lemma))
  let inserted = 0, skipped = items.length - toInsert.length, errors: string[] = []

  for (const item of toInsert) {
    try {
      const { data: c, error: ce } = await supabase
        .from('concepts')
        .insert({
          cefr_min: item.cefr,
          source_list: item.source,
          frequency_rank: item.rank,
          enrichment_status: 'pending',
          gloss_fr: null,
          domain: 'general',
        })
        .select('id')
        .single()
      if (ce || !c) { errors.push(`${item.lemma}: ${ce?.message || 'insert concept failed'}`); continue }

      const { error: te } = await supabase
        .from('translations')
        .insert({ concept_id: c.id, lang_code: 'en-GB', lemma: item.lemma })
      if (te) { errors.push(`${item.lemma}: ${te.message}`); continue }

      inserted++
    } catch (e: any) {
      errors.push(`${item.lemma}: ${e.message?.slice(0, 100)}`)
    }
  }

  return NextResponse.json({
    inserted,
    skipped,
    total: items.length,
    pending_enrichment: inserted,
    errors: errors.slice(0, 10),
  })
}
