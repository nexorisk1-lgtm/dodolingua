'use client'

/**
 * v9.9 — Page checkpoint A1 mixte (vocab + grammaire).
 * Charge un checkpoint, joue ses steps mixés, affiche score final + reprise.
 */

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'
import { CheckpointStep, type CheckpointStepData } from '@/components/checkpoint/CheckpointStep'
import { TTS_VERSION, stopSpeaking } from '@/components/games/utils'

interface Checkpoint {
  id: string
  position: number
  title_fr: string
  emoji: string | null
  intro_user_fr: string | null
  is_final: boolean
}

export default function CheckpointPage() {
  const params = useParams<{ checkpointId: string }>()
  const router = useRouter()
  const checkpointId = params.checkpointId

  const [checkpoint, setCheckpoint] = useState<Checkpoint | null>(null)
  const [steps, setSteps] = useState<CheckpointStepData[]>([])
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

      const [cpRes, stepsRes, profRes] = await Promise.all([
        supabase.from('checkpoint_a1')
          .select('id, position, title_fr, emoji, intro_user_fr, is_final')
          .eq('id', checkpointId).maybeSingle(),
        supabase.from('checkpoint_a1_steps')
          .select('id, position, source_kind, step_type, content_json')
          .eq('checkpoint_id', checkpointId).order('position'),
        supabase.from('profiles')
          .select('display_name').eq('id', user.id).maybeSingle(),
      ])
      if (cpRes.data) setCheckpoint(cpRes.data as Checkpoint)
      const loadedSteps = (stepsRes.data || []) as CheckpointStepData[]
      setSteps(loadedSteps)
      if (profRes.data?.display_name) setUserName(profRes.data.display_name)

      // Reprise : restaure le stepIdx sauvegardé en localStorage si < 24h
      try {
        const saved = localStorage.getItem(`checkpoint-progress-${checkpointId}`)
        if (saved) {
          const s = JSON.parse(saved)
          const ageH = (Date.now() - (s.savedAt || 0)) / 3600000
          if (ageH < 24 && typeof s.stepIdx === 'number' && s.stepIdx < loadedSteps.length) {
            setStepIdx(s.stepIdx)
            setScore(s.score || { correct: 0, total: 0 })
            setBestStreak(s.bestStreak || 0)
          }
        }
      } catch {}
      setPhase(loadedSteps.length > 0 ? 'running' : 'done')
    })()
    return () => { stopSpeaking() }
  }, [checkpointId, router])

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
      try { localStorage.removeItem(`checkpoint-progress-${checkpointId}`) } catch {}
      setPhase('done')
    } else {
      const nextIdx = stepIdx + 1
      setStepIdx(nextIdx)
      try {
        localStorage.setItem(`checkpoint-progress-${checkpointId}`, JSON.stringify({
          stepIdx: nextIdx, score, bestStreak, savedAt: Date.now(),
        }))
      } catch {}
    }
  }

  function handleBack() {
    if (stepIdx <= 0) return
    setStepIdx(stepIdx - 1)
  }

  async function pauseAndReturnHome() {
    stopSpeaking()
    router.push('/dashboard')
  }

  if (phase === 'loading') return <Container className="max-w-md py-6"><Card>Chargement…</Card></Container>
  if (!checkpoint) return <Container className="max-w-md py-6"><Card>Checkpoint introuvable.</Card></Container>

  const stepProgress = steps.length > 0 ? Math.round(((stepIdx + 1) / steps.length) * 100) : 0
  const currentStep = steps[stepIdx]
  const scorePct = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0
  const passed = scorePct >= 70

  return (
    <Container className="max-w-md py-6 space-y-4">
      {/* Header retour + pause */}
      <div className="flex items-center justify-between gap-2">
        <Button size="sm" variant="ghost" onClick={() => router.push('/dashboard')}>
          ← Retour
        </Button>
        <button onClick={pauseAndReturnHome} className="text-sm font-semibold text-primary-700 hover:text-primary-900 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-full">
          ⏸️ Pause
        </button>
      </div>

      {/* Bandeau A1 + emoji + titre */}
      <div className="flex items-center gap-2">
        <span className={`text-xs font-bold px-2 py-0.5 rounded ${checkpoint.is_final ? 'bg-amber-100 text-amber-800' : 'bg-primary-50 text-primary-700'}`}>
          {checkpoint.is_final ? '🏆 FINAL A1' : 'CHECKPOINT'}
        </span>
        <span className="text-2xl">{checkpoint.emoji || '🎯'}</span>
        <span className="text-sm font-bold text-primary-900 truncate flex-1">{checkpoint.title_fr}</span>
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
              <CheckpointStep
                key={currentStep.id}
                step={currentStep}
                onContinue={handleContinue}
                onBack={handleBack}
                canGoBack={stepIdx > 0}
                isLast={stepIdx + 1 >= steps.length}
                userName={userName ?? undefined}
                checkpointTitle={checkpoint.title_fr}
              />
            </Card>
          )}

          <div className="flex items-center justify-center gap-2 text-[10px] text-gray-400 select-none">
            <span data-tts-version={TTS_VERSION}>TTS {TTS_VERSION}</span>
            <span>·</span>
            <span>{currentStep?.source_kind === 'vocab' ? 'Vocab' : 'Grammaire'} · Step {stepIdx + 1}/{steps.length}</span>
          </div>
        </>
      )}

      {phase === 'done' && (
        <Card className="text-center space-y-3">
          <div className="text-5xl">{passed ? (checkpoint.is_final ? '🏆' : '🎉') : '💪'}</div>
          <h2 className="text-xl font-bold text-primary-900">
            {passed ? (checkpoint.is_final ? `Félicitations ${userName || 'Raïssa'} ! A1 validé !` : 'Checkpoint validé !') : 'Continue, tu progresses !'}
          </h2>
          {score.total > 0 && (
            <div className="text-3xl font-extrabold text-primary-700">
              {score.correct} / {score.total} <span className="text-base font-normal text-gray-500">({scorePct}%)</span>
            </div>
          )}
          {bestStreak >= 3 && (
            <div className="text-sm text-ok font-bold">Meilleure série : 🔥 {bestStreak}</div>
          )}
          {!passed && (
            <div className="text-sm text-gray-600 italic">Il te faut au moins 70% pour valider. Réessaie quand tu veux !</div>
          )}
          <div className="flex gap-2 pt-2">
            <Button block variant="ghost" onClick={() => router.push('/dashboard')}>← Dashboard</Button>
            <Button block onClick={() => {
              setStepIdx(0); setScore({correct:0,total:0}); setStreak(0); setBestStreak(0)
              setPhase('running')
            }}>Refaire</Button>
          </div>
          <div className="flex items-center justify-center gap-2 text-[10px] text-gray-400 select-none pt-1">
            <span data-tts-version={TTS_VERSION}>TTS {TTS_VERSION}</span>
            <span>·</span>
            <span>Checkpoint A1</span>
          </div>
        </Card>
      )}
    </Container>
  )
}
