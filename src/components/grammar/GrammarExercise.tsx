'use client'
import { useMemo, useState } from 'react'
import { shuffle, speak } from '@/components/games/utils'

export interface GrammarExerciseData {
  id: string
  topic_id: string
  type: 'mcq' | 'fill_blank' | 'reorder' | 'translate'
  question: string
  options_json: string[] | null
  answer: string
  explanation_fr: string | null
  position: number
}

interface Props {
  exercise: GrammarExerciseData
  voiceName?: string | null
  onResult: (correct: boolean) => void
  onNext: () => void
  isLast: boolean
}

/**
 * v5 — Rend un exercice de grammaire selon son type (mcq / fill_blank / reorder / translate).
 *
 * Toujours :
 *  - bouton 🔊 sur la question quand elle contient une phrase EN à entendre
 *  - bouton 🔊 sur la réponse correcte après validation
 *  - explication FR + bouton "Suivant" (pas de passage auto, cohérent avec SentenceBuilder)
 */
export function GrammarExercise({ exercise, voiceName, onResult, onNext, isLast }: Props) {
  const [feedback, setFeedback] = useState<{ correct: boolean; userAnswer: string } | null>(null)
  const [userText, setUserText] = useState('')
  const [picked, setPicked] = useState<string | null>(null)
  const [reorderTokens, setReorderTokens] = useState<{ t: string; i: number }[]>([])

  const tokens = useMemo(() => {
    if (exercise.type !== 'reorder') return []
    return exercise.question.split(/\s*\/\s*/).filter(Boolean)
  }, [exercise])

  const shuffledReorder = useMemo(() => {
    return shuffle(tokens.map((t, i) => ({ t, i })))
  }, [tokens])

  function check(userAnswer: string) {
    const norm = (s: string) => s.toLowerCase().replace(/[.,!?;:]/g, '').trim().replace(/\s+/g, ' ')
    const correct = norm(userAnswer) === norm(exercise.answer)
    setFeedback({ correct, userAnswer })
    onResult(correct)
  }

  function reset() {
    setFeedback(null)
    setUserText('')
    setPicked(null)
    setReorderTokens([])
    onNext()
  }

  return (
    <div className="space-y-4">
      {/* Bloc question */}
      <div className="bg-white border border-rule rounded-2xl p-4">
        <div className="text-[10px] uppercase font-bold text-primary-500 tracking-wider mb-2">
          {exercise.type === 'mcq' && 'Choisis la bonne réponse'}
          {exercise.type === 'fill_blank' && 'Complète la phrase'}
          {exercise.type === 'reorder' && 'Remets les mots dans l\'ordre'}
          {exercise.type === 'translate' && 'Traduis en anglais'}
        </div>
        <div className="text-base font-semibold text-primary-900 flex items-start gap-2">
          <span className="flex-1">{exercise.question}</span>
          {/* TTS uniquement quand la question contient de l'anglais (pas pour translate FR → EN) */}
          {exercise.type !== 'translate' && (
            <button
              onClick={() => speak(exercise.question.replace(/___/g, exercise.answer).replace(/\s*\/\s*/g, ' '), voiceName)}
              aria-label="Écouter la question"
              className="shrink-0 w-9 h-9 rounded-full bg-primary-50 text-primary-700 text-base hover:bg-primary-100"
            >
              🔊
            </button>
          )}
        </div>
      </div>

      {/* Zone de réponse selon le type */}
      {!feedback && exercise.type === 'mcq' && exercise.options_json && (
        <div className="space-y-2">
          {exercise.options_json.map(opt => (
            <button
              key={opt}
              onClick={() => { setPicked(opt); check(opt) }}
              disabled={!!picked}
              className="w-full p-3 rounded-xl border-2 border-rule bg-white text-left font-semibold hover:bg-primary-50"
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {!feedback && (exercise.type === 'fill_blank' || exercise.type === 'translate') && (
        <form onSubmit={e => { e.preventDefault(); check(userText) }} className="space-y-2">
          <input
            type="text"
            autoFocus
            value={userText}
            onChange={e => setUserText(e.target.value)}
            placeholder={exercise.type === 'fill_blank' ? 'Le mot manquant…' : 'Traduction anglaise…'}
            className="w-full p-3 border-2 border-rule rounded-xl font-semibold focus:border-primary-500 outline-none"
          />
          <button type="submit" disabled={!userText.trim()}
            className="w-full p-3 bg-primary-700 text-white rounded-xl font-semibold disabled:opacity-50">
            Valider
          </button>
        </form>
      )}

      {!feedback && exercise.type === 'reorder' && (
        <>
          <div className="min-h-[56px] p-3 border-2 border-dashed border-primary-300 rounded-xl flex flex-wrap gap-2">
            {reorderTokens.map(p => (
              <button key={p.i} onClick={() => setReorderTokens(reorderTokens.filter(x => x.i !== p.i))}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-primary-700 text-white">
                {p.t}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {shuffledReorder.map(p => {
              const used = reorderTokens.find(x => x.i === p.i)
              return (
                <button key={p.i} disabled={!!used}
                  onClick={() => setReorderTokens([...reorderTokens, p])}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${used ? 'bg-gray-100 text-gray-400 line-through' : 'bg-white border border-rule'}`}>
                  {p.t}
                </button>
              )
            })}
          </div>
          <button
            disabled={reorderTokens.length !== tokens.length}
            onClick={() => check(reorderTokens.map(p => p.t).join(' '))}
            className="w-full p-3 bg-primary-700 text-white rounded-xl font-semibold disabled:opacity-50">
            Valider
          </button>
        </>
      )}

      {/* Feedback : explication FR + TTS + bouton Suivant */}
      {feedback && (
        <div className={`border-l-4 p-4 rounded-r-lg space-y-2 ${feedback.correct ? 'border-ok bg-green-50' : 'border-warn bg-yellow-50'}`}>
          <div className={`text-sm font-bold ${feedback.correct ? 'text-ok' : 'text-warn'}`}>
            {feedback.correct ? '✓ Correct !' : '✗ Pas tout à fait.'}
          </div>
          {!feedback.correct && (
            <div className="text-sm text-gray-500">
              Ta réponse : <span className="line-through">{feedback.userAnswer || '—'}</span>
            </div>
          )}
          <div className="flex items-start gap-2">
            <div className="flex-1 text-sm font-semibold text-ok">
              Bonne réponse : {exercise.answer}
            </div>
            <button
              onClick={() => speak(exercise.answer, voiceName)}
              aria-label="Écouter la bonne réponse"
              className="shrink-0 w-9 h-9 rounded-full bg-primary-50 text-primary-700 text-base hover:bg-primary-100"
            >
              🔊
            </button>
          </div>
          {exercise.explanation_fr && (
            <div className="text-xs italic text-gray-600">💡 {exercise.explanation_fr}</div>
          )}
          <button onClick={reset}
            className="w-full mt-2 p-3 bg-primary-700 text-white rounded-xl font-semibold hover:bg-primary-900">
            {isLast ? '✓ Terminer la leçon' : 'Suivant →'}
          </button>
        </div>
      )}
    </div>
  )
}
