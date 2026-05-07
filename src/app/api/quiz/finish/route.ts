/**
 * v3.23.3 — Finalise un quiz CEFR.
 * - Si pct >= 70 : promotion vers le niveau suivant + insertion d'un diplôme
 *   dans `certificates` (mention selon score, idempotent par user+level).
 * - Renvoie certificateUrl (PDF) au lieu de l'ancien HTML.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

type Mention = 'Passable' | 'Bien' | 'Très Bien' | 'Excellent'

function mentionFromPct(pct: number): Mention {
  if (pct >= 90) return 'Excellent'
  if (pct >= 75) return 'Très Bien'
  if (pct >= 60) return 'Bien'
  return 'Passable'
}

function makeSerial(level: string, userId: string, ts: number): string {
  const u = userId.replace(/-/g, '').slice(0, 4).toUpperCase()
  const t = ts.toString(36).toUpperCase().slice(-6)
  return `DDL-${level}-${u}-${t}`
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const level = String(body.level || '').toUpperCase()
  const pct = Number(body.pct || 0)
  const score = Number(body.score || 0)
  const total = Number(body.total || 0)

  if (!LEVEL_ORDER.includes(level as any)) {
    return NextResponse.json({ error: 'invalid level' }, { status: 400 })
  }

  const passed = pct >= 70
  let promoted = false
  let newLevel = level
  let certificateUrl: string | null = null

  if (passed) {
    // Promotion CEFR
    const idx = LEVEL_ORDER.indexOf(level as any)
    if (idx >= 0 && idx < LEVEL_ORDER.length - 1) {
      newLevel = LEVEL_ORDER[idx + 1]
      const { error: upErr } = await supabase
        .from('user_languages')
        .update({ cefr_global: newLevel })
        .eq('user_id', user.id)
        .eq('lang_code', 'en-GB')
      if (!upErr) promoted = true
    }

    // Insertion diplôme (idempotent)
    const { data: existing } = await supabase
      .from('certificates')
      .select('id')
      .eq('user_id', user.id)
      .eq('level', level)
      .maybeSingle()

    if (!existing) {
      const issued = new Date()
      const serial = makeSerial(level, user.id, issued.getTime())
      await supabase.from('certificates').insert({
        user_id: user.id,
        level,
        mention: mentionFromPct(pct),
        score: pct,
        issued_at: issued.toISOString(),
        serial,
      })
    }
    certificateUrl = `/api/certificate?level=${level}`
  }

  // Audit
  await supabase.from('audit_log').insert({
    user_id: user.id,
    action: 'cefr_quiz',
    payload_json: { level, score, total, pct, passed, promoted, newLevel },
  })

  return NextResponse.json({
    passed,
    promoted,
    newLevel: promoted ? newLevel : level,
    mention: passed ? mentionFromPct(pct) : null,
    certificateUrl,
  })
}
