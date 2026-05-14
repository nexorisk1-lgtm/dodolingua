'use client'
import { useState, useMemo } from 'react'
import type { GameProps } from './types'
import { shuffle, speak } from './utils'

interface Cell { id: string; type: 'word' | 'trans'; key: string; matched: boolean }

export function MemoryPairsGame({ words, voiceName, onResult, onComplete }: GameProps) {
  const pairs = useMemo(() => words.slice(0, 6), [words])
  const initial = useMemo(() => shuffle<Cell>(pairs.flatMap(w => [
    { id: `${w.id}-w`, type: 'word', key: w.id, matched: false },
    { id: `${w.id}-t`, type: 'trans', key: w.id, matched: false },
  ])), [pairs])
  const [cells, setCells] = useState<Cell[]>(initial)
  const [picked, setPicked] = useState<string[]>([])
  const [results, setResults] = useState<any[]>([])

  if (pairs.length < 4) {
    return <div className="text-center text-sm text-gray-500 py-8">Minimum 4 mots requis.</div>
  }

  function flip(id: string) {
    if (picked.length >= 2) return
    if (picked.includes(id)) return
    const next = [...picked, id]
    setPicked(next)
    if (next.length === 2) {
      const a = cells.find(c => c.id === next[0])!
      const b = cells.find(c => c.id === next[1])!
      const ok = a.key === b.key && a.type !== b.type
      const r = { correct: ok }
      onResult(r)
      const nr = [...results, r]
      setTimeout(() => {
        if (ok) {
          const nc = cells.map(c => c.key === a.key ? { ...c, matched: true } : c)
          setCells(nc); setResults(nr); setPicked([])
          if (nc.every(c => c.matched)) onComplete?.(nr)
        } else {
          setResults(nr); setPicked([])
        }
      }, 700)
    }
  }

  function findWord(id: string) { return pairs.find(p => p.id === id) }

  return (
    <div className="space-y-3">
      <p className="text-sm text-center text-gray-600">Trouve les paires (mot ↔ traduction)</p>
      <div className="grid grid-cols-3 gap-2">
        {cells.map(c => {
          const w = findWord(c.key)!
          const visible = c.matched || picked.includes(c.id)
          return (
            <button key={c.id} onClick={() => {
                flip(c.id)
                // v5 — auto-lecture du mot EN quand on retourne une carte "word"
                if (!c.matched && !picked.includes(c.id) && c.type === 'word') {
                  speak(w.lemma, voiceName)
                }
              }}
              className={`relative aspect-square rounded-xl border-2 flex items-center justify-center text-center text-sm font-semibold p-2 ${
                c.matched ? 'border-ok bg-green-50 text-ok' :
                visible ? 'border-primary-500 bg-primary-50 text-primary-900' :
                'border-rule bg-white text-transparent select-none'
              }`}>
              {visible ? (c.type === 'word' ? w.lemma : (w.translation || w.lemma)) : '★'}
              {/* v5 — Bouton 🔊 sur cartes retournées contenant le mot EN */}
              {visible && c.type === 'word' && !c.matched && (
                <span
                  role="button"
                  onClick={(e) => { e.stopPropagation(); speak(w.lemma, voiceName) }}
                  className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-[10px] flex items-center justify-center hover:bg-primary-200"
                  aria-label={`Écouter ${w.lemma}`}
                >🔊</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
