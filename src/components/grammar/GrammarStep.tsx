'use client'
import { useState, useMemo } from 'react'
import { shuffle, speak } from '@/components/games/utils'

/**
 * v5 — Affichage d'UNE étape d'une micro-séquence grammaticale.
 *
 * Types d'étapes :
 *  - discover : intro courte (1-2 phrases) qui pose le contexte
 *  - concept  : mini-règle isolée (1 phrase, 1 idée)
 *  - structure: formule visuelle colorée (Sujet + BE + complément)
 *  - tip      : astuce/contractions
 *  - practice : 1 exercice ciblé (mcq / fill_blank / reorder / translate)
 *  - recap    : 2-3 exercices mélangés sans aide
 */

export interface StepContent {
  text?: string
  highlight?: string[]
  formula?: { label: string; color: string }[]
  exercise_type?: 'mcq' | 'fill_blank' | 'reorder' | 'translate'
  question?: string
  options?: string[]
  answer?: string
  explanation?: string
  intro?: string
  exercises?: Array<{
    exercise_type: string
    question: string
    options?: string[]
    answer: string
  }>
}

export interface Step {
  id: string
  position: number
  type: 'discover' | 'concept' | 'practice' | 'structure' | 'tip' | 'recap'
  content_json: StepContent
}

interface Props {
  step: Step
  voiceName?: string | null
  onContinue: (correct?: boolean) => void
  isLast: boolean
}

// v5 — Code couleur grammatical aligné sur la convention DodoLingua existante
// (rule_md des grammar_topics : Sujet=BLEU, Verbe=ROUGE, Complément=VERT).
const COLOR_MAP: Record<string, string> = {
  blue:   'bg-primary-500 text-white',     // Sujet
  red:    'bg-warn text-white',            // Verbe
  green:  'bg-ok text-white',              // Complément
  yellow: 'bg-yellow-400 text-gray-900',   // Auxiliaire (do/does)
  purple: 'bg-purple-500 text-white',      // Adverbe / mot de liaison
  white:  'bg-white text-gray-700 border border-rule',  // Autres
}

/* ---------- Sous-composants par type ---------- */

function MarkdownLite({ text }: { text: string }) {
  // Parse **bold** uniquement (suffisant pour notre usage)
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**')
          ? <strong key={i} className="text-primary-700 font-bold">{p.slice(2, -2)}</strong>
          : <span key={i}>{p}</span>
      )}
    </>
  )
}

function StepDiscover({ step }: { step: Step }) {
  return (
    <div className="space-y-3">
      <div className="text-3xl">💡</div>
      <div className="text-base leading-relaxed text-gray-800">
        <MarkdownLite text={step.content_json.text || ''} />
      </div>
    </div>
  )
}

function StepConcept({ step }: { step: Step }) {
  return (
    <div className="space-y-3">
      <div className="text-2xl">🎯</div>
      <div className="text-lg font-medium leading-relaxed text-gray-900">
        <MarkdownLite text={step.content_json.text || ''} />
      </div>
    </div>
  )
}

function StepStructure({ step }: { step: Step }) {
  const formula = step.content_json.formula || []
  return (
    <div className="space-y-4">
      <div className="text-2xl">📐</div>
      <div className="text-base text-gray-800">
        <MarkdownLite text={step.content_json.text || ''} />
      </div>
      {formula.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2 p-4 bg-gray-50 rounded-xl">
          {formula.map((slot, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className={`px-3 py-1.5 rounded-lg text-sm font-bold ${COLOR_MAP[slot.color] || COLOR_MAP.white}`}>
                {slot.label}
              </span>
              {i < formula.length - 1 && <span className="text-gray-400 text-xl">+</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StepTip({ step }: { step: Step }) {
  return (
    <div className="border-l-4 border-amber-400 bg-amber-50 p-4 rounded-r-lg space-y-2">
      <div className="text-xs uppercase font-bold text-amber-700">💡 À retenir</div>
      <div className="text-sm leading-relaxed text-gray-800">
        <MarkdownLite text={step.content_json.text || ''} />
      </div>
    </div>
  )
}

/* ---------- Étape PRATIQUE (1 exercice) ---------- */

function StepPractice({ step, voiceName, onContinue }: { step: Step; voiceName?: string | null; onContinue: (correct: boolean) => void }) {
  const c = step.content_json
  const [feedback, setFeedback] = useState<{ correct: boolean; userAnswer: string } | null>(null)
  const [userText, setUserText] = useState('')
  const [reorderTokens, setReorderTokens] = useState<{ t: string; i: number }[]>([])

  const tokens = useMemo(() => {
    if (c.exercise_type !== 'reorder') return []
    return (c.question || '').split(/\s*\/\s*/).filter(Boolean)
  }, [c])
  const shuffledReorder = useMemo(() => shuffle(tokens.map((t, i) => ({ t, i }))), [tokens])

  function check(answer: string) {
    const norm = (s: string) => s.toLowerCase().replace(/[.,!?;:]/g, '').trim().replace(/\s+/g, ' ')
    const correct = norm(answer) === norm(c.answer || '')
    setFeedback({ correct, userAnswer: answer })
  }

  return (
    <div className="space-y-4">
      <div className="text-xs uppercase font-bold text-primary-500 tracking-wider">
        ✏️ Pratique
      </div>

      <div className="bg-white border border-rule rounded-xl p-4 flex items-start gap-2">
        <div className="flex-1 text-base font-medium text-primary-900">{c.question}</div>
        {c.exercise_type !== 'translate' && (
          <button
            onClick={() => speak((c.question || '').replace(/___/g, c.answer || '').replace(/\s*\/\s*/g, ' '), voiceName)}
            aria-label="Écouter"
            className="shrink-0 w-9 h-9 rounded-full bg-primary-50 text-primary-700 hover:bg-primary-100"
          >🔊</button>
        )}
      </div>

      {!feedback && c.exercise_type === 'mcq' && c.options && (
        <div className="space-y-2">
          {c.options.map(opt => (
            <button key={opt} onClick={() => check(opt)}
              className="w-full p-3 rounded-xl border-2 border-rule bg-white text-left font-semibold hover:bg-primary-50">
              {opt}
            </button>
          ))}
        </div>
      )}

      {!feedback && (c.exercise_type === 'fill_blank' || c.exercise_type === 'translate') && (
        <form onSubmit={e => { e.preventDefault(); check(userText) }} className="space-y-2">
          <input type="text" autoFocus value={userText} onChange={e => setUserText(e.target.value)}
            placeholder={c.exercise_type === 'fill_blank' ? 'Le mot manquant…' : 'Traduction anglaise…'}
            className="w-full p-3 border-2 border-rule rounded-xl font-semibold focus:border-primary-500 outline-none" />
          <button type="submit" disabled={!userText.trim()}
            className="w-full p-3 bg-primary-700 text-white rounded-xl font-semibold disabled:opacity-50">
            Valider
          </button>
        </form>
      )}

      {!feedback && c.exercise_type === 'reorder' && (
        <>
          <div className="min-h-[56px] p-3 border-2 border-dashed border-primary-300 rounded-xl flex flex-wrap gap-2">
            {reorderTokens.map(p => (
              <button key={p.i} onClick={() => setReorderTokens(reorderTokens.filter(x => x.i !== p.i))}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-primary-700 text-white">{p.t}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {shuffledReorder.map(p => {
              const used = reorderTokens.find(x => x.i === p.i)
              return (
                <button key={p.i} disabled={!!used} onClick={() => setReorderTokens([...reorderTokens, p])}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${used ? 'bg-gray-100 text-gray-400 line-through' : 'bg-white border border-rule'}`}>
                  {p.t}
                </button>
              )
            })}
          </div>
          <button disabled={reorderTokens.length !== tokens.length}
            onClick={() => check(reorderTokens.map(p => p.t).join(' '))}
            className="w-full p-3 bg-primary-700 text-white rounded-xl font-semibold disabled:opacity-50">
            Valider
          </button>
        </>
      )}

      {feedback && (
        <div className={`border-l-4 p-4 rounded-r-lg space-y-2 ${feedback.correct ? 'border-ok bg-green-50' : 'border-warn bg-yellow-50'}`}>
          <div className={`text-sm font-bold ${feedback.correct ? 'text-ok' : 'text-warn'}`}>
            {feedback.correct ? '✓ Correct !' : '✗ Pas tout à fait.'}
          </div>
          {!feedback.correct && (
            <div className="text-sm text-gray-500">Ta réponse : <span className="line-through">{feedback.userAnswer || '—'}</span></div>
          )}
          <div className="flex items-center gap-2">
            <div className="flex-1 text-sm font-semibold text-ok">Bonne réponse : {c.answer}</div>
            <button onClick={() => speak(c.answer || '', voiceName)} aria-label="Écouter"
              className="shrink-0 w-9 h-9 rounded-full bg-primary-50 text-primary-700 hover:bg-primary-100">🔊</button>
          </div>
          {c.explanation && <div className="text-xs italic text-gray-600">💡 {c.explanation}</div>}
          <button onClick={() => onContinue(feedback.correct)}
            className="w-full mt-2 p-3 bg-primary-700 text-white rounded-xl font-semibold hover:bg-primary-900">
            Continuer →
          </button>
        </div>
      )}
    </div>
  )
}

/* ---------- Étape RECAP (3 exos enchaînés sans aide) ---------- */

function StepRecap({ step, voiceName, onContinue }: { step: Step; voiceName?: string | null; onContinue: (correct: boolean) => void }) {
  const exercises = step.content_json.exercises || []
  const [idx, setIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)
  const ex = exercises[idx]
  const [userText, setUserText] = useState('')
  const [feedback, setFeedback] = useState<boolean | null>(null)

  function check(answer: string) {
    const norm = (s: string) => s.toLowerCase().replace(/[.,!?;:]/g, '').trim().replace(/\s+/g, ' ')
    const ok = norm(answer) === norm(ex.answer)
    setFeedback(ok)
    if (ok) setScore(s => s + 1)
    setTimeout(() => {
      setFeedback(null); setUserText('')
      if (idx + 1 >= exercises.length) setDone(true)
      else setIdx(idx + 1)
    }, 1200)
  }

  if (done) {
    const allOk = score === exercises.length
    return (
      <div className="space-y-4 text-center">
        <div className="text-5xl">{allOk ? '🏆' : '👍'}</div>
        <div className="text-xl font-bold text-primary-900">
          Synthèse : {score}/{exercises.length}
        </div>
        <p className="text-sm text-gray-600">
          {allOk ? 'Parfait ! Tu maîtrises cette règle.' : 'Pas mal, tu peux refaire la leçon pour consolider.'}
        </p>
        <button onClick={() => onContinue(allOk)}
          className="w-full p-3 bg-primary-700 text-white rounded-xl font-semibold">
          Terminer la leçon →
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="text-xs uppercase font-bold text-primary-500 tracking-wider">
        🏆 Synthèse · {idx + 1} / {exercises.length}
      </div>
      {step.content_json.intro && idx === 0 && (
        <div className="text-sm italic text-gray-600">{step.content_json.intro}</div>
      )}
      <div className="bg-white border border-rule rounded-xl p-4 text-base font-medium text-primary-900">
        {ex.question}
      </div>
      {!feedback === null && ex.exercise_type === 'mcq' && ex.options && (
        <div className="space-y-2">
          {ex.options.map(opt => (
            <button key={opt} onClick={() => check(opt)} disabled={feedback !== null}
              className="w-full p-3 rounded-xl border-2 border-rule bg-white text-left font-semibold hover:bg-primary-50 disabled:opacity-50">
              {opt}
            </button>
          ))}
        </div>
      )}
      {feedback === null && (ex.exercise_type === 'fill_blank' || ex.exercise_type === 'translate') && (
        <form onSubmit={e => { e.preventDefault(); check(userText) }} className="space-y-2">
          <input type="text" autoFocus value={userText} onChange={e => setUserText(e.target.value)}
            className="w-full p-3 border-2 border-rule rounded-xl font-semibold focus:border-primary-500 outline-none" />
          <button type="submit" disabled={!userText.trim()}
            className="w-full p-3 bg-primary-700 text-white rounded-xl font-semibold disabled:opacity-50">Valider</button>
        </form>
      )}
      {feedback !== null && (
        <div className={`p-3 rounded-xl text-center font-bold ${feedback ? 'bg-green-50 text-ok' : 'bg-yellow-50 text-warn'}`}>
          {feedback ? '✓ Correct' : `✗ Réponse : ${ex.answer}`}
        </div>
      )}
    </div>
  )
}

/* ---------- Composant principal ---------- */

export function GrammarStep({ step, voiceName, onContinue, isLast }: Props) {
  if (step.type === 'practice') {
    return <StepPractice step={step} voiceName={voiceName} onContinue={onContinue} />
  }
  if (step.type === 'recap') {
    return <StepRecap step={step} voiceName={voiceName} onContinue={onContinue} />
  }
  // discover / concept / structure / tip : juste lecture + bouton continuer
  return (
    <div className="space-y-5">
      {step.type === 'discover' && <StepDiscover step={step} />}
      {step.type === 'concept' && <StepConcept step={step} />}
      {step.type === 'structure' && <StepStructure step={step} />}
      {step.type === 'tip' && <StepTip step={step} />}
      <button onClick={() => onContinue()}
        className="w-full p-3 bg-primary-700 text-white rounded-xl font-semibold hover:bg-primary-900">
        {isLast ? 'Terminer la leçon →' : 'J\'ai compris →'}
      </button>
    </div>
  )
}
