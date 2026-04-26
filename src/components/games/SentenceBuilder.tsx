'use client'
import { useState, useMemo } from 'react'
import type { GameProps } from './types'
import { shuffle } from './utils'

/**
 * Sentence Builder — utilise w.example si dispo, sinon construit une phrase simple.
 */
export function SentenceBuilderGame({ words, onResult, onComplete }: GameProps) {
  const [idx, setIdx] = useState(0)
  const w = words[idx]
  const sentence = w?.example || (w ? `I love ${w.lemma}` : '')
  const tokens = useMemo(() => sentence.split(/\s+/).filter(Boolean), [sentence])
  const shuffled = useMemo(() => shuffle(tokens.map((t, i) => ({ t, i }))), [tokens])
  const [picked, setPicked] = useState<{ t: string; i: number }[]>([])
  const [results, setResults] = useState<any[]>([])

  if (!w) return null

  function pick(item: { t: string; i: number }) {
    if (picked.find(p => p.i === item.i)) return
    setPicked([...picked, item])
  }
  function unpick(item: { t: string; i: number }) {
    setPicked(picked.filter(p => p.i !== item.i))
  }
  function check() {
    const ok = picked.every((p, i) => p.t === tokens[i]) && picked.length === tokens.length
    const r = { correct: ok }
    onResult(r)
    const newR = [...results, r]
    setResults(newR)
    setTimeout(() => {
      if (idx + 1 >= words.length) onComplete?.(newR)
      else { setPicked([]); setIdx(idx + 1) }
    }, 1000)
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-center text-gray-500">{idx + 1} / {words.length}</div>
      <div className="bg-white border border-rule rounded-2xl p-4 text-center">
        <div className="text-sm text-gray-500 mb-1">Reforme la phrase</div>
        <div className="font-bold text-primary-700">{w.lemma}</div>
        {w.translation && <div className="text-xs text-gray-500 italic">→ {w.translation}</div>}
      </div>
      <div className="min-h-[64px] p-3 border-2 border-dashed border-primary-300 rounded-xl flex flex-wrap gap-2">
        {picked.map(p => (
          <button key={p.i} onClick={() => unpick(p)} className="px-3 py-1.5 bg-primary-700 text-white rounded-lg text-sm">{p.t}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {shuffled.map(p => {
          const used = picked.find(x => x.i === p.i)
          return (
            <button key={p.i} disabled={!!used} onClick={() => pick(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${used ? 'bg-gray-100 text-gray-400 line-through' : 'bg-white border border-rule'}`}>
              {p.t}
            </button>
          )
        })}
      </div>
      <button onClick={check} disabled={picked.length !== tokens.length} className="w-full p-3 bg-primary-700 text-white rounded-xl font-semibold disabled:opacity-50">Valider</button>
    </div>
  )
}
