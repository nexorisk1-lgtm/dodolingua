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

Output STRICT format (no preamble, no follow-up question):
✏️ Better: <corrected sentence>
💡 Why: <one sentence, max 15 words, no jargon>

Rules:
- If the sentence is already correct or only has tiny stylistic issues, reply exactly: "✅ Looks good — nothing to fix."
- Pick ONE error only (priority: meaning > tense > grammar > word choice).
- Keep "Why" friendly and clear, no linguistics terms.
- Reply in the same language as the user (English if user wrote English, etc.).
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

  return NextResponse.json({ correction: correction.trim(), provider })
}
