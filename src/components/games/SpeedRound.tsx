'use client'
import { useState, useEffect, useMemo } from 'react'
import type { GameProps } from './types'
import { shuffle, pickDistractors } from './utils'

// v1.3 — Feedback visuel : vert pour bonne réponse, rouge pour mauvaise,
// avec un délai de 500ms avant de passer à la question suivante.
export function SpeedRoundGame({ words, onResult, onComplete }: GameProps) {
  const [time, setTime] = useState(60)
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [idx, setIdx] = useState(0)
  const [results, setResults] = useState<any[]>([])
  const [feedback, setFeedback] = useState<{ pickedId: string; correct: boolean } | null>(null)

  const w = words[idx % words.length]
  const choices = useMemo(() => w ? shuffle([w, ...pickDistractors(words, w, 2)]) : [], [idx, w, words])

  useEffect(() => {
    if (time <= 0) { onComplete?.(results); return }
    const t = setTimeout(() => setTime(time - 1), 1000)
    return () => clearTimeout(t)
  }, [time, results, onComplete])

  function pick(id: string) {
    if (time <= 0 || feedback) return
    const ok = id === w.id
    const r = { correct: ok }
    onResult(r)
    setResults(prev => [...prev, r])
    if (ok) {
      const newCombo = combo + 1
      setCombo(newCombo)
      setScore(score + 1 + Math.min(newCombo, 5))
    } else {
      setCombo(0)
    }
    setFeedback({ pickedId: id, correct: ok })
    setTimeout(() => {
      setFeedback(null)
      setIdx(prev => prev + 1)
    }, 500)
  }

  if (!w) return null

  if (time <= 0) {
    return (
      <div className="text-center space-y-3 py-8">
        <div className="text-5xl">⚡</div>
        <h2 className="text-xl font-bold text-primary-900">Temps écoulé !</h2>
        <div className="text-3xl font-extrabold text-primary-700">{score} pts</div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-2xl font-extrabold text-warn">⏱ {time}s</div>
        <div className="text-sm font-bold text-primary-700">Score: {score}</div>
        {combo > 1 && <div className="text-sm bg-primary-700 text-white px-2 py-0.5 rounded-full">×{combo}</div>}
      </div>
      <div className="bg-white border border-rule rounded-2xl p-5 text-center">
        <div className="text-sm text-gray-500 mb-1">Sens de :</div>
        <div className="text-2xl font-extrabold text-primary-900">{w.lemma}</div>
      </div>
      <div className="space-y-2">
        {choices.map(c => {
          // v1.3 — calcule l'état visuel selon le feedback
          const isPicked = feedback?.pickedId === c.id
          const isCorrectAnswer = feedback && c.id === w.id
          let cls = 'border-rule bg-white'
          if (feedback) {
            if (isPicked && feedback.correct) cls = 'border-ok bg-green-100 text-ok'
            else if (isPicked && !feedback.correct) cls = 'border-warn bg-red-100 text-warn'
            else if (!isPicked && isCorrectAnswer) cls = 'border-ok bg-green-50 text-ok'
            else cls = 'border-rule bg-white opacity-50'
          }
          return (
            <button key={c.id} onClick={() => pick(c.id)} disabled={!!feedback}
              className={`w-full p-3 rounded-xl border-2 font-semibold transition-colors ${cls}`}>
              {c.translation || c.lemma}
              {isPicked && feedback?.correct && ' ✓'}
              {isPicked && !feedback?.correct && ' ✗'}
            </button>
          )
        })}
      </div>
    </div>
  )
}
