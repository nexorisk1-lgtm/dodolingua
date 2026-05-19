'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'
import { GrammarLesson } from '@/components/grammar/GrammarLesson'
import { GrammarExercise, type GrammarExerciseData } from '@/components/grammar/GrammarExercise'
import { GrammarStep, type Step } from '@/components/grammar/GrammarStep'
import { GrammarStepV6, type StepV6 } from '@/components/grammar/GrammarStepV6'

interface Topic {
  id: string
  level: string
  title_fr: string
  rule_md: string
  emoji: string | null
  examples_json: { en: string; fr: string }[]
  lesson_format_version?: 'v5' | 'v6'  // V6 — flag de format
}

/**
 * v5 — Page leçon de grammaire.
 *
 * Si la table grammar_steps contient des étapes pour le topic → mode micro-séquence
 * (parcours pas-à-pas inspiré de Simpler). Sinon fallback sur l'ancien format
 * (lecture règle complète + 5 exercices) pour les topics non encore migrés.
 */
export default function GrammarTopicPage() {
  const params = useParams<{ topicId: string }>()
  const router = useRouter()
  const topicId = params.topicId

  const [topic, setTopic] = useState<Topic | null>(null)
  const [steps, setSteps] = useState<Step[]>([])
  const [exercises, setExercises] = useState<GrammarExerciseData[]>([])
  const [voiceName, setVoiceName] = useState<string | null>(null)
  // v8.9 — Prénom utilisateur pour personnaliser le "Bravo, [prénom]" final
  const [userName, setUserName] = useState<string | null>(null)
  const [phase, setPhase] = useState<'loading' | 'lesson' | 'steps' | 'exercises' | 'done'>('loading')
  const [stepIdx, setStepIdx] = useState(0)
  const [exoIdx, setExoIdx] = useState(0)
  const [score, setScore] = useState({ correct: 0, total: 0 })
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)

  useEffect(() => {
    (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [topicRes, stepsRes, exoRes, voiceRes, profileRes] = await Promise.all([
        supabase.from('grammar_topics')
          .select('id, level, title_fr, rule_md, emoji, examples_json, lesson_format_version')
          .eq('id', topicId).maybeSingle(),
        supabase.from('grammar_steps')
          .select('id, position, type, content_json')
          .eq('topic_id', topicId).order('position'),
        supabase.from('grammar_exercises')
          .select('id, topic_id, type, question, options_json, answer, explanation_fr, position')
          .eq('topic_id', topicId).order('position'),
        supabase.from('user_voice_pref')
          .select('voice_name').eq('user_id', user.id).eq('lang_code', 'en-GB').maybeSingle(),
        // v8.9 — Récupère le display_name pour le "Bravo, [prénom]" final
        supabase.from('profiles')
          .select('display_name').eq('id', user.id).maybeSingle(),
      ])

      if (topicRes.data) setTopic(topicRes.data as Topic)
      setSteps((stepsRes.data || []) as Step[])
      setExercises((exoRes.data || []) as GrammarExerciseData[])
      if (voiceRes.data) setVoiceName(voiceRes.data.voice_name)
      if (profileRes.data?.display_name) setUserName(profileRes.data.display_name)

      // v5 — Routing : si des steps existent, mode micro-séquence direct
      if ((stepsRes.data || []).length > 0) {
        setPhase('steps')
      } else {
        setPhase('lesson')
      }
    })()
  }, [topicId, router])

  /* ---------- Mode micro-séquence (steps) ---------- */
  function handleStepContinue(correct?: boolean) {
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

  // v5.2 — Retour à l'étape précédente sans perdre l'avancement
  function handleStepBack() {
    if (stepIdx > 0) setStepIdx(stepIdx - 1)
  }

  /* ---------- Mode ancien format (lesson + exercises) ---------- */
  async function recordResult(correct: boolean) {
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

  function nextExo() {
    if (exoIdx + 1 >= exercises.length) {
      saveProgress()
      setPhase('done')
    } else {
      setExoIdx(exoIdx + 1)
    }
  }

  async function saveProgress() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('grammar_progress').upsert({
        user_id: user.id,
        topic_id: topicId,
        consec_correct: bestStreak,
        last_seen_at: new Date().toISOString(),
        total_correct: score.correct,
        total_attempts: score.total,
      }, { onConflict: 'user_id,topic_id' })
    }
  }

  if (phase === 'loading') return <Container className="max-w-md py-6"><Card>Chargement…</Card></Container>
  if (!topic) return <Container className="max-w-md py-6"><Card>Leçon introuvable.</Card></Container>

  const stepProgress = steps.length > 0 ? Math.round(((stepIdx + 1) / steps.length) * 100) : 0

  // v5.11 — "Reprendre plus tard" : sauvegarde la progression et retourne au dashboard
  async function pauseAndReturnHome() {
    await saveProgress()
    router.push('/dashboard')
  }

  return (
    <Container className="max-w-md py-6 space-y-4">
      {/* v5.11 — Header avec retour + reprendre plus tard (cohérent avec le parcours vocabulaire) */}
      <div className="flex items-center justify-between gap-2">
        <Button size="sm" variant="ghost" onClick={() => router.push('/dashboard')}>
          ← Retour
        </Button>
        <button
          onClick={pauseAndReturnHome}
          className="text-sm text-gray-600 hover:text-primary-700 underline">
          💾 Reprendre plus tard
        </button>
      </div>

      {/* Bandeau niveau + emoji + titre */}
      <div className="flex items-center gap-2">
        <span className="text-xs bg-primary-50 text-primary-700 font-bold px-2 py-0.5 rounded">
          {topic.level}
        </span>
        <span className="text-2xl">{topic.emoji || '📘'}</span>
        <span className="text-sm font-bold text-primary-900 truncate flex-1">{topic.title_fr}</span>
      </div>

      {/* Barre de progression (mode steps) */}
      {phase === 'steps' && (
        <>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-primary-500 transition-all" style={{ width: `${stepProgress}%` }} />
          </div>
          {streak >= 3 && (
            <div className="text-center text-sm font-bold text-ok">
              🔥 {streak} bonnes réponses d&apos;affilée !
            </div>
          )}
        </>
      )}

      {/* V6 — Routage selon lesson_format_version :
          - 'v6' (refonte 13 étapes) → GrammarStepV6 (clic=audio, tap-to-build, code couleur)
          - 'v5' ou null → GrammarStep ancien (compat ascendante pour 278 topics non migrés) */}
      {phase === 'steps' && steps[stepIdx] && topic.lesson_format_version === 'v6' && (
        <Card>
          <GrammarStepV6
            key={steps[stepIdx].id}
            step={steps[stepIdx] as unknown as StepV6}
            onContinue={handleStepContinue}
            onBack={handleStepBack}
            canGoBack={stepIdx > 0}
            isLast={stepIdx + 1 >= steps.length}
            mode="complete"
            userName={userName ?? undefined}
            topicTitle={topic?.title_fr}
          />
        </Card>
      )}
      {phase === 'steps' && steps[stepIdx] && topic.lesson_format_version !== 'v6' && (
        <Card>
          <GrammarStep
            key={steps[stepIdx].id}
            step={steps[stepIdx]}
            voiceName={voiceName}
            onContinue={handleStepContinue}
            onBack={handleStepBack}
            canGoBack={stepIdx > 0}
            isLast={stepIdx + 1 >= steps.length}
          />
        </Card>
      )}

      {/* Mode ancien format : règle complète puis exercices */}
      {phase === 'lesson' && (
        <>
          <Card>
            <GrammarLesson
              titleFr={topic.title_fr}
              ruleMd={topic.rule_md}
              examples={topic.examples_json || []}
              voiceName={voiceName}
            />
          </Card>
          <Button block onClick={() => setPhase('exercises')}>
            Commencer les exercices ({exercises.length})
          </Button>
        </>
      )}

      {phase === 'exercises' && exercises.length > 0 && (
        <>
          <div className="text-xs text-center text-gray-500">
            Exercice {exoIdx + 1} / {exercises.length}
          </div>
          {streak >= 3 && (
            <div className="text-center text-sm font-bold text-ok">
              🔥 {streak} bonnes réponses d&apos;affilée !
            </div>
          )}
          <Card>
            <GrammarExercise
              exercise={exercises[exoIdx]}
              voiceName={voiceName}
              onResult={recordResult}
              onNext={nextExo}
              isLast={exoIdx + 1 >= exercises.length}
            />
          </Card>
        </>
      )}

      {phase === 'exercises' && exercises.length === 0 && (
        <Card>
          <div className="text-center space-y-2">
            <div className="text-sm text-gray-600">Aucun exercice disponible pour cette leçon.</div>
            <Button onClick={() => router.push('/grammaire')}>Retour à la liste</Button>
          </div>
        </Card>
      )}

      {phase === 'done' && (
        <Card className="text-center space-y-3">
          <div className="text-5xl">🎉</div>
          <h2 className="text-xl font-bold text-primary-900">Leçon terminée !</h2>
          <div className="text-3xl font-extrabold text-primary-700">
            {score.correct} / {score.total}
          </div>
          {bestStreak >= 3 && (
            <div className="text-sm text-ok font-bold">Meilleure série : 🔥 {bestStreak}</div>
          )}
          <p className="text-sm text-gray-600">
            {score.total > 0 && score.correct === score.total
              ? 'Parfait, tu maîtrises cette règle !'
              : score.total > 0 && score.correct >= score.total * 0.6
              ? 'Bien joué, encore un peu de pratique.'
              : 'Tu peux revoir la leçon et réessayer.'}
          </p>
          <div className="flex gap-2 pt-2">
            <Button block variant="ghost" onClick={() => router.push('/grammaire')}>← Autres leçons</Button>
            <Button block onClick={() => {
              setStepIdx(0); setExoIdx(0); setScore({correct:0,total:0}); setStreak(0); setBestStreak(0)
              setPhase(steps.length > 0 ? 'steps' : 'lesson')
            }}>
              Refaire
            </Button>
          </div>
        </Card>
      )}
    </Container>
  )
}
