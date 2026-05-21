'use client'

/**
 * v9.1 — Page parcours d'une leçon vocabulaire (cohérence /grammaire/[topicId]).
 * Charge la leçon, ses steps ordonnés, le prénom user, et délègue à VocabLessonStep.
 */

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'
import { VocabLessonStep, type VocabStepData } from '@/components/vocab/VocabLessonStep'
import { TTS_VERSION, stopSpeaking } from '@/components/games/utils'

interface Lesson {
  id: string
  bloc_id: string
  position: number
  title_fr: string
  emoji: string | null
  intro_user_fr: string | null
  lemmas_json: string[]
}

export default function VocabLessonPage() {
  const params = useParams<{ lessonId: string }>()
  const router = useRouter()
  const lessonId = params.lessonId

  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [steps, setSteps] = useState<VocabStepData[]>([])
  const [userName, setUserName] = useState<string | null>(null)
  const [phase, setPhase] = useState<'loading' | 'running' | 'done'>('loading')
  const [stepIdx, setStepIdx] = useState(0)
  const [score, setScore] = useState({ correct: 0, total: 0 })
  const [bestStreak, setBestStreak] = useState(0)
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [lessonRes, stepsRes, profRes] = await Promise.all([
        supabase.from('vocab_lessons')
          .select('id, bloc_id, position, title_fr, emoji, intro_user_fr, lemmas_json')
          .eq('id', lessonId).maybeSingle(),
        supabase.from('vocab_lesson_steps')
          .select('id, position, phase, type, content_json')
          .eq('lesson_id', lessonId).order('position'),
        supabase.from('profiles')
          .select('display_name').eq('id', user.id).maybeSingle(),
      ])
      if (lessonRes.data) setLesson(lessonRes.data as Lesson)
      setSteps((stepsRes.data || []) as VocabStepData[])
      if (profRes.data?.display_name) setUserName(profRes.data.display_name)
      setPhase((stepsRes.data?.length || 0) > 0 ? 'running' : 'done')
    })()
    return () => { stopSpeaking() }
  }, [lessonId, router])

  function handleContinue(correct?: boolean) {
    if (typeof correct === 'boolean') {
      setScore(s => ({ correct: s.correct + (correct ? 1 : 0), total: s.total + 1 }))
      if (correct) {
        setStreak(s => {
          const n = s + 1
          setBestStreak(b => Math.max(b, n))
          return n
        })
      } else {
        setStreak(0)
      }
    }
    if (stepIdx + 1 >= steps.length) {
      saveProgress()
      setPhase('done')
    } else {
      setStepIdx(stepIdx + 1)
    }
  }

  function handleBack() {
    if (stepIdx > 0) setStepIdx(stepIdx - 1)
  }

  async function saveProgress() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('vocab_lesson_progress').upsert({
      user_id: user.id,
      lesson_id: lessonId,
      consec_correct: bestStreak,
      total_correct: score.correct,
      total_attempts: score.total,
      last_seen_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    }, { onConflict: 'user_id,lesson_id' })
  }

  async function pauseAndReturnHome() {
    await saveProgress()
    stopSpeaking()
    router.push('/dashboard')
  }

  if (phase === 'loading') return <Container className="max-w-md py-6"><Card>Chargement…</Card></Container>
  if (!lesson) return <Container className="max-w-md py-6"><Card>Leçon introuvable.</Card></Container>

  const stepProgress = steps.length > 0 ? Math.round(((stepIdx + 1) / steps.length) * 100) : 0
  const currentStep = steps[stepIdx]

  return (
    <Container className="max-w-md py-6 space-y-4">
      {/* Header retour + reprendre plus tard */}
      <div className="flex items-center justify-between gap-2">
        <Button size="sm" variant="ghost" onClick={() => router.push('/vocab')}>
          ← Retour
        </Button>
        <button onClick={pauseAndReturnHome} className="text-sm text-gray-600 hover:text-primary-700 underline">
          💾 Reprendre plus tard
        </button>
      </div>

      {/* Bandeau niveau + emoji + titre */}
      <div className="flex items-center gap-2">
        <span className="text-xs bg-primary-50 text-primary-700 font-bold px-2 py-0.5 rounded">A1</span>
        <span className="text-2xl">{lesson.emoji || '📘'}</span>
        <span className="text-sm font-bold text-primary-900 truncate flex-1">{lesson.title_fr}</span>
      </div>

      {phase === 'running' && (
        <>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-primary-500 transition-all" style={{ width: `${stepProgress}%` }} />
          </div>
          {streak >= 3 && (
            <div className="text-center text-sm font-bold text-ok">
              🔥 {streak} bonnes réponses d&apos;affilée !
            </div>
          )}

          {currentStep && (
            <Card>
              <VocabLessonStep
                key={currentStep.id}
                step={currentStep}
                onContinue={handleContinue}
                onBack={handleBack}
                canGoBack={stepIdx > 0}
                isLast={stepIdx + 1 >= steps.length}
                userName={userName ?? undefined}
                lessonTitle={lesson.title_fr}
              />
            </Card>
          )}

          <div className="flex items-center justify-center gap-2 text-[10px] text-gray-400 select-none">
            <span data-tts-version={TTS_VERSION}>TTS {TTS_VERSION}</span>
            <span>·</span>
            <span>Vocab · Phase {currentStep?.phase}</span>
          </div>
        </>
      )}

      {phase === 'done' && (
        <Card className="text-center space-y-3">
          <div className="text-5xl">🎉</div>
          <h2 className="text-xl font-bold text-primary-900">Leçon terminée !</h2>
          {score.total > 0 && (
            <div className="text-3xl font-extrabold text-primary-700">
              {score.correct} / {score.total}
            </div>
          )}
          {bestStreak >= 3 && (
            <div className="text-sm text-ok font-bold">Meilleure série : 🔥 {bestStreak}</div>
          )}
          <div className="flex gap-2 pt-2">
            <Button block variant="ghost" onClick={() => router.push('/vocab')}>← Autres leçons</Button>
            <Button block onClick={() => {
              setStepIdx(0); setScore({correct:0,total:0}); setStreak(0); setBestStreak(0)
              setPhase('running')
            }}>Refaire</Button>
          </div>
          <div className="flex items-center justify-center gap-2 text-[10px] text-gray-400 select-none pt-1">
            <span data-tts-version={TTS_VERSION}>TTS {TTS_VERSION}</span>
            <span>·</span>
            <span>Vocab</span>
          </div>
        </Card>
      )}
    </Container>
  )
}
