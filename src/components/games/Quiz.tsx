'use client'
import { useState, useMemo } from 'react'
import type { GameProps } from './types'
import { shuffle, pickDistractors, speak } from './utils'

export function QuizGame({ words, voiceName, onResult, onComplete }: GameProps) {
  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [results, setResults] = useState<any[]>([])
  const w = words[idx]
  const choices = useMemo(() => w
    ? shuffle([w, ...pickDistractors(words, w, 3)])
    : [], [idx, w, words])
  if (!w) return null

  function pick(id: string) {
    if (picked) return
    setPicked(id)
    const correct = id === w.id
    const r = { correct }
    onResult(r)
    setResults([...results, r])
    setTimeout(() => {
      if (idx + 1 >= words.length) onComplete?.([...results, r])
      else { setPicked(null); setIdx(idx + 1) }
    }, 900)
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-center text-gray-500">{idx + 1} / {words.length}</div>
      <div className="bg-white border border-rule rounded-2xl p-6 text-center">
        <div className="text-sm text-gray-500 mb-2">Que signifie&nbsp;:</div>
        <div className="text-2xl font-extrabold text-primary-900">{w.lemma}</div>
        <button onClick={() => speak(w.lemma, voiceName)} className="mt-2 text-sm bg-primary-50 text-primary-700 px-3 py-1 rounded-full">🔊</button>
      </div>
      <div className="space-y-2">
        {choices.map(c => {
          const correct = picked && c.id === w.id
          const wrong = picked === c.id && c.id !== w.id
          return (
            <button key={c.id} onClick={() => pick(c.id)}
              className={`w-full p-3 rounded-xl border-2 text-left font-semibold ${
                correct ? 'border-ok bg-green-50 text-ok' :
                wrong ? 'border-warn bg-red-50 text-warn' :
                'border-rule bg-white'
              }`}>
              {c.translation || c.lemma}
              {correct && ' ✅'}
            </button>
          )
        })}
      </div>
    </div>
  )
}
