'use client'
import { useState } from 'react'
import type { GameProps } from './types'
import { speak } from './utils'
import { ConceptImage } from '@/components/ConceptImage'

export function FlashcardsGame({ words, voiceName, onResult, onComplete }: GameProps) {
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const w = words[idx]
  if (!w) return null

  function answer(grade: 'savais' | 'hesite' | 'pas_su') {
    const r = { correct: grade === 'savais', hesitated: grade === 'hesite' }
    onResult(r)
    const newResults = [...results, r]
    if (idx + 1 >= words.length) onComplete?.(newResults)
    else { setResults(newResults); setFlipped(false); setIdx(idx + 1) }
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-center text-gray-500">{idx + 1} / {words.length}</div>

      {/* Carte 3D qui se retourne au clic */}
      <div
        onClick={() => !flipped && setFlipped(true)}
        className="relative cursor-pointer"
        style={{ perspective: '1000px', minHeight: '260px' }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !flipped) setFlipped(true) }}
      >
        <div
          className="relative w-full transition-transform duration-500"
          style={{
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            minHeight: '260px',
          }}
        >
          {/* Face avant : le mot */}
          <div
            className="absolute inset-0 bg-white border border-rule rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-3 shadow-soft"
            style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
          >
            {w.image_url && <ConceptImage url={w.image_url} alt={w.image_alt} variant="flashcard" />}
            <div className="text-3xl font-extrabold text-primary-900">{w.lemma}</div>
            {w.ipa && <div className="font-mono text-primary-500 text-sm">{w.ipa}</div>}
            <button
              onClick={(e) => { e.stopPropagation(); speak(w.lemma, voiceName) }}
              className="text-sm bg-primary-50 text-primary-700 font-semibold px-4 py-1.5 rounded-full"
            >
              🔊 Écouter
            </button>
            <p className="text-xs text-gray-400 italic mt-2">Touche la carte pour la retourner</p>
          </div>

          {/* Face arrière : la traduction */}
          <div
            className="absolute inset-0 bg-primary-50 border border-primary-200 rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-3 shadow-soft"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            <div className="text-xs uppercase font-bold text-primary-500">Traduction</div>
            <div className="text-2xl font-bold text-primary-900">{w.translation || '—'}</div>
            {w.example && <div className="text-sm italic text-gray-600 mt-2">"{w.example}"</div>}
            <p className="text-xs text-gray-500 italic mt-3">Comment t&apos;en es-tu sortie ?</p>
          </div>
        </div>
      </div>

      {/* Boutons d'auto-évaluation : visibles uniquement après retournement */}
      {flipped ? (
        <div className="space-y-2">
          <button onClick={() => answer('savais')} className="w-full p-3 rounded-xl border-2 border-ok text-ok font-semibold bg-white hover:bg-green-50">
            ✅ Je savais
          </button>
          <button onClick={() => answer('hesite')} className="w-full p-3 rounded-xl border-2 border-rule text-gray-700 font-semibold bg-white hover:bg-gray-50">
            🤔 J&apos;ai hésité
          </button>
          <button onClick={() => answer('pas_su')} className="w-full p-3 rounded-xl border-2 border-warn text-warn font-semibold bg-white hover:bg-red-50">
            ❌ Je ne savais pas
          </button>
        </div>
      ) : (
        <p className="text-center text-sm text-gray-500">↑ Touche la carte pour révéler la traduction</p>
      )}
    </div>
  )
}
