'use client'
import { useState } from 'react'
import type { GameProps } from './types'
import { speak } from './utils'
import { ConceptImage } from '@/components/ConceptImage'

export function FlashcardsGame({ words, voiceName, onResult, onComplete }: GameProps) {
  const [idx, setIdx] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const w = words[idx]
  if (!w) return null

  function answer(grade: 'savais' | 'hesite' | 'pas_su') {
    const r = { correct: grade === 'savais', hesitated: grade === 'hesite' }
    onResult(r)
    const newResults = [...results, r]
    if (idx + 1 >= words.length) onComplete?.(newResults)
    else { setResults(newResults); setRevealed(false); setIdx(idx + 1) }
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-center text-gray-500">{idx + 1} / {words.length}</div>
      <div className="bg-white border border-rule rounded-2xl p-6 text-center space-y-3">
        {w.image_url && <div className="flex justify-center"><ConceptImage url={w.image_url} alt={w.image_alt} variant="flashcard" /></div>}
        <div className="text-3xl font-extrabold text-primary-900">{w.lemma}</div>
        {w.ipa && <div className="font-mono text-primary-500 text-sm">{w.ipa}</div>}
        <button onClick={() => speak(w.lemma, voiceName)} className="text-sm bg-primary-50 text-primary-700 font-semibold px-4 py-1.5 rounded-full">🔊 Écouter</button>
        {revealed && w.translation && (
          <div className="pt-3 border-t border-rule text-gray-700">
            <div className="font-semibold">{w.translation}</div>
            {w.example && <div className="text-sm italic text-gray-500 mt-1">{w.example}</div>}
          </div>
        )}
      </div>
      {!revealed ? (
        <button onClick={() => setRevealed(true)} className="w-full p-3 bg-primary-700 text-white rounded-xl font-semibold">Révéler</button>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-center text-gray-600">As-tu retrouvé ce mot ?</p>
          <button onClick={() => answer('savais')} className="w-full p-3 rounded-xl border-2 border-ok text-ok font-semibold">✅ Je savais</button>
          <button onClick={() => answer('hesite')} className="w-full p-3 rounded-xl border-2 border-rule text-gray-700 font-semibold">🤔 J&apos;ai hésité</button>
          <button onClick={() => answer('pas_su')} className="w-full p-3 rounded-xl border-2 border-warn text-warn font-semibold">❌ Je ne savais pas</button>
        </div>
      )}
    </div>
  )
}
