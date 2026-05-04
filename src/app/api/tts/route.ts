/**
 * v3.9 — Endpoint TTS premium (OpenAI). Fallback : le client utilise Web Speech.
 *
 * POST { text: string, voice?: string } → { audio_base64: string } | { fallback: true }
 *
 * Quand OPENAI_API_KEY est configurée en env, retourne du mp3 base64.
 * Sinon, retourne fallback:true et le client utilise window.speechSynthesis.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTtsConfig, synthesizeOpenAI } from '@/lib/tts'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const text = String(body.text || '').slice(0, 1000)
  if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 })

  const cfg = getTtsConfig()
  if (cfg.provider !== 'openai') {
    return NextResponse.json({ fallback: true, reason: 'web_speech_default' })
  }

  try {
    const voice = body.voice || cfg.voice || 'alloy'
    const buf = await synthesizeOpenAI(text, voice)
    return NextResponse.json({
      audio_base64: buf.toString('base64'),
      mime: 'audio/mpeg',
    })
  } catch (e: any) {
    return NextResponse.json({ fallback: true, reason: e.message?.slice(0, 200) || 'openai_failed' })
  }
}
