'use client'
import { useState, useMemo } from 'react'
import type { GameProps } from './types'
import { shuffle } from './utils'

/**
 * Sentence Builder — utilise w.example si dispo, sinon construit une phrase simple.
 *
 * v1.3 — Affiche la correction (phrase attendue) en cas d'erreur, avec un délai
 * plus long avant la question suivante pour laisser le temps de lire.
 */
export function SentenceBuilderGame({ words, onResult, onComplete }: GameProps) {
  const [idx, setIdx] = useState(0)
  const w = words[idx]
  const sentence = w?.example || (w ? `I love ${w.lemma}` : '')
  const tokens = useMemo(() => sentence.split(/\s+/).filter(Boolean), [sentence])
  const shuffled = useMemo(() => shuffle(tokens.map((t, i) => ({ t, i }))), [tokens])
  const [picked, setPicked] = useState<{ t: string; i: number }[]>([])
  const [results, setResults] = useState<any[]>([])
  const [feedback, setFeedback] = useState<{ correct: boolean; expected: string; given: string } | null>(null)

  if (!w) return null

  function pick(item: { t: string; i: number }) {
    if (feedback) return
    if (picked.find(p => p.i === item.i)) return
    setPicked([...picked, item])
  }
  function unpick(item: { t: string; i: number }) {
    if (feedback) return
    setPicked(picked.filter(p => p.i !== item.i))
  }
  function check() {
    const ok = picked.every((p, i) => p.t === tokens[i]) && picked.length === tokens.length
    const r = { correct: ok }
    onResult(r)
    const newR = [...results, r]
    setResults(newR)
    setFeedback({ correct: ok, expected: sentence, given: picked.map(p => p.t).join(' ') })
    // v1.3 — délai plus long sur erreur (2.2s) pour laisser lire la correction
    const delay = ok ? 900 : 2200
    setTimeout(() => {
      setFeedback(null)
      if (idx + 1 >= words.length) onComplete?.(newR)
      else { setPicked([]); setIdx(idx + 1) }
    }, delay)
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-center text-gray-500">{idx + 1} / {words.length}</div>
      <div className="bg-white border border-rule rounded-2xl p-4 text-center">
        <div className="text-sm text-gray-500 mb-1">Reforme la phrase</div>
        <div className="font-bold text-primary-700">{w.lemma}</div>
        {w.translation && <div className="text-xs text-gray-500 italic">→ {w.translation}</div>}
      </div>
      <div className={`min-h-[64px] p-3 border-2 border-dashed rounded-xl flex flex-wrap gap-2 transition-colors ${
        feedback?.correct === true ? 'border-ok bg-green-50' :
        feedback?.correct === false ? 'border-warn bg-red-50' :
        'border-primary-300'
      }`}>
        {picked.map(p => (
          <button key={p.i} onClick={() => unpick(p)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
              feedback?.correct === true ? 'bg-ok text-white' :
              feedback?.correct === false ? 'bg-warn text-white' :
              'bg-primary-700 text-white'
            }`}>{p.t}</button>
        ))}
      </div>

      {/* v1.3 — Bloc correction visible en cas d'erreur */}
      {feedback && !feedback.correct && (
        <div className="border-l-4 border-warn bg-yellow-50 p-3 rounded-r-lg space-y-1">
          <div className="text-[10px] uppercase font-bold text-warn">💡 Correction</div>
          <div className="text-sm text-gray-500 line-through">{feedback.given}</div>
          <div className="text-sm font-semibold text-ok">{feedback.expected}</div>
        </div>
      )}
      {feedback?.correct && (
        <div className="border-l-4 border-ok bg-green-50 p-3 rounded-r-lg">
          <div className="text-sm font-semibold text-ok">✓ Bravo !</div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {shuffled.map(p => {
          const used = picked.find(x => x.i === p.i)
          return (
            <button key={p.i} disabled={!!used || !!feedback} onClick={() => pick(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${used ? 'bg-gray-100 text-gray-400 line-through' : 'bg-white border border-rule'}`}>
              {p.t}
            </button>
          )
        })}
      </div>
      <button onClick={check} disabled={picked.length !== tokens.length || !!feedback}
        className="w-full p-3 bg-primary-700 text-white rounded-xl font-semibold disabled:opacity-50">Valider</button>
    </div>
  )
}
