import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { askGroq, type GroqMessage } from '@/lib/groq'
import { askGemini } from '@/lib/gemini'
import { buildCoachSystemPrompt } from '@/lib/coach-prompts'

const DAILY_LIMIT = 200

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const messages: GroqMessage[] = body.messages || []

  const today = new Date().toISOString().slice(0, 10)
  const { count } = await supabase.from('audit_log').select('*', { count: 'exact', head: true })
    .eq('user_id', user.id).eq('action', 'coach_message')
    .gte('created_at', today + 'T00:00:00Z')

  if ((count || 0) >= DAILY_LIMIT) {
    return NextResponse.json({ error: `Limite quotidienne atteinte (${DAILY_LIMIT}/jour). Reviens demain.` }, { status: 429 })
  }

  const { data: profile } = await supabase.from('profiles')
    .select('display_name').eq('id', user.id).single()

  const { data: prefs } = await supabase.from('user_preferences')
    .select('themes, lang_code').eq('user_id', user.id).single()

  const { data: lang } = await supabase.from('user_languages')
    .select('cefr_global').eq('user_id', user.id).eq('is_current', true).maybeSingle()

  const systemPrompt = buildCoachSystemPrompt({
    cefr: lang?.cefr_global || null,
    themes: prefs?.themes || [],
    langCode: prefs?.lang_code || 'en-GB',
    displayName: profile?.display_name || null,
  })

  let reply: string
  let provider = 'groq'

  try {
    reply = await askGroq(messages, { systemPrompt, temperature: 0.7, maxOutputTokens: 200 })
  } catch (eGroq: any) {
    try {
      reply = await askGemini(messages, { systemPrompt, temperature: 0.7, maxOutputTokens: 200 })
      provider = 'gemini-fallback'
    } catch (eGemini: any) {
      return NextResponse.json({
        error: 'Coach temporairement indisponible. Réessaie dans une minute.',
        debug: { groq: eGroq.message?.slice(0, 200), gemini: eGemini.message?.slice(0, 200) },
      }, { status: 503 })
    }
  }

  await supabase.from('audit_log').insert({
    user_id: user.id, action: 'coach_message',
    payload_json: { user_msg: messages[messages.length - 1]?.text?.slice(0, 200), provider },
  })

  if ((count || 0) === 0) {
    await supabase.from('daily_quests').upsert({
      user_id: user.id, lang_code: prefs?.lang_code || 'en-GB',
      date: today, quest_type: 'pratique', status: 'in_progress',
    }, { onConflict: 'user_id,lang_code,date,quest_type' })
  }

  return NextResponse.json({ reply, provider, remaining: DAILY_LIMIT - (count || 0) - 1 })
}
