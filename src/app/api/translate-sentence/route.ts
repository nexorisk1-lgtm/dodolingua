/**
 * v3.21.2 — Endpoint /api/translate-sentence
 * Traduit une phrase anglaise courte en français via Groq.
 * Cache simple côté client (localStorage) pour éviter ré-appels.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { askGroq } from '@/lib/groq'

const PROMPT = `
You are a translator. Translate the given English sentence to French naturally.
Output ONLY the French translation. NO preamble, NO quotes, NO explanation.
Keep punctuation and capitalization natural in French.
`.trim()

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const sentence: string = (body.sentence || '').toString().trim()
  if (!sentence) return NextResponse.json({ error: 'sentence required' }, { status: 400 })
  if (sentence.length > 300) return NextResponse.json({ error: 'sentence too long' }, { status: 400 })

  try {
    const fr = await askGroq(
      [{ role: 'user', text: sentence }],
      { systemPrompt: PROMPT, temperature: 0.2, maxOutputTokens: 200 },
    )
    return NextResponse.json({ fr: fr.trim() })
  } catch (e: any) {
    return NextResponse.json({ error: 'translate failed', details: e.message?.slice(0, 100) }, { status: 503 })
  }
}
