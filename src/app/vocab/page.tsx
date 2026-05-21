'use client'

/**
 * v9.1 — Page liste des blocs vocab A1 (cohérence /grammaire).
 * Affiche les 22 blocs A1 par ordre + leurs leçons avec barre de progression.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'
import { TTS_VERSION } from '@/components/games/utils'

interface Bloc {
  id: string
  level: string
  position: number
  title_fr: string
  emoji: string | null
  objectif_global_fr: string | null
}

interface Lesson {
  id: string
  bloc_id: string
  position: number
  title_fr: string
  emoji: string | null
}

interface Progress { lesson_id: string; completed_at: string | null }

export default function VocabIndexPage() {
  const router = useRouter()
  const [blocs, setBlocs] = useState<Bloc[]>([])
  const [lessonsByBloc, setLessonsByBloc] = useState<Record<string, Lesson[]>>({})
  const [progress, setProgress] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [blocsRes, lessonsRes, progRes] = await Promise.all([
        supabase.from('vocab_blocs').select('id, level, position, title_fr, emoji, objectif_global_fr').eq('level', 'A1').order('position'),
        supabase.from('vocab_lessons').select('id, bloc_id, position, title_fr, emoji').order('position'),
        supabase.from('vocab_lesson_progress').select('lesson_id, completed_at').eq('user_id', user.id),
      ])
      setBlocs((blocsRes.data || []) as Bloc[])
      const byBloc: Record<string, Lesson[]> = {}
      for (const l of (lessonsRes.data || []) as Lesson[]) {
        if (!byBloc[l.bloc_id]) byBloc[l.bloc_id] = []
        byBloc[l.bloc_id].push(l)
      }
      setLessonsByBloc(byBloc)
      const completed = new Set((progRes.data || []).filter((p: Progress) => p.completed_at).map((p: Progress) => p.lesson_id))
      setProgress(completed)
      setLoading(false)
    })()
  }, [router])

  if (loading) return <Container className="max-w-md py-6"><Card>Chargement…</Card></Container>

  return (
    <Container className="max-w-md py-6 space-y-4">
      <div className="flex items-center justify-between">
        <Button size="sm" variant="ghost" onClick={() => router.push('/dashboard')}>← Dashboard</Button>
        <h1 className="text-base font-bold text-primary-900">📚 Vocabulaire A1</h1>
        <div className="w-12" />
      </div>

      {blocs.length === 0 && (
        <Card>
          <p className="text-center text-sm text-gray-500">Aucun bloc disponible pour le moment.</p>
        </Card>
      )}

      {blocs.map(bloc => {
        const lessons = lessonsByBloc[bloc.id] || []
        const completedCount = lessons.filter(l => progress.has(l.id)).length
        return (
          <Card key={bloc.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{bloc.emoji || '📘'}</span>
              <div className="flex-1">
                <div className="text-xs font-bold uppercase text-primary-700">Bloc {bloc.position}</div>
                <div className="text-sm font-bold text-primary-900">{bloc.title_fr}</div>
              </div>
              <div className="text-xs text-gray-600 font-semibold">{completedCount}/{lessons.length}</div>
            </div>
            {bloc.objectif_global_fr && (
              <div className="text-xs text-gray-600 italic">{bloc.objectif_global_fr}</div>
            )}
            <div className="space-y-1.5">
              {lessons.map(l => {
                const done = progress.has(l.id)
                return (
                  <button
                    key={l.id}
                    onClick={() => router.push(`/vocab/${l.id}`)}
                    className={`w-full flex items-center gap-2 p-2.5 rounded-lg border-2 transition text-left hover:scale-[1.01] ${done ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-gray-300 hover:border-primary-400'}`}>
                    <span className="text-lg">{l.emoji || '📖'}</span>
                    <span className="flex-1 text-sm font-semibold text-primary-900">{l.title_fr}</span>
                    {done ? <span className="text-emerald-600">✅</span> : <span className="text-gray-400">→</span>}
                  </button>
                )
              })}
            </div>
          </Card>
        )
      })}

      <div className="flex items-center justify-center gap-2 text-[10px] text-gray-400 select-none pt-2">
        <span data-tts-version={TTS_VERSION}>TTS {TTS_VERSION}</span>
        <span>·</span>
        <span>Vocab A1</span>
      </div>
    </Container>
  )
}
