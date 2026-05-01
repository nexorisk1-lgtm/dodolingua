/**
 * v3.6 — Enregistre la note FSRS (savais / hesite / pas_su) sur une correction
 * et planifie la prochaine révision.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { newState, review, buttonToGrade, type FSRSState, type ButtonGrade } from '@/lib/fsrs'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const id = String(body.id || '')
  const button = body.button as ButtonGrade
  if (!id || !['savais', 'hesite', 'pas_su'].includes(button)) {
    return NextResponse.json({ error: 'invalid id or button' }, { status: 400 })
  }

  const { data: row, error: fetchErr } = await supabase
    .from('coach_corrections')
    .select('id, fsrs_state, lapses, consec_correct')
    .eq('id', id).eq('user_id', user.id).single()

  if (fetchErr || !row) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const grade = buttonToGrade(button)
  const state: FSRSState = (row.fsrs_state as FSRSState) || newState()
  const next = review(state, grade)
  const consec = button === 'pas_su' ? 0 : (row.consec_correct || 0) + 1
  const lapses = button === 'pas_su' ? (row.lapses || 0) + 1 : (row.lapses || 0)

  const { error: upErr } = await supabase
    .from('coach_corrections')
    .update({
      fsrs_state: next,
      last_review: new Date().toISOString(),
      next_review: next.due,
      consec_correct: consec,
      lapses,
    })
    .eq('id', id).eq('user_id', user.id)

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
  return NextResponse.json({ ok: true, next_review: next.due })
}
