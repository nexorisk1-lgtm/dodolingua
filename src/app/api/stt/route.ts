/**
 * v3.10 — Endpoint STT premium (Deepgram). Si non configuré, retourne fallback.
 *
 * POST { audio_base64, mime } → { phonemes: [...] } | { fallback: true }
 *
 * Quand DEEPGRAM_API_KEY est configurée en env, transcrit l'audio avec scoring
 * phonème-level. Sinon, retourne fallback:true et le client utilise Web Speech API.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSttConfig, transcribeDeepgram } from '@/lib/stt'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const cfg = getSttConfig()
  if (cfg.provider !== 'deepgram') {
    return NextResponse.json({ fallback: true, reason: 'web_speech_default' })
  }

  const body = await req.json().catch(() => ({}))
  const b64 = String(body.audio_base64 || '')
  const mime = String(body.mime || 'audio/webm')
  if (!b64) return NextResponse.json({ error: 'audio_base64 required' }, { status: 400 })

  try {
    const buf = Buffer.from(b64, 'base64')
    const phonemes = await transcribeDeepgram(buf, mime)
    return NextResponse.json({ phonemes })
  } catch (e: any) {
    return NextResponse.json({ fallback: true, reason: e.message?.slice(0, 200) || 'deepgram_failed' })
  }
}
