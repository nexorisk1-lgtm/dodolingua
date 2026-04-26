'use client'
import { useState, useMemo } from 'react'
import type { GameProps, GameWord } from './types'
import { shuffle } from './utils'
import { ConceptImage } from '@/components/ConceptImage'

/**
 * Association mot/image — n'inclut QUE les mots ayant une image.
 * Si moins de 4 mots avec image, le moteur de jeux exclut ce jeu.
 */
export function AssociationGame({ words: all, onResult, onComplete }: GameProps) {
  const words = all.filter(w => !!w.image_url)
  const pairs = useMemo(() => shuffle(words.slice(0, 6)), [words])
  const imagesShuffled = useMemo(() => shuffle(pairs), [pairs])
  const [matched, setMatched] = useState<Record<string, boolean>>({})
  const [selectedWord, setSelectedWord] = useState<string | null>(null)
  const [results, setResults] = useState<any[]>([])

  if (pairs.length < 4) {
    return <div className="text-center text-sm text-gray-500 py-8">Ce jeu nécessite au moins 4 mots avec image.</div>
  }

  function tryMatch(wordId: string, imageId: string) {
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
      setSelectedWord(null)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-center text-gray-600">Associe chaque mot à son image</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          {pairs.map(w => (
            <button key={w.id}
              disabled={matched[w.id]}
              onClick={() => setSelectedWord(w.id)}
              className={`w-full p-3 rounded-xl border-2 text-left font-semibold ${
                matched[w.id] ? 'border-ok bg-green-50 text-ok line-through' :
                selectedWord === w.id ? 'border-primary-500 bg-primary-50' :
                'border-rule bg-white'
              }`}>
              {w.lemma}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {imagesShuffled.map(w => (
            <button key={w.id}
              disabled={matched[w.id]}
              onClick={() => selectedWord && tryMatch(selectedWord, w.id)}
              className={`aspect-square rounded-xl border-2 overflow-hidden ${matched[w.id] ? 'opacity-30 border-ok' : 'border-rule hover:border-primary-500'}`}>
              <ConceptImage url={w.image_url!} alt={w.image_alt} variant="association" className="w-full h-full" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
