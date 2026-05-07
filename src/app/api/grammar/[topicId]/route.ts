/**
 * v3.24.0 — Endpoint /api/grammar/[topicId]
 * GET → renvoie règle + exemples + 6 exercices (mélangés)
 * POST → corrige une réponse, met à jour grammar_progress
 *
 * Body POST : { topicId, exerciseId, userAnswer }
 * Réponse POST : { correct, expected, explanation, newConsecCorrect }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[.!?]/g, '')
}

export async function GET(req: NextRequest, { params }: { params: { topicId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const topicId = params.topicId

  const { data: topic } = await supabase
    .from('grammar_topics')
    .select('*')
    .eq('id', topicId)
    .maybeSingle()

  if (!topic) return NextResponse.json({ error: 'topic not found' }, { status: 404 })

  const { data: exercises } = await supabase
    .from('grammar_exercises')
    .select('id, type, question, options_json, position, explanation_fr')
    .eq('topic_id', topicId)
    .order('position')

  // Progression
  const { data: progress } = await supabase
    .from('grammar_progress')
    .select('consec_correct, total_correct, total_attempts')
    .eq('user_id', user.id)
    .eq('topic_id', topicId)
    .maybeSingle()

  return NextResponse.json({
    topic,
    exercises: exercises || [],
    progress: progress || { consec_correct: 0, total_correct: 0, total_attempts: 0 },
  })
}

export async function POST(req: NextRequest, { params }: { params: { topicId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const exerciseId = String(body.exerciseId || '')
  const userAnswer = String(body.userAnswer || '')

  // Récupère l'exercice + sa réponse canonique
  const { data: ex } = await supabase
    .from('grammar_exercises')
    .select('id, answer, explanation_fr, topic_id')
    .eq('id', exerciseId)
    .maybeSingle()

  if (!ex) return NextResponse.json({ error: 'exercise not found' }, { status: 404 })

  const correct = normalize(userAnswer) === normalize(ex.answer)

  // Mise à jour progression (upsert)
  const { data: existing } = await supabase
    .from('grammar_progress')
    .select('consec_correct, total_correct, total_attempts')
    .eq('user_id', user.id)
    .eq('topic_id', ex.topic_id)
    .maybeSingle()

  const newConsec = correct ? (existing?.consec_correct || 0) + 1 : 0
  const totalCorrect = (existing?.total_correct || 0) + (correct ? 1 : 0)
  const totalAttempts = (existing?.total_attempts || 0) + 1

  await supabase.from('grammar_progress').upsert({
    user_id: user.id,
    topic_id: ex.topic_id,
    consec_correct: newConsec,
    last_seen_at: new Date().toISOString(),
    total_correct: totalCorrect,
    total_attempts: totalAttempts,
  })

  return NextResponse.json({
    correct,
    expected: ex.answer,
    explanation: ex.explanation_fr,
    newConsecCorrect: newConsec,
  })
}
