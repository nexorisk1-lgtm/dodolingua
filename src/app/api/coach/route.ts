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
  // v1.5 — mode coach : 'tuteur' | 'ami' | 'auto'
  const mode = (body.mode === 'tuteur' || body.mode === 'ami' || body.mode === 'auto' || body.mode === 'speaking_pur' || body.mode === 'pro_grc') ? body.mode : 'auto'
  // v3.3 — scénario optionnel (mode speaking_pur)
  const VALID_SCENARIOS = ['daily', 'meeting', 'restaurant', 'cafe', 'hotel', 'travel', 'shopping', 'pro', 'phone', 'health', 'park', 'info', 'colors', 'clothes', 'food', 'family', 'weather', 'hobbies', 'animals', 'house', 'numbers', 'calendar', 'emotions', 'irregular_verbs']
  const scenario = (typeof body.scenario === 'string' && VALID_SCENARIOS.includes(body.scenario)) ? body.scenario : 'daily'

  const today = new Date().toISOString().slice(0, 10)
  const { count } = await supabase.from('audit_log').select('*', { count: 'exact', head: true })
    .eq('user_id', user.id).eq('action', 'coach_message')
    .gte('created_at', today + 'T00:00:00Z')
  if ((count || 0) >= DAILY_LIMIT) {
    return NextResponse.json({ error: `Limite quotidienne atteinte (${DAILY_LIMIT}/jour). Reviens demain.` }, { status: 429 })
  }

  const { data: profile } = await supabase.from('profiles')
    .select('display_name, is_admin').eq('id', user.id).single()
  const { data: prefs } = await supabase.from('user_preferences')
    .select('themes, lang_code, grc_level, grc_enabled').eq('user_id', user.id).single()

  // v3.4 — Mode Pro GRC : réservé aux admins
  let effectiveMode = mode
  if (mode === 'pro_grc' && !profile?.is_admin) {
    effectiveMode = 'auto'
  }
  const { data: lang } = await supabase.from('user_languages')
    .select('cefr_global').eq('user_id', user.id).eq('is_current', true).maybeSingle()

  // v3.8 — Si mode = tuteur ou speaking_pur, on pioche les 5 mots les plus en retard
  // dans la queue FSRS pour que le coach les intègre naturellement dans la conversation
  // ou dans les phrases cibles. Pas de tracking strict, juste exposition contextuelle.
  let reviewWords: string[] = []
  if (effectiveMode === 'tuteur' || effectiveMode === 'speaking_pur') {
    const nowIso = new Date().toISOString()
    const { data: due } = await supabase
      .from('user_progress')
      .select('concept_id')
      .eq('user_id', user.id)
      .eq('lang_code', prefs?.lang_code || 'en-GB')
      .lte('next_review', nowIso)
      .order('next_review', { ascending: true })
      .limit(5)
    if (due && due.length > 0) {
      const ids = due.map((d: any) => d.concept_id)
      const { data: trs } = await supabase
        .from('translations')
        .select('lemma')
        .eq('lang_code', prefs?.lang_code || 'en-GB')
        .in('concept_id', ids)
      reviewWords = (trs || []).map((t: any) => t.lemma).filter(Boolean)
    }
  }

  const systemPrompt = buildCoachSystemPrompt({
    cefr: lang?.cefr_global || null,
    themes: prefs?.themes || [],
    langCode: prefs?.lang_code || 'en-GB',
    displayName: profile?.display_name || null,
    mode: effectiveMode,  // v3.4 — pro_grc forcé en auto si non-admin
    scenario,  // v3.3
    grcLevel: (prefs as any)?.grc_level || null,  // v3.4
    reviewWords,  // v3.8 — mots dûs en révision
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
    payload_json: { user_msg: messages[messages.length - 1]?.text?.slice(0, 200), provider, review_words: reviewWords.length },
  })

  // v1.4 — Gestion de la quête "Pratique" :
  // - 1er message réel → in_progress
  // - 3 messages réels → completed + points
  const realUserMsgs = messages.filter((m: any) => m.role === 'user' && m.text !== '__START__').length
  const langCodePref = prefs?.lang_code || 'en-GB'

  if (realUserMsgs >= 1) {
    // Vérifie le statut actuel pour décider in_progress vs completed
    const { data: existing } = await supabase.from('daily_quests')
      .select('status, points_earned')
      .eq('user_id', user.id).eq('lang_code', langCodePref)
      .eq('date', today).eq('quest_type', 'pratique').maybeSingle()

    if (realUserMsgs >= 3 && existing?.status !== 'completed') {
      // v1.4 — Quête complétée après 3 messages réels
      const points = 15  // matches QUEST reward "+15 pts" du dashboard
      await supabase.from('daily_quests').upsert({
        user_id: user.id, lang_code: langCodePref,
        date: today, quest_type: 'pratique', status: 'completed',
        points_earned: points,
        completed_at: new Date().toISOString(),
        content_ref: { messages_count: realUserMsgs },
      }, { onConflict: 'user_id,lang_code,date,quest_type' })
      // Incrémente les points hebdo/total
      await supabase.rpc('increment_user_points', { p_user: user.id, p_lang: langCodePref, p_amount: points }).then(() => null, () => null)
    } else if (existing?.status !== 'completed' && existing?.status !== 'in_progress') {
      await supabase.from('daily_quests').upsert({
        user_id: user.id, lang_code: langCodePref,
        date: today, quest_type: 'pratique', status: 'in_progress',
        content_ref: { messages_count: realUserMsgs },
      }, { onConflict: 'user_id,lang_code,date,quest_type' })
    } else if (existing?.status === 'in_progress') {
      // Mise à jour du compteur dans content_ref
      await supabase.from('daily_quests').upsert({
        user_id: user.id, lang_code: langCodePref,
        date: today, quest_type: 'pratique', status: 'in_progress',
        content_ref: { messages_count: realUserMsgs },
      }, { onConflict: 'user_id,lang_code,date,quest_type' })
    }
  }

  return NextResponse.json({ reply, provider, remaining: DAILY_LIMIT - (count || 0) - 1, reviewWords })
}
