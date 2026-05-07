/**
 * v3.24.1 — Endpoint /api/weak-points
 * GET → renvoie les 3 mots vocab + 3 topics grammaire les plus faibles
 *  - Vocab : consec_correct = 1 (fragile) ou last_seen_at récent avec erreurs
 *  - Grammaire : total_attempts > 0 et taux de réussite < 70%
 *
 * Réponse :
 *   {
 *     vocab: [{ concept_id, lemma, gloss_fr, consec_correct }],
 *     grammar: [{ topic_id, title_fr, success_rate, level }],
 *   }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  // ─── Vocab : top 3 mots fragiles (consec_correct = 1) les plus récents ───
  const { data: vocabProgress } = await supabase
    .from('user_progress')
    .select('concept_id, consec_correct, last_seen_at')
    .eq('user_id', user.id)
    .eq('consec_correct', 1)
    .order('last_seen_at', { ascending: false })
    .limit(20)

  const fragileIds = (vocabProgress || []).map(p => (p as any).concept_id)
  let vocabTop: any[] = []
  if (fragileIds.length > 0) {
    const { data: concepts } = await supabase
      .from('concepts')
      .select('id, gloss_fr, translations!inner(lemma)')
      .in('id', fragileIds.slice(0, 3))
      .eq('translations.lang_code', 'en-GB')
    vocabTop = (concepts || []).map(c => {
      const t = Array.isArray(c.translations) ? c.translations[0] : c.translations
      return {
        concept_id: c.id,
        lemma: t?.lemma,
        gloss_fr: c.gloss_fr,
      }
    })
  }

  // ─── Grammaire : topics avec total_attempts > 0 et taux < 70% ───
  const { data: gp } = await supabase
    .from('grammar_progress')
    .select('topic_id, total_correct, total_attempts, last_seen_at')
    .eq('user_id', user.id)
    .gt('total_attempts', 0)
    .order('last_seen_at', { ascending: false })

  const grammarFragile = (gp || [])
    .map(p => {
      const tc = (p as any).total_correct || 0
      const ta = (p as any).total_attempts || 1
      return {
        topic_id: (p as any).topic_id,
        success_rate: tc / ta,
        attempts: ta,
      }
    })
    .filter(p => p.success_rate < 0.7)
    .sort((a, b) => a.success_rate - b.success_rate)
    .slice(0, 3)

  let grammarTop: any[] = []
  if (grammarFragile.length > 0) {
    const { data: topics } = await supabase
      .from('grammar_topics')
      .select('id, title_fr, level, emoji')
      .in('id', grammarFragile.map(g => g.topic_id))
    grammarTop = grammarFragile.map(g => {
      const t = (topics || []).find(t => (t as any).id === g.topic_id)
      return {
        topic_id: g.topic_id,
        title_fr: (t as any)?.title_fr || g.topic_id,
        level: (t as any)?.level || '',
        emoji: (t as any)?.emoji || '📘',
        success_rate: Math.round(g.success_rate * 100),
        attempts: g.attempts,
      }
    })
  }

  return NextResponse.json({
    vocab: vocabTop,
    grammar: grammarTop,
  })
}
