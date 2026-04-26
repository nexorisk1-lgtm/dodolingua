'use client'
import { useState, useEffect, useMemo } from 'react'
import type { GameProps } from './types'
import { shuffle, pickDistractors } from './utils'

export function SpeedRoundGame({ words, onResult, onComplete }: GameProps) {
  const [time, setTime] = useState(60)
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [idx, setIdx] = useState(0)
  const [results, setResults] = useState<any[]>([])

  const w = words[idx % words.length]
  const choices = useMemo(() => w ? shuffle([w, ...pickDistractors(words, w, 2)]) : [], [idx, w, words])

  useEffect(() => {
    if (time <= 0) { onComplete?.(results); return }
    const t = setTimeout(() => setTime(time - 1), 1000)
    return () => clearTimeout(t)
  }, [time, results, onComplete])

  function pick(id: string) {
    if (time <= 0) return
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
    setIdx(idx + 1)
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
        {choices.map(c => (
          <button key={c.id} onClick={() => pick(c.id)} className="w-full p-3 rounded-xl border-2 border-rule bg-white font-semibold">
            {c.translation || c.lemma}
          </button>
        ))}
      </div>
    </div>
  )
}
