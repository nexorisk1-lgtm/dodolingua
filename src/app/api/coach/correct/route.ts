/**
 * v3 — Endpoint des corrections "à la demande" (axe 2 du benchmark, inspiré Praktika).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { askGroq } from '@/lib/groq'
import { askGemini } from '@/lib/gemini'

const DAILY_LIMIT = 300

const CORRECTION_PROMPT = `
You are a language tutor. The user just clicked "Show correction" on ONE of their own utterances. Your job: spot the SINGLE most important error and explain it briefly.

Output STRICT format (no preamble, no follow-up question), 3 lines:
✏️ Better: <corrected sentence in the original language>
💡 Why: <one sentence reason, max 15 words, no jargon>
🇫🇷 FR: <French translation of the corrected sentence>

Rules:
- If the sentence is already correct or only has tiny stylistic issues, reply exactly: "✅ Looks good — nothing to fix." (skip the 3 lines).
- Pick ONE error only (priority: meaning > tense > grammar > word choice).
- Keep "Why" friendly and clear, no linguistics terms.
- The "FR:" line is MANDATORY and MUST be a clean French translation of the corrected sentence (not the original).
- Reply in the same language as the user for "Better" and "Why" (English if user wrote English, etc.).
- Never add greetings, never propose a follow-up question.
`.trim()

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const utterance: string = (body.utterance || '').toString().trim()
  if (!utterance) return NextResponse.json({ error: 'utterance manquant' }, { status: 400 })
  if (utterance.length > 500) {
    return NextResponse.json({ error: 'phrase trop longue (max 500 caractères)' }, { status: 400 })
  }

  const today = new Date().toISOString().slice(0, 10)
  const { count } = await supabase.from('audit_log').select('*', { count: 'exact', head: true })
    .eq('user_id', user.id).eq('action', 'coach_correct')
    .gte('created_at', today + 'T00:00:00Z')
  if ((count || 0) >= DAILY_LIMIT) {
    return NextResponse.json({ error: `Limite quotidienne corrections atteinte (${DAILY_LIMIT}/jour).` }, { status: 429 })
  }

  let correction: string
  let provider = 'groq'
  try {
    correction = await askGroq(
      [{ role: 'user', text: utterance }],
      { systemPrompt: CORRECTION_PROMPT, temperature: 0.3, maxOutputTokens: 120 },
    )
  } catch (eGroq: any) {
    try {
      correction = await askGemini(
        [{ role: 'user', text: utterance }],
        { systemPrompt: CORRECTION_PROMPT, temperature: 0.3, maxOutputTokens: 120 },
      )
      provider = 'gemini-fallback'
    } catch (eGemini: any) {
      return NextResponse.json({
        error: 'Correction temporairement indisponible. Réessaie dans une minute.',
      }, { status: 503 })
    }
  }

  await supabase.from('audit_log').insert({
    user_id: user.id, action: 'coach_correct',
    payload_json: { utterance: utterance.slice(0, 200), provider },
  })

  // v3.6 — Captation auto de la correction pour le module Révisions
  // Format attendu de la correction LLM :
  //   ✏️ Better: <corrected sentence>
  //   💡 Why: <one-line reason>
  // (ou "✅ Looks good — nothing to fix." si rien à corriger)
  const corrTrim = correction.trim()
  const isLooksGood = /^✅/.test(corrTrim) || /looks good/i.test(corrTrim.slice(0, 30))
  if (!isLooksGood) {
    const betterMatch = corrTrim.match(/✏️?\s*Better\s*:\s*(.+?)(?:\n|$)/i)
    const whyMatch = corrTrim.match(/💡?\s*Why\s*:\s*(.+?)(?:\n|$)/i)
    const frMatch = corrTrim.match(/🇫🇷?\s*FR\s*:\s*(.+?)(?:\n|$)/i)
    const corrected_text = betterMatch?.[1]?.trim()
    const reason = whyMatch?.[1]?.trim() || null
    const corrected_fr = frMatch?.[1]?.trim() || null
    if (corrected_text && corrected_text !== utterance) {
      const sourceMode = (typeof body.source_mode === 'string' && ['ami','auto','tuteur','speaking_pur','pro_grc'].includes(body.source_mode))
        ? body.source_mode : 'tuteur'
      await supabase.from('coach_corrections').upsert({
        user_id: user.id,
        lang_code: 'en-GB',
        source_mode: sourceMode,
        original_text: utterance,
        corrected_text,
        reason,
        corrected_fr,  // v3.8.1
        fsrs_state: {},
        next_review: new Date().toISOString(),
        lapses: 0,
        consec_correct: 0,
      }, { onConflict: 'user_id,lang_code,original_text' })
    }
  }

  return NextResponse.json({ correction: corrTrim, provider })
}
