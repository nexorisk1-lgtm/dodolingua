/**
 * v3.24.0 — Page leçon grammaire /grammar/[topicId]
 * Phase 1 : règle + exemples (lecture)
 * Phase 2 : 6 exercices (MCQ / fill_blank / reorder / translate)
 * Phase 3 : récap + étoiles + lien retour
 *
 * 4 étoiles selon réussite :
 *  1★ : règle lue
 *  2★ : >= 50% des exos réussis
 *  3★ : >= 80%
 *  4★ : 100%
 */
'use client'

import { useEffect, useState, Suspense } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

interface Exercise {
  id: string
  type: 'mcq' | 'fill_blank' | 'reorder' | 'translate'
  question: string
  options_json: string[] | null
  position: number
  explanation_fr: string | null
}

interface Topic {
  id: string
  level: string
  title_fr: string
  rule_md: string
  emoji: string
  examples_json: { en: string; fr: string }[]
}

function GrammarLessonInner() {
  const params = useParams<{ topicId: string }>()
  const topicId = params.topicId
  const router = useRouter()

  const [topic, setTopic] = useState<Topic | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [phase, setPhase] = useState<'rule' | 'exos' | 'recap'>('rule')
  const [exoIdx, setExoIdx] = useState(0)
  const [userAnswer, setUserAnswer] = useState('')
  const [feedback, setFeedback] = useState<{ correct: boolean; expected: string; explanation: string | null } | null>(null)
  const [score, setScore] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!topicId) return
    fetch(`/api/grammar/${topicId}`)
      .then(r => r.json())
      .then(d => {
        setTopic(d.topic)
        setExercises(d.exercises || [])
      })
      .finally(() => setLoading(false))
  }, [topicId])

  if (loading) return <main className="p-8 text-center text-gray-600">Chargement…</main>
  if (!topic) return <main className="p-8 text-center text-red-600">Leçon introuvable.</main>

  // ───────── PHASE 1 : règle + exemples ─────────
  if (phase === 'rule') {
    return (
      <main className="min-h-screen bg-gradient-to-b from-purple-50 to-white pb-24">
        <div className="max-w-2xl mx-auto p-4">
          <Link href="/parcours" className="text-xs text-purple-700 hover:underline">← Parcours</Link>

          <header className="mt-3 mb-4 text-center">
            <div className="text-5xl mb-2">{topic.emoji || '📘'}</div>
            <h1 className="text-2xl font-extrabold text-purple-900">{topic.title_fr}</h1>
            <div className="text-xs text-purple-700 font-bold mt-1">Grammaire · {topic.level}</div>
          </header>

          <section className="bg-white rounded-2xl border border-purple-200 p-5 shadow-sm">
            <h2 className="text-sm font-bold text-purple-700 mb-2">📖 La règle</h2>
            <div className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">
              {topic.rule_md.split('\n').map((line, i) => {
                if (line.startsWith('- ')) {
                  return (
                    <div key={i} className="ml-2 my-1 flex">
                      <span className="text-purple-500 mr-2">•</span>
                      <span dangerouslySetInnerHTML={{ __html: formatBoldItalic(line.slice(2)) }} />
                    </div>
                  )
                }
                return <p key={i} className="my-2" dangerouslySetInnerHTML={{ __html: formatBoldItalic(line) }} />
              })}
            </div>
          </section>

          <section className="mt-4 bg-purple-50 rounded-2xl border border-purple-200 p-4">
            <h2 className="text-sm font-bold text-purple-700 mb-2">💬 Exemples</h2>
            <div className="space-y-2">
              {topic.examples_json.map((ex, i) => (
                <div key={i} className="bg-white rounded-lg p-3 border border-purple-100">
                  <div className="font-semibold text-primary-900">{ex.en}</div>
                  <div className="text-xs text-gray-600">{ex.fr}</div>
                </div>
              ))}
            </div>
          </section>

          <button
            onClick={() => setPhase('exos')}
            className="mt-6 w-full px-6 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 shadow-md"
          >
            Faire les exercices →
          </button>
        </div>
      </main>
    )
  }

  // ───────── PHASE 2 : exercices ─────────
  if (phase === 'exos') {
    if (exoIdx >= exercises.length) {
      setPhase('recap')
      return null
    }

    const ex = exercises[exoIdx]
    const total = exercises.length
    const progress = Math.round(((exoIdx) / total) * 100)

    async function submitAnswer(answer: string) {
      const res = await fetch(`/api/grammar/${topicId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exerciseId: ex.id, userAnswer: answer }),
      })
      const data = await res.json()
      setFeedback(data)
      if (data.correct) setScore(s => s + 1)
    }

    function next() {
      setFeedback(null)
      setUserAnswer('')
      setExoIdx(i => i + 1)
    }

    return (
      <main className="min-h-screen bg-gradient-to-b from-purple-50 to-white pb-24">
        <div className="max-w-2xl mx-auto p-4">
          {/* Progress bar */}
          <div className="flex items-center gap-2 mb-4">
            <div className="flex-1 h-2 bg-purple-100 rounded-full overflow-hidden">
              <div className="h-full bg-purple-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs font-bold text-purple-700">{exoIdx + 1}/{total}</span>
          </div>

          <div className="text-center mb-4">
            <div className="text-3xl mb-1">{topic.emoji}</div>
            <div className="text-xs font-bold text-purple-600 uppercase">{exoLabel(ex.type)}</div>
          </div>

          <section className="bg-white rounded-2xl border-2 border-purple-200 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-primary-900 mb-4">{ex.question}</h2>

            {/* MCQ */}
            {ex.type === 'mcq' && ex.options_json && (
              <div className="space-y-2">
                {ex.options_json.map(opt => (
                  <button
                    key={opt}
                    onClick={() => !feedback && submitAnswer(opt)}
                    disabled={!!feedback}
                    className={`w-full text-left px-4 py-3 rounded-xl border-2 font-medium transition ${
                      feedback
                        ? opt === feedback.expected
                          ? 'bg-green-50 border-green-400 text-green-900'
                          : opt === userAnswer
                          ? 'bg-red-50 border-red-400 text-red-900'
                          : 'bg-gray-50 border-gray-200 text-gray-500'
                        : 'bg-white border-purple-200 hover:bg-purple-50 hover:border-purple-400'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {/* fill_blank / reorder / translate → input */}
            {(ex.type === 'fill_blank' || ex.type === 'reorder' || ex.type === 'translate') && (
              <div>
                <input
                  type="text"
                  value={userAnswer}
                  onChange={e => setUserAnswer(e.target.value)}
                  disabled={!!feedback}
                  placeholder={ex.type === 'reorder' ? 'Reconstruis la phrase…' : 'Ta réponse…'}
                  className="w-full px-4 py-3 border-2 border-purple-200 rounded-xl text-base focus:border-purple-500 focus:outline-none disabled:bg-gray-50"
                  onKeyDown={e => { if (e.key === 'Enter' && !feedback) submitAnswer(userAnswer) }}
                />
                {!feedback && (
                  <button
                    onClick={() => submitAnswer(userAnswer)}
                    disabled={!userAnswer.trim()}
                    className="mt-3 w-full px-4 py-3 bg-purple-600 text-white font-bold rounded-xl disabled:opacity-40"
                  >
                    Valider
                  </button>
                )}
              </div>
            )}

            {/* Feedback */}
            {feedback && (
              <div className={`mt-4 rounded-xl p-4 ${feedback.correct ? 'bg-green-50 border border-green-300' : 'bg-amber-50 border border-amber-300'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Image
                    src={feedback.correct ? '/dodo/dodo-stars.png' : '/dodo/dodo-quest.png'}
                    alt="Dodo"
                    width={48}
                    height={48}
                  />
                  <div className="font-bold">{feedback.correct ? '✅ Bravo !' : `❌ Réponse : ${feedback.expected}`}</div>
                </div>
                {feedback.explanation && (
                  <div className="text-xs text-gray-700 mt-1">{feedback.explanation}</div>
                )}
                <button
                  onClick={next}
                  className="mt-3 w-full px-4 py-2 bg-purple-600 text-white font-bold rounded-xl"
                >
                  {exoIdx + 1 < total ? 'Suivant →' : 'Voir le récap →'}
                </button>
              </div>
            )}
          </section>
        </div>
      </main>
    )
  }

  // ───────── PHASE 3 : récap ─────────
  const total = exercises.length
  const pct = Math.round((score / Math.max(1, total)) * 100)
  let stars = 1
  if (pct >= 50) stars = 2
  if (pct >= 80) stars = 3
  if (pct === 100) stars = 4

  return (
    <main className="min-h-screen bg-gradient-to-b from-purple-50 to-white pb-24 flex items-center">
      <div className="max-w-md mx-auto p-6 text-center">
        <Image src="/dodo/dodo-stars.png" alt="Dodo champion" width={140} height={140} className="mx-auto" />
        <h1 className="text-2xl font-extrabold text-purple-900 mt-2">Leçon terminée&nbsp;!</h1>
        <div className="text-sm text-gray-600 mt-1">{topic.title_fr}</div>

        <div className="bg-white rounded-2xl border-2 border-purple-200 p-6 mt-4 shadow-md">
          <div className="text-4xl font-extrabold text-purple-700">{score}/{total}</div>
          <div className="text-xs text-gray-500 uppercase font-bold mt-1">Bonnes réponses</div>
          <div className="flex justify-center gap-1 mt-3">
            {[1, 2, 3, 4].map(i => (
              <span key={i} className={`text-3xl ${i <= stars ? '' : 'opacity-25 grayscale'}`}>⭐</span>
            ))}
          </div>
        </div>

        <Link href="/parcours" className="mt-6 inline-block px-6 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700">
          Continuer le parcours →
        </Link>
      </div>
    </main>
  )
}

function formatBoldItalic(s: string): string {
  // **bold** → <strong>, *italic* → <em>
  return s
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-primary-900">$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em class="text-purple-700">$1</em>')
}

function exoLabel(type: string): string {
  return {
    mcq: '🎯 Choix multiple',
    fill_blank: '✏️ Complète',
    reorder: '🔀 Remets dans l\'ordre',
    translate: '🌍 Traduis',
  }[type] || type
}

export default function GrammarLessonPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Chargement…</div>}>
      <GrammarLessonInner />
    </Suspense>
  )
}
