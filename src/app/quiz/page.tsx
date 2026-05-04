/**
 * v3.14 — Page de quiz d'évaluation CEFR (20 questions QCM rapides).
 * Mix : 10 questions sur les mots du niveau actuel (vocabulaire) + 10 questions
 * sur les patterns du niveau suivant (vérifie ta capacité à comprendre + haut).
 * Score >= 70% → cefr_global passe au level suivant + certificat débloqué.
 */
'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Mascot } from '@/components/Mascot'

interface Question {
  id: string
  prompt: string
  choices: string[]
  correct: string
  type: 'word_to_fr' | 'fr_to_word'
}

export default function QuizPage() {
  const router = useRouter()
  const search = useSearchParams()
  const level = (search.get('level') || 'A1').toUpperCase()
  const [questions, setQuestions] = useState<Question[]>([])
  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [answers, setAnswers] = useState<{ correct: boolean }[]>([])
  const [done, setDone] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/quiz?level=${encodeURIComponent(level)}`)
        const txt = await res.text()
        let data: any = {}
        if (txt) { try { data = JSON.parse(txt) } catch {} }
        if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`)
        setQuestions(data.questions || [])
      } catch (e: any) {
        setError(e.message || 'Erreur réseau')
      } finally {
        setLoading(false)
      }
    })()
  }, [level])

  function answer(opt: string) {
    if (picked !== null) return
    setPicked(opt)
    const q = questions[idx]
    const isCorrect = opt === q.correct
    setTimeout(() => {
      const newAnswers = [...answers, { correct: isCorrect }]
      setAnswers(newAnswers)
      if (idx + 1 >= questions.length) {
        finish(newAnswers)
      } else {
        setPicked(null)
        setIdx(idx + 1)
      }
    }, 1200)
  }

  async function finish(finalAnswers: { correct: boolean }[]) {
    const score = finalAnswers.filter(a => a.correct).length
    const total = finalAnswers.length
    const pct = total > 0 ? Math.round(100 * score / total) : 0
    setDone(true)
    try {
      const res = await fetch('/api/quiz/finish', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, score, total, pct }),
      })
      const txt = await res.text()
      let data: any = {}
      if (txt) { try { data = JSON.parse(txt) } catch {} }
      setResult({ score, total, pct, ...data })
    } catch {
      setResult({ score, total, pct })
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md text-center"><p className="text-sm text-gray-500 italic">Préparation du quiz {level}…</p></Card>
      </main>
    )
  }
  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md text-center space-y-4">
          <div className="text-3xl">⚠️</div>
          <p className="text-sm text-warn">{error}</p>
          <Button block onClick={() => router.push('/dashboard')}>Retour au dashboard</Button>
        </Card>
      </main>
    )
  }
  if (questions.length === 0) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md text-center space-y-4">
          <div className="text-3xl">📚</div>
          <p className="text-sm text-gray-700">Pas encore assez de contenu en {level} dans la biblio pour générer un quiz.</p>
          <Button block onClick={() => router.push('/dashboard')}>Retour</Button>
        </Card>
      </main>
    )
  }

  if (done) {
    const passed = (result?.pct || 0) >= 70
    const promoted = result?.promoted
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md text-center space-y-4">
          <Mascot pose={passed ? 'champion' : 'study'} size={120} animation={passed ? 'celebrate' : 'breathe'} />
          <h1 className="text-2xl font-bold text-primary-900">
            {passed ? `🎉 Quiz ${level} réussi !` : `Quiz ${level} pas tout à fait`}
          </h1>
          <div className="text-3xl font-extrabold text-primary-700">
            {result?.score || 0} / {result?.total || 0} ({result?.pct || 0}%)
          </div>
          {passed && promoted ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <div className="text-sm font-bold text-emerald-700">🎓 Tu passes en {result?.newLevel}</div>
              <div className="text-xs text-gray-700 mt-1">Ton niveau CEFR a été mis à jour automatiquement.</div>
              {result?.certificateUrl && (
                <Link href={result.certificateUrl}>
                  <span className="mt-3 inline-block px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold cursor-pointer">
                    📜 Voir mon certificat {level}
                  </span>
                </Link>
              )}
            </div>
          ) : passed ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs">
              Quiz réussi mais ton niveau actuel reste {level} (besoin de plus de contenu en {level} avant de passer).
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs">
              Il faut au moins 70% pour passer. Continue à pratiquer et réessaie !
            </div>
          )}
          <Button block onClick={() => router.push('/dashboard')}>Retour au dashboard</Button>
        </Card>
      </main>
    )
  }

  const q = questions[idx]
  return (
    <main className="min-h-screen flex items-start justify-center p-4">
      <Container className="max-w-md space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-primary-700">🎓 Test {level}</span>
          <span className="text-gray-500">{idx + 1} / {questions.length}</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-primary-500 transition-all" style={{ width: `${((idx + 1) / questions.length) * 100}%` }} />
        </div>
        <Card className="!p-5 space-y-4">
          <div className="text-[10px] uppercase font-bold text-gray-500 text-center">
            {q.type === 'word_to_fr' ? 'Que veut dire ce mot anglais ?' : 'Quel est le mot anglais ?'}
          </div>
          <div className="text-2xl font-extrabold text-center text-primary-900">{q.prompt}</div>
          <div className="space-y-2">
            {q.choices.map(opt => {
              const isCorrect = opt === q.correct
              const isPicked = picked === opt
              let cls = 'bg-white border-rule text-gray-800 hover:border-primary-300'
              if (picked !== null) {
                if (isCorrect) cls = 'bg-emerald-500 border-emerald-600 text-white shadow-md scale-[1.02]'
                else if (isPicked) cls = 'bg-red-500 border-red-600 text-white'
                else cls = 'bg-white border-rule text-gray-400 opacity-50'
              }
              return (
                <button key={opt} disabled={picked !== null} onClick={() => answer(opt)}
                  className={`w-full p-3 rounded-xl border-2 text-sm font-semibold transition flex items-center justify-between ${cls}`}>
                  <span className="flex-1 text-left">{opt}</span>
                  {picked !== null && isCorrect && <span className="text-xl ml-2">✓</span>}
                  {picked === opt && !isCorrect && <span className="text-xl ml-2">✗</span>}
                </button>
              )
            })}
          </div>
        </Card>
      </Container>
    </main>
  )
}
