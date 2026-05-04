/**
 * v3.5 — Persistance des fils de conversation par mode.
 *
 * GET  /api/coach/threads          → renvoie tous les threads de l'utilisateur connecté
 *                                    sous forme { ami: Msg[], auto: Msg[], tuteur: Msg[],
 *                                    speaking_pur: Msg[], pro_grc: Msg[] }
 * POST /api/coach/threads          → upsert un thread (body : { mode, messages })
 *
 * Note : on persiste uniquement role, text, wordScores, hasTarget.
 * Les Blob URLs (audioUrl) et l'état correction (transient UI) sont strippés
 * avant écriture pour ne pas saturer la BDD avec des références mortes.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const VALID_MODES = ['ami', 'auto', 'tuteur', 'speaking_pur', 'pro_grc', 'debutant'] as const
type Mode = typeof VALID_MODES[number]

interface PersistedMsg {
  role: 'user' | 'model'
  text: string
  wordScores?: { word: string; confidence: number | null; matchesTarget?: boolean | null }[]
  hasTarget?: boolean
}

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const { data, error } = await supabase
    .from('coach_threads')
    .select('mode, messages')
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Initialize all modes empty, then fill from DB
  const threads: Record<Mode, PersistedMsg[]> = {
    ami: [], auto: [], tuteur: [], speaking_pur: [], pro_grc: [],
  }
  for (const row of (data || [])) {
    if (VALID_MODES.includes(row.mode as Mode)) {
      threads[row.mode as Mode] = (row.messages as PersistedMsg[]) || []
    }
  }

  return NextResponse.json({ threads })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const mode = body.mode as Mode
  const messages = body.messages

  if (!VALID_MODES.includes(mode)) {
    return NextResponse.json({ error: 'invalid mode' }, { status: 400 })
  }
  if (!Array.isArray(messages)) {
    return NextResponse.json({ error: 'messages must be an array' }, { status: 400 })
  }
  // Garde-fou taille (évite injection d'un thread géant)
  if (messages.length > 500) {
    return NextResponse.json({ error: 'thread too long (max 500 messages)' }, { status: 400 })
  }

  // Sanitize : ne persiste que les champs autorisés
  const cleanMessages: PersistedMsg[] = messages
    .filter((m: any) => m && (m.role === 'user' || m.role === 'model') && typeof m.text === 'string')
    .map((m: any) => {
      const out: PersistedMsg = { role: m.role, text: String(m.text).slice(0, 4000) }
      if (Array.isArray(m.wordScores)) out.wordScores = m.wordScores
      if (m.hasTarget) out.hasTarget = true
      return out
    })

  const { error } = await supabase
    .from('coach_threads')
    .upsert(
      { user_id: user.id, mode, messages: cleanMessages },
      { onConflict: 'user_id,mode' },
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, count: cleanMessages.length })
}
