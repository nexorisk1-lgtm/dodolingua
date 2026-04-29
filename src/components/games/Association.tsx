'use client'
import { useState, useMemo } from 'react'
import type { GameProps, GameWord } from './types'
import { shuffle } from './utils'
import { ConceptImage } from '@/components/ConceptImage'

/**
 * Association mot/image — n'inclut QUE les mots ayant une image.
 * Si moins de 4 mots avec image, le moteur de jeux exclut ce jeu.
 *
 * v1.3 — Feedback visuel rouge sur mauvaise association (500ms),
 * puis désélection automatique. Vert maintenu sur paires validées.
 */
export function AssociationGame({ words: all, onResult, onComplete }: GameProps) {
  const words = all.filter(w => !!w.image_url)
  const pairs = useMemo(() => shuffle(words.slice(0, 6)), [words])
  const imagesShuffled = useMemo(() => shuffle(pairs), [pairs])
  const [matched, setMatched] = useState<Record<string, boolean>>({})
  const [selectedWord, setSelectedWord] = useState<string | null>(null)
  const [wrongFlash, setWrongFlash] = useState<{ wordId: string; imageId: string } | null>(null)
  const [results, setResults] = useState<any[]>([])

  if (pairs.length < 4) {
    return <div className="text-center text-sm text-gray-500 py-8">Ce jeu nécessite au moins 4 mots avec image.</div>
  }

  function tryMatch(wordId: string, imageId: string) {
    if (wrongFlash) return
    const ok = wordId === imageId
    const r = { correct: ok }
    onResult(r)
    setResults(prev => [...prev, r])
    if (ok) {
      const next = { ...matched, [wordId]: true }
      setMatched(next)
      setSelectedWord(null)
      if (Object.keys(next).length === pairs.length) {
        setTimeout(() => onComplete?.([...results, r]), 600)
      }
    } else {
      // v1.3 — flash rouge 500ms avant désélection
      setWrongFlash({ wordId, imageId })
      setTimeout(() => {
        setWrongFlash(null)
        setSelectedWord(null)
      }, 500)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-center text-gray-600">Associe chaque mot à son image</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          {pairs.map(w => {
            const isWrongFlashed = wrongFlash?.wordId === w.id
            return (
              <button key={w.id}
                disabled={matched[w.id] || !!wrongFlash}
                onClick={() => setSelectedWord(w.id)}
                className={`w-full p-3 rounded-xl border-2 text-left font-semibold transition-colors ${
                  matched[w.id] ? 'border-ok bg-green-50 text-ok line-through' :
                  isWrongFlashed ? 'border-warn bg-red-100 text-warn' :
                  selectedWord === w.id ? 'border-primary-500 bg-primary-50' :
                  'border-rule bg-white'
                }`}>
                {w.lemma}
              </button>
            )
          })}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {imagesShuffled.map(w => {
            const isWrongFlashed = wrongFlash?.imageId === w.id
            return (
              <button key={w.id}
                disabled={matched[w.id] || !!wrongFlash}
                onClick={() => selectedWord && tryMatch(selectedWord, w.id)}
                className={`aspect-square rounded-xl border-2 overflow-hidden transition-colors ${
                  matched[w.id] ? 'opacity-30 border-ok' :
                  isWrongFlashed ? 'border-warn ring-4 ring-red-200' :
                  'border-rule hover:border-primary-500'
                }`}>
                <ConceptImage url={w.image_url!} alt={w.image_alt} variant="association" className="w-full h-full" />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
