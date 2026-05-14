'use client'
import { useState, useMemo } from 'react'
import type { GameProps } from './types'
import { shuffle, speak } from './utils'

/**
 * Sentence Builder — "Mise en contexte"
 * v5 (2026-05) — Refonte UX :
 *   1. Après bonne réponse : affichage de la phrase complète EN + traduction FR
 *      + haut-parleur TTS pour écouter la phrase entière.
 *   2. Plus de passage automatique à la phrase suivante : l'apprenant·e prend le
 *      temps de lire/écouter et choisit explicitement de continuer.
 *   3. Deux actions explicites en bas : "Suivant" (mot d'après) ou
 *      "Continuer plus tard" (mise en pause de la session, garde la progression).
 *
 * Compat avec utilisateurs speaking-only : tous les blocs ont un haut-parleur.
 */
export function SentenceBuilderGame({ words, voiceName, onResult, onComplete, onPause }: GameProps) {
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
    // v5 — Plus de setTimeout auto : on attend que l'apprenant·e clique sur "Suivant"
  }

  function goNext() {
    setFeedback(null)
    if (idx + 1 >= words.length) {
      onComplete?.(results)
    } else {
      setPicked([])
      setIdx(idx + 1)
    }
  }

  function pauseSession() {
    // v5 — "Continuer plus tard" : conserve la progression et met la session en pause.
    if (onPause) onPause(results)
    else onComplete?.(results) // fallback : ferme proprement si pas de handler de pause
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-center text-gray-500">{idx + 1} / {words.length}</div>

      {/* Bloc consigne : mot à mettre en contexte */}
      <div className="bg-white border border-rule rounded-2xl p-4 text-center">
        <div className="text-sm text-gray-500 mb-1">Reforme la phrase</div>
        <div className="font-bold text-primary-700">{w.lemma}</div>
        {w.translation && <div className="text-xs text-gray-500 italic">→ {w.translation}</div>}
      </div>

      {/* Zone de construction (mots posés) */}
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

      {/* v5 — Feedback enrichi : phrase complète + TTS + traduction FR si dispo */}
      {feedback && feedback.correct && (
        <div className="border-l-4 border-ok bg-green-50 p-4 rounded-r-lg space-y-2">
          <div className="text-sm font-bold text-ok">✓ Bravo !</div>
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <div className="text-base font-semibold text-primary-900">{feedback.expected}</div>
              {w.example_fr && (
                <div className="text-sm italic text-gray-600 mt-1">→ {w.example_fr}</div>
              )}
            </div>
            <button
              onClick={() => speak(feedback.expected, voiceName)}
              aria-label="Écouter la phrase complète"
              className="shrink-0 w-10 h-10 rounded-full bg-primary-50 text-primary-700 text-lg hover:bg-primary-100"
            >
              🔊
            </button>
          </div>
        </div>
      )}

      {feedback && !feedback.correct && (
        <div className="border-l-4 border-warn bg-yellow-50 p-4 rounded-r-lg space-y-2">
          <div className="text-[10px] uppercase font-bold text-warn">💡 Correction</div>
          <div className="text-sm text-gray-500 line-through">{feedback.given}</div>
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <div className="text-base font-semibold text-ok">{feedback.expected}</div>
              {w.example_fr && (
                <div className="text-sm italic text-gray-600 mt-1">→ {w.example_fr}</div>
              )}
            </div>
            <button
              onClick={() => speak(feedback.expected, voiceName)}
              aria-label="Écouter la phrase complète"
              className="shrink-0 w-10 h-10 rounded-full bg-primary-50 text-primary-700 text-lg hover:bg-primary-100"
            >
              🔊
            </button>
          </div>
        </div>
      )}

      {/* Banque de mots à piocher (cachée pendant le feedback) */}
      {!feedback && (
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
      )}

      {/* v5 — Actions : Valider OU (après feedback) Suivant + Continuer plus tard */}
      {!feedback ? (
        <button onClick={check} disabled={picked.length !== tokens.length}
          className="w-full p-3 bg-primary-700 text-white rounded-xl font-semibold disabled:opacity-50">
          Valider
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={pauseSession}
            className="p-3 bg-white border-2 border-rule text-gray-700 rounded-xl font-semibold hover:bg-gray-50">
            ⏸ Continuer plus tard
          </button>
          <button onClick={goNext}
            className="p-3 bg-primary-700 text-white rounded-xl font-semibold hover:bg-primary-900">
            {idx + 1 >= words.length ? '✓ Terminer' : 'Suivant →'}
          </button>
        </div>
      )}
    </div>
  )
}
