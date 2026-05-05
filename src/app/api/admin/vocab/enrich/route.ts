/**
 * v3.17 — Enrichissement LLM batch des concepts en pending.
 * Pioche N mots avec enrichment_status='pending', génère FR + IPA + exemple,
 * met à jour les rows. Renvoie compteurs.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { askGroq } from '@/lib/groq'

const ENRICH_PROMPT = `
You are a language assistant. For each English word given, output a JSON object with:
- "fr": French translation (1-3 words max, the most common meaning)
- "ipa": IPA pronunciation in British English (between slashes, e.g. /ˈhæpi/)
- "example": one short English example sentence (5-10 words, natural, that USES the word)

CRITICAL output format: a JSON ARRAY of objects, in the SAME ORDER as input words. NO preamble, NO markdown fences, just raw JSON.

Example input: ["hello", "go", "happy"]
Example output:
[
  {"fr":"bonjour","ipa":"/həˈləʊ/","example":"Hello, my name is Anna."},
  {"fr":"aller","ipa":"/ɡəʊ/","example":"I go to school every day."},
  {"fr":"heureux","ipa":"/ˈhæpi/","example":"She is happy today."}
]
`.trim()

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'admin required' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const batchSize = Math.min(Math.max(Number(body.batch_size || 20), 1), 30)

  // Pioche les concepts pending (avec leur translation)
  const { data: pending, error: fetchErr } = await supabase
    .from('concepts')
    .select('id, cefr_min, frequency_rank, translations!inner(lemma)')
    .eq('enrichment_status', 'pending')
    .eq('translations.lang_code', 'en-GB')
    .order('frequency_rank', { ascending: true, nullsFirst: false })
    .limit(batchSize)

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  if (!pending || pending.length === 0) {
    return NextResponse.json({ enriched: 0, message: 'no pending concepts' })
  }

  const items = pending.map((c: any) => ({
    id: c.id,
    lemma: (Array.isArray(c.translations) ? c.translations[0] : c.translations)?.lemma,
  })).filter((i: any) => i.lemma)

  if (items.length === 0) {
    return NextResponse.json({ enriched: 0, message: 'pending without translations' })
  }

  // Marque comme 'enriching' pour éviter qu'un autre call en parallèle les pioche
  const ids = items.map(i => i.id)
  await supabase.from('concepts').update({ enrichment_status: 'enriching' }).in('id', ids)

  // Appel LLM
  const lemmas = items.map(i => i.lemma)
  let raw = ''
  try {
    raw = await askGroq(
      [{ role: 'user', text: JSON.stringify(lemmas) }],
      { systemPrompt: ENRICH_PROMPT, temperature: 0.3, maxOutputTokens: 1500 },
    )
  } catch (e: any) {
    // Réinit pending pour retry
    await supabase.from('concepts').update({ enrichment_status: 'pending' }).in('id', ids)
    return NextResponse.json({ error: 'LLM failed', details: e.message?.slice(0, 200) }, { status: 503 })
  }

  // Parse
  let parsed: any[] = []
  try {
    const cleaned = raw.replace(/```json\n?|```/g, '').trim()
    parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed)) throw new Error('not an array')
  } catch (e: any) {
    // Parse échoué = LLM a renvoyé du JSON cassé. On remet en pending pour retry,
    // pas en failed (sinon on perd les mots définitivement).
    await supabase.from('concepts').update({ enrichment_status: 'pending' }).in('id', ids)
    return NextResponse.json({
      error: 'LLM response not parsable, batch reset to pending',
      raw: raw.slice(0, 300),
      retryable: true,
    }, { status: 500 })
  }

  // Update each concept + translation
  let enriched = 0, failed = 0
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const enrich = parsed[i]
    if (!enrich || typeof enrich !== 'object' || !enrich.fr) {
      await supabase.from('concepts').update({ enrichment_status: 'failed' }).eq('id', item.id)
      failed++
      continue
    }
    try {
      // Update concept gloss_fr + status
      await supabase.from('concepts').update({
        gloss_fr: String(enrich.fr).slice(0, 100),
        enrichment_status: 'enriched',
      }).eq('id', item.id)
      // Update translation IPA + example
      await supabase.from('translations').update({
        ipa: enrich.ipa ? String(enrich.ipa).slice(0, 100) : null,
        example: enrich.example ? String(enrich.example).slice(0, 300) : null,
      }).eq('concept_id', item.id).eq('lang_code', 'en-GB')
      enriched++
    } catch (e) {
      failed++
      await supabase.from('concepts').update({ enrichment_status: 'failed' }).eq('id', item.id)
    }
  }

  return NextResponse.json({
    enriched, failed,
    batch_size: items.length,
    sample_word: items[0]?.lemma,
  })
}
