/**
 * v3.26.0 — Endpoint /api/library/progress
 * Sauvegarde la progression de lecture + mots sauvegardés.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const book_id: string = body.book_id
  if (!book_id) return NextResponse.json({ error: 'book_id required' }, { status: 400 })

  const status = body.status === 'completed' ? 'completed' : 'reading'
  const progress_pct = Math.max(0, Math.min(100, parseInt(body.progress_pct) || 0))
  const last_page = Math.max(0, parseInt(body.last_page) || 0)
  const saved_words = Array.isArray(body.saved_words) ? body.saved_words.slice(0, 200) : []

  const now = new Date().toISOString()
  const upsert: any = {
    user_id: user.id,
    book_id,
    status,
    progress_pct,
    last_page,
    saved_words,
    updated_at: now,
  }
  if (status === 'completed') upsert.completed_at = now

  const { error } = await supabase
    .from('user_book_progress')
    .upsert(upsert, { onConflict: 'user_id,book_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
