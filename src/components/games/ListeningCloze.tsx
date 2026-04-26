'use client'
import { useState, useEffect } from 'react'
import type { GameProps } from './types'
import { speak } from './utils'

export function ListeningClozeGame({ words, voiceName, onResult, onComplete }: GameProps) {
  const [idx, setIdx] = useState(0)
  const [val, setVal] = useState('')
  const [shown, setShown] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const w = words[idx]
  const sentence = w?.example || (w ? `Please ${w.lemma} now.` : '')
  const masked = sentence.replace(new RegExp(`\\b${w?.lemma || ''}\\b`, 'i'), '____')

  useEffect(() => {
    if (w) setTimeout(() => speak(sentence, voiceName), 300)
  }, [idx, w, sentence, voiceName])

  if (!w) return null

  function check() {
    const ok = val.toLowerCase().trim() === w.lemma.toLowerCase().trim()
    const r = { correct: ok }
    setShown(true); onResult(r); setResults([...results, r])
    setTimeout(() => {
      if (idx + 1 >= words.length) onComplete?.([...results, r])
      else { setVal(''); setShown(false); setIdx(idx + 1) }
    }, 1200)
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-center text-gray-500">{idx + 1} / {words.length}</div>
      <div className="bg-white border border-rule rounded-2xl p-6 text-center">
        <div className="text-sm text-gray-500 mb-2">Écoute et complète</div>
        <button onClick={() => speak(sentence, voiceName)} className="text-3xl">🔊</button>
        <div className="mt-3 text-lg font-semibold text-primary-900">{masked}</div>
      </div>
      <input value={val} onChange={e => setVal(e.target.value)}
        disabled={shown} placeholder="Le mot manquant…"
        className="w-full p-3 border-2 border-rule rounded-xl text-center" />
      {shown && <div className="text-center text-primary-700 font-bold">{w.lemma}</div>}
      <button onClick={check} disabled={shown || !val} className="w-full p-3 bg-primary-700 text-white rounded-xl font-semibold disabled:opacity-50">Valider</button>
    </div>
  )
}
