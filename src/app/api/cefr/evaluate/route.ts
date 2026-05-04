/**
 * v3.10 — Évalue le niveau CEFR de l'utilisateur à partir de ses derniers
 * échanges avec le coach. Utilise un LLM avec rubric CEFR officielle.
 *
 * POST → { messages: Msg[] (50 derniers user msg suffisent) } 
 * Response : { cefr: 'A2', breakdown: { speaking, range, accuracy, fluency, interaction }, summary }
 *
 * Le client appelle ça depuis /dashboard ou bouton "Évalue mon niveau" sur profil.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { askGroq } from '@/lib/groq'

const CEFR_PROMPT = `
You are an expert language assessor following the CEFR (Common European Framework of Reference) rubric.
Analyze the user's English production from the last 20-50 utterances and estimate their CEFR level.

Output STRICT JSON (no preamble, no markdown):
{
  "cefr": "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
  "breakdown": {
    "range": 1-6,        // vocabulary breadth
    "accuracy": 1-6,     // grammar correctness
    "fluency": 1-6,      // smoothness
    "interaction": 1-6,  // turn-taking, follow-ups
    "coherence": 1-6     // logical organization
  },
  "summary": "<2-3 sentence FRENCH summary of strengths and what to work on>"
}

CEFR ladder (rough mapping):
- A1: very basic, isolated words/phrases, errors abundant
- A2: simple everyday topics, can introduce self
- B1: handles familiar topics, some grammar control
- B2: can argue, express opinions, relatively few errors
- C1: nuanced, complex topics, near-native fluency
- C2: full mastery
`.trim()

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const messages: { role: string; text: string }[] = body.messages || []
  const userMsgs = messages.filter(m => m.role === 'user' && m.text && m.text !== '__START__').slice(-30)

  if (userMsgs.length < 3) {
    return NextResponse.json({ error: 'Pas assez de messages pour évaluer (min 3)' }, { status: 400 })
  }

  const corpus = userMsgs.map((m, i) => `${i + 1}. ${m.text}`).join('\n')

  let raw: string
  try {
    raw = await askGroq(
      [{ role: 'user', text: `Here are recent utterances from a learner:\n\n${corpus}` }],
      { systemPrompt: CEFR_PROMPT, temperature: 0.2, maxOutputTokens: 400 }
    )
  } catch (e: any) {
    return NextResponse.json({ error: 'Évaluateur indisponible. Réessaie plus tard.' }, { status: 503 })
  }

  // Parse JSON safe
  let parsed: any = {}
  try {
    const cleaned = raw.replace(/```json\n?|```/g, '').trim()
    parsed = JSON.parse(cleaned)
  } catch {
    return NextResponse.json({ error: 'Réponse de l\'évaluateur non parsable', raw: raw.slice(0, 200) }, { status: 500 })
  }

  if (!['A1','A2','B1','B2','C1','C2'].includes(parsed.cefr)) {
    return NextResponse.json({ error: 'CEFR invalide retourné' }, { status: 500 })
  }

  // Save to user_languages (en-GB par défaut, peut être étendu)
  const { error: upErr } = await supabase
    .from('user_languages')
    .update({
      cefr_estimated: parsed.cefr,
      cefr_estimated_at: new Date().toISOString(),
      cefr_breakdown: parsed.breakdown || null,
    })
    .eq('user_id', user.id)
    .eq('lang_code', 'en-GB')

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 })
  }

  return NextResponse.json({
    cefr: parsed.cefr,
    breakdown: parsed.breakdown,
    summary: parsed.summary,
  })
}
