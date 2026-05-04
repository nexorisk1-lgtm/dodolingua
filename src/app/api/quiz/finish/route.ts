/**
 * v3.14 — Finalise un quiz CEFR. Si score >= 70%, met à jour cefr_global au level suivant
 * et signale qu'un certificat est disponible.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const level = String(body.level || '').toUpperCase()
  const pct = Number(body.pct || 0)
  const score = Number(body.score || 0)
  const total = Number(body.total || 0)

  if (!LEVEL_ORDER.includes(level)) {
    return NextResponse.json({ error: 'invalid level' }, { status: 400 })
  }

  const passed = pct >= 70
  let promoted = false
  let newLevel = level

  if (passed) {
    const idx = LEVEL_ORDER.indexOf(level)
    if (idx >= 0 && idx < LEVEL_ORDER.length - 1) {
      newLevel = LEVEL_ORDER[idx + 1]
      // Update cefr_global pour la langue courante
      const { error: upErr } = await supabase
        .from('user_languages')
        .update({ cefr_global: newLevel })
        .eq('user_id', user.id)
        .eq('lang_code', 'en-GB')
      if (!upErr) promoted = true
    }
  }

  // Log dans audit
  await supabase.from('audit_log').insert({
    user_id: user.id,
    action: 'cefr_quiz',
    payload_json: { level, score, total, pct, passed, promoted, newLevel },
  })

  return NextResponse.json({
    passed,
    promoted,
    newLevel: promoted ? newLevel : level,
    certificateUrl: passed ? `/certificate?level=${level}&score=${score}&total=${total}` : null,
  })
}
