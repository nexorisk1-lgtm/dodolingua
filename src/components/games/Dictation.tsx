'use client'
import { useState, useEffect } from 'react'
import type { GameProps } from './types'
import { speak } from './utils'

function similarity(a: string, b: string): number {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '').trim()
  const A = norm(a), B = norm(b)
  if (A === B) return 1
  if (A.length === 0 || B.length === 0) return 0
  let matches = 0
  for (let i = 0; i < Math.min(A.length, B.length); i++) if (A[i] === B[i]) matches++
  return matches / Math.max(A.length, B.length)
}

export function DictationGame({ words, voiceName, onResult, onComplete }: GameProps) {
  const [idx, setIdx] = useState(0)
  const [val, setVal] = useState('')
  const [shown, setShown] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const w = words[idx]

  useEffect(() => {
    if (w) setTimeout(() => speak(w.lemma, voiceName), 300)
  }, [idx, w, voiceName])

  if (!w) return null

  const score = shown ? similarity(val, w.lemma) : 0
  const isCorrect = score >= 0.9
  const isWrong = shown && !isCorrect

  function check() {
    const s = similarity(val, w.lemma)
    const r = { correct: s >= 0.9, hesitated: s >= 0.6 && s < 0.9 }
    setShown(true)
    onResult(r)
    setResults([...results, r])
    setTimeout(() => {
      if (idx + 1 >= words.length) onComplete?.([...results, r])
      else { setVal(''); setShown(false); setIdx(idx + 1) }
    }, isCorrect ? 1200 : 2200)
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-center text-gray-500">{idx + 1} / {words.length}</div>
      <div className="bg-white border border-rule rounded-2xl p-6 text-center space-y-3">
        <div className="text-sm text-gray-500">Écoute et écris ce que tu entends</div>
        <button onClick={() => speak(w.lemma, voiceName)} className="text-3xl">🔊</button>
        <div className="flex gap-2 justify-center text-xs">
          <button onClick={() => speak(w.lemma, voiceName, 0.5)} className="px-2 py-1 border border-rule rounded">0.5×</button>
          <button onClick={() => speak(w.lemma, voiceName, 1)} className="px-2 py-1 border border-primary-500 text-primary-700 bg-primary-50 rounded font-semibold">1×</button>
        </div>
      </div>
      <input value={val} onChange={e => setVal(e.target.value)}
        disabled={shown} placeholder="Tape ce que tu entends…"
        className={`w-full p-3 border-2 rounded-xl text-center text-lg ${
          isCorrect ? 'border-ok bg-green-50 text-ok' :
          isWrong ? 'border-warn bg-red-50 text-warn line-through' :
          'border-rule'
        }`} />
      {shown && (
        <div className={`text-center p-3 rounded-xl border-2 ${isCorrect ? 'bg-green-50 border-ok' : 'bg-red-50 border-red-200'}`}>
          {isCorrect ? (
            <div className="text-ok font-semibold">✅ Bonne réponse : <b>{w.lemma}</b></div>
          ) : (
            <div className="text-warn">
              <div className="font-semibold">❌ La bonne orthographe était :</div>
              <div className="text-2xl font-extrabold text-ok mt-1">{w.lemma}</div>
              {w.translation && <div className="text-xs text-gray-600 italic mt-1">→ {w.translation}</div>}
            </div>
          )}
        </div>
      )}
      <button onClick={check} disabled={shown || !val} className="w-full p-3 bg-primary-700 text-white rounded-xl font-semibold disabled:opacity-50">
        Valider
      </button>
    </div>
  )
}
