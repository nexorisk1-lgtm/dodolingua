/**
 * v3.26.0 — Endpoint /api/translate-word
 * Traduit un mot anglais en français avec contexte.
 * Utilise Groq (déjà configuré). Cache implicite par re-call client.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { askGroq } from '@/lib/groq'

const PROMPT = `
You are a translator for a French learner of English.
Given an English word and the sentence it appears in, output ONLY the most natural French translation of the word in that context.
- If the word is part of a common expression in the sentence, translate the expression instead.
- No preamble, no quotes, no explanation. Just the French translation.
- Keep it concise (1-5 words max).
`.trim()

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const word: string = (body.word || '').toString().trim()
  const context: string = (body.context || '').toString().trim().slice(0, 300)
  if (!word) return NextResponse.json({ error: 'word required' }, { status: 400 })
  if (word.length > 50) return NextResponse.json({ error: 'word too long' }, { status: 400 })

  const userMsg = context
    ? `Word: "${word}"\nSentence: "${context}"\n\nTranslate the word in this context.`
    : `Word: "${word}"\n\nTranslate this word.`

  try {
    const fr = await askGroq(
      [{ role: 'user', text: userMsg }],
      { systemPrompt: PROMPT, temperature: 0.1, maxOutputTokens: 60 },
    )
    return NextResponse.json({ fr: fr.trim().replace(/^["']|["']$/g, '') })
  } catch (e: any) {
    return NextResponse.json({ error: 'translate failed', details: e.message?.slice(0, 100) }, { status: 503 })
  }
}
