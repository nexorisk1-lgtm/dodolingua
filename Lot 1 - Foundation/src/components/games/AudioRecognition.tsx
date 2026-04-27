'use client'

import { useState, useMemo, useEffect } from 'react'

import type { GameProps } from './types'

import { shuffle, pickDistractors, speak } from './utils'

import { Mascot } from '@/components/Mascot'

import { celebrate, playSound, randomEncouragement, randomSupport } from '@/lib/celebration'

export function AudioRecognitionGame({ words, voiceName, onResult, onComplete }: GameProps) {

  const [idx, setIdx] = useState(0)

  const [picked, setPicked] = useState<string | null>(null)

  const [results, setResults] = useState<any[]>([])

  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)

  const w = words[idx]

  const choices = useMemo(() => w ? shuffle([w, ...pickDistractors(words, w, 3)]) : [], [idx, w, words])

  useEffect(() => {

    if (w) setTimeout(() => speak(w.lemma, voiceName), 300)

  }, [idx, w, voiceName])

  useEffect(() => { if (feedback) playSound(feedback.ok ? 'success' : 'error') }, [feedback])

  if (!w) return null

  function pick(id: string) {

    if (picked) return

    setPicked(id)

    const correct = id === w.id

    const r = { correct }

    onResult(r); setResults([...results, r])

    if (correct) {

      setFeedback({ ok: true, msg: randomEncouragement() })

      celebrate('small')

    } else {

      setFeedback({ ok: false, msg: randomSupport() })

    }

    setTimeout(() => {

      setFeedback(null)

      if (idx + 1 >= words.length) {

        const allResults = [...results, r]

        const correctCount = allResults.filter(x => x.correct).length

        if (correctCount === words.length) celebrate('big')

        onComplete?.(allResults)

      } else {

        setPicked(null); setIdx(idx + 1)

      }

    }, correct ? 1200 : 2200)

  }

  const isWrong = picked && picked !== w.id

  return (

    <div className="space-y-4">

      <div className="text-xs text-center text-gray-500">{idx + 1} / {words.length}</div>

      <div className="bg-white border border-rule rounded-2xl p-6 text-center">

        <p className="text-sm text-gray-500 mb-2">Quel mot entends-tu ?</p>

        <button onClick={() => speak(w.lemma, voiceName)} className="text-5xl">🔊</button>

      </div>

      <div className={`space-y-2 ${isWrong ? 'animate-shake' : ''}`}>

        {choices.map(c => {

          const isCorrectAnswer = c.id === w.id

          const isPickedWrong = picked === c.id && c.id !== w.id

          const showAsCorrect = picked && isCorrectAnswer

          return (

            <button key={c.id} onClick={() => pick(c.id)} disabled={!!picked}

              className={`w-full p-3 rounded-xl border-2 font-semibold transition-all ${

                showAsCorrect ? 'border-ok bg-green-50 text-ok scale-[1.02]' :

                isPickedWrong ? 'border-warn bg-red-50 text-warn line-through opacity-70' :

                'border-rule bg-white hover:border-primary-300'

              }`}>

              {c.lemma}

              {showAsCorrect && ' ✅ Bonne réponse'}

              {isPickedWrong && ' ❌'}

            </button>

          )

        })}

      </div>

      {feedback && (

        <div className={`flex items-center gap-3 p-3 rounded-2xl border-2 animate-pop-in ${feedback.ok ? 'bg-green-50 border-ok' : 'bg-red-50 border-red-200'}`}>

          <Mascot pose={feedback.ok ? 'happy' : 'sad'} size={64} animation={feedback.ok ? 'bounce' : 'shake'} />

          <div className="flex-1">

            <div className={`font-display font-bold text-lg ${feedback.ok ? 'text-ok' : 'text-warn'}`}>

              {feedback.msg}

            </div>

            {!feedback.ok && (

              <div className="text-sm text-gray-700 mt-1">

                Le mot entendu : <b className="text-ok">{w.lemma}</b>

                <button onClick={() => speak(w.lemma, voiceName)} className="ml-2 text-xs bg-white border border-rule px-2 py-0.5 rounded-full">🔊</button>

              </div>

            )}

          </div>

        </div>

      )}

    </div>

  )

}
