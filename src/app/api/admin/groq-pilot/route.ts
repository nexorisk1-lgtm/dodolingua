/**
 * v3.31.4 — Pilote enrichissement Groq (utilise service_role pour bypass RLS).
 * Usage : GET /api/admin/groq-pilot?token=DODO_ENRICH_2026
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ADMIN_TOKEN = 'DODO_ENRICH_2026'

const PILOT_LEMMAS = [
  'hi', 'hello', 'good morning', 'good afternoon', 'good evening',
  'good night', 'goodbye', 'bye',
  'thank you', 'thanks', 'please', 'sorry', 'ok',
  'yes', 'no', 'friend', 'girl', 'woman', 'man', 'face',
]

async function generateExample(lemma: string, glossFr: string, level: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY missing')
  const sys = `You generate ONE very short English sentence (max 10 words) using the word "${lemma}" naturally. CEFR level ${level || 'A1'}. The word "${lemma}" MUST appear EXACTLY as given (lowercase, no plural, no conjugation change). Use simple everyday vocabulary. Output ONLY the sentence, no quotes, no preamble, no commentary.`
  const usr = `Word: ${lemma}\nFrench meaning: ${glossFr}\nExample:`
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'system', content: sys }, { role: 'user', content: usr }],
      temperature: 0.3, max_tokens: 60,
    }),
  })
  if (!res.ok) throw new Error(`Groq HTTP ${res.status}`)
  const data = await res.json()
  return (data.choices?.[0]?.message?.content || '').trim().replace(/^["']|["']$/g, '')
}

function checks(lemma: string, sentence: string): { ok: boolean; reasons: string[] } {
  const reasons: string[] = []
  const lemmaLow = lemma.toLowerCase()
  const esc = lemmaLow.replace(/[-+]/g, '\\$&')
  if (!new RegExp(`\\b${esc}\\b`, 'i').test(sentence)) reasons.push('lemma absent')
  const wc = sentence.split(/\s+/).filter(Boolean).length
  if (wc > 12) reasons.push(`long (${wc})`)
  if (wc < 3) reasons.push(`court (${wc})`)
  if (!/[.!?]$/.test(sentence)) reasons.push('pas ponctuation')
  return { ok: reasons.length === 0, reasons }
}

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token')
  if (token !== ADMIN_TOKEN) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supaUrl || !svcKey) return NextResponse.json({ error: 'missing env (SUPABASE_SERVICE_ROLE_KEY required)' }, { status: 500 })

  const supabase = createClient(supaUrl, svcKey)

  const results: any[] = []
  for (const lemma of PILOT_LEMMAS) {
    const { data: rows, error } = await supabase
      .from('translations')
      .select('concept_id, lemma, concepts!inner(id, gloss_fr, cefr_min, lesson_name)')
      .eq('lang_code', 'en-GB').eq('lemma', lemma).limit(1)
    if (error) { results.push({ lemma, error: error.message }); continue }
    const r: any = rows?.[0]
    if (!r) { results.push({ lemma, error: 'concept introuvable' }); continue }
    const c = r.concepts
    try {
      const sentence = await generateExample(lemma, c.gloss_fr || '', c.cefr_min || 'A1')
      const ck = checks(lemma, sentence)
      results.push({
        concept_id: c.id, lemma, gloss_fr: c.gloss_fr, cefr: c.cefr_min,
        lesson: c.lesson_name, sentence, ok: ck.ok, issues: ck.reasons,
      })
    } catch (e: any) { results.push({ lemma, error: e?.message || 'error' }) }
  }

  const okCount = results.filter(r => r.ok).length
  return NextResponse.json({ total: results.length, ok: okCount, ko: results.length - okCount, pilot: results })
}
