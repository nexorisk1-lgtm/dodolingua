/**
 * v3.31.3 — Endpoint admin temporaire : pilote enrichissement exemples Groq.
 * Génère un exemple A1 pour 20 concepts pilotes + auto-vérifications.
 * Sécurité : token query param (à supprimer après pilote).
 *
 * Usage : GET /api/admin/groq-pilot?token=DODO_ENRICH_2026
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ADMIN_TOKEN = 'DODO_ENRICH_2026'

const PILOT_LEMMAS = [
  'hi', 'hello', 'good morning', 'good afternoon', 'good evening',
  'good night', 'goodbye', 'bye',
  'thank you', 'thanks', 'please', 'sorry', 'ok',
  'yes', 'no', 'friend', 'girl', 'woman', 'man', 'face',
]

interface Concept {
  id: string
  gloss_fr: string | null
  lemma: string
  level: string | null
}

async function generateExample(lemma: string, glossFr: string, level: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY missing')

  const sys = `You generate ONE very short English sentence (max 10 words) using the given word "${lemma}" naturally. Level ${level || 'A1'}. The word MUST appear EXACTLY as given (no plural, no conjugation). Use everyday vocabulary. Output ONLY the sentence, no quotes, no preamble.`
  const usr = `Word: ${lemma}\nFrench meaning: ${glossFr}\nExample:`

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'system', content: sys }, { role: 'user', content: usr }],
      temperature: 0.3,
      max_tokens: 60,
    }),
  })
  if (!res.ok) throw new Error(`Groq HTTP ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return (data.choices?.[0]?.message?.content || '').trim().replace(/^["']|["']$/g, '')
}

function checks(lemma: string, sentence: string): { ok: boolean; reasons: string[] } {
  const reasons: string[] = []
  const lowered = sentence.toLowerCase()
  const lemmaLow = lemma.toLowerCase()
  if (!new RegExp(`\\b${lemmaLow.replace(/[-+]/g, '\\$&')}\\b`, 'i').test(lowered)) {
    reasons.push('lemma absent au mot-pour-mot')
  }
  const wc = sentence.split(/\s+/).filter(Boolean).length
  if (wc > 12) reasons.push(`trop long (${wc} mots)`)
  if (wc < 3) reasons.push(`trop court (${wc} mots)`)
  if (!/[.!?]$/.test(sentence)) reasons.push('pas de ponctuation finale')
  if (/[<>{}|\\]/.test(sentence)) reasons.push('caractères suspects')
  return { ok: reasons.length === 0, reasons }
}

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token')
  if (token !== ADMIN_TOKEN) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const supabase = createClient()

  // On pioche 1 concept par lemma pilote (CECRL A1 priority)
  const results: any[] = []
  for (const lemma of PILOT_LEMMAS) {
    const { data: rows } = await supabase
      .from('translations')
      .select('concept_id, lemma, concepts!inner(id, gloss_fr, cefr_min, module)')
      .eq('lang_code', 'en-GB').eq('lemma', lemma).limit(1)
    const r: any = rows?.[0]
    if (!r) {
      results.push({ lemma, error: 'concept introuvable' })
      continue
    }
    const concept = r.concepts
    try {
      const sentence = await generateExample(lemma, concept.gloss_fr || '', concept.cefr_min || 'A1')
      const ck = checks(lemma, sentence)
      results.push({
        concept_id: concept.id,
        lemma,
        gloss_fr: concept.gloss_fr,
        cefr: concept.cefr_min,
        sentence,
        ok: ck.ok,
        issues: ck.reasons,
      })
    } catch (e: any) {
      results.push({ lemma, error: e?.message || 'erreur' })
    }
  }

  const okCount = results.filter(r => r.ok).length
  return NextResponse.json({
    total: results.length,
    ok: okCount,
    ko: results.length - okCount,
    pilot: results,
  })
}
