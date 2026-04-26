'use client'
import { useState } from 'react'
import type { GameProps } from './types'
import { speak } from './utils'

interface Step { prompt: string; choices: { text: string; ok: boolean; word_id?: string }[] }

/**
 * Mini-CYOA généré localement à partir des mots fournis.
 * Pour le Lot 5, ces stories pourront être générées par Gemini.
 */
function buildStory(words: GameProps['words']): Step[] {
  const w = words.slice(0, 5)
  if (w.length === 0) return []
  return [
    {
      prompt: 'You arrive at a small London café. The waiter looks at you. What do you say?',
      choices: [
        { text: `"${w[0]?.lemma || 'Hello'}, a table for two please."`, ok: true, word_id: w[0]?.id },
        { text: '*stay silent*', ok: false },
        { text: `"${w[1]?.lemma || 'Goodbye'}!"`, ok: false, word_id: w[1]?.id },
      ],
    },
    {
      prompt: 'The waiter brings the menu. You want to order tea.',
      choices: [
        { text: `"I would like ${w[2]?.lemma || 'tea'}, ${w[3]?.lemma || 'please'}."`, ok: true, word_id: w[2]?.id },
        { text: '"Tea now!"', ok: false },
        { text: '"Bring me something."', ok: false },
      ],
    },
    {
      prompt: 'After the meal, the bill arrives. You want to thank the waiter.',
      choices: [
        { text: `"${w[4]?.lemma || 'Thank you'} very much."`, ok: true, word_id: w[4]?.id },
        { text: '*nod and leave*', ok: false },
        { text: '"Bye."', ok: false },
      ],
    },
  ]
}

export function StoryChoiceGame({ words, voiceName, onResult, onComplete }: GameProps) {
  const story = buildStory(words)
  const [step, setStep] = useState(0)
  const [results, setResults] = useState<any[]>([])
  const s = story[step]
  if (!s) return <div className="text-center text-sm text-gray-500 py-8">Pas assez de mots pour une histoire.</div>

  function pick(c: typeof s.choices[number]) {
    const r = { correct: c.ok }
    onResult(r)
    const nr = [...results, r]
    setResults(nr)
    if (step + 1 >= story.length) onComplete?.(nr)
    else setTimeout(() => setStep(step + 1), 800)
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-center text-gray-500">Scène {step + 1} / {story.length}</div>
      <div className="bg-white border border-rule rounded-2xl p-4 space-y-2">
        <p className="text-sm leading-relaxed">{s.prompt}</p>
        <button onClick={() => speak(s.prompt, voiceName)} className="text-xs bg-primary-50 text-primary-700 px-2 py-1 rounded">🔊</button>
      </div>
      <div className="space-y-2">
        {s.choices.map((c, i) => (
          <button key={i} onClick={() => pick(c)} className="w-full p-3 rounded-xl border-2 border-rule bg-white text-left hover:border-primary-500">
            {c.text}
          </button>
        ))}
      </div>
    </div>
  )
}
