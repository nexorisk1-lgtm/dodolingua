'use client'
import { useState, useMemo } from 'react'
import { shuffle, speak, speakMixed, TTS_VERSION } from '@/components/games/utils'

/**
 * v5.2 — Affichage d'UNE étape d'une micro-séquence grammaticale.
 *
 * Refonte suite feedback Raïssa (mai 2026) :
 *  - Typographie uniforme (text-base partout pour le contenu, text-2xl pour la "Bonne réponse")
 *  - Bouton 🔊 sur TOUS les types d'étapes (accessibilité illettrés/oraux purs)
 *  - Traduction FR systématique sous chaque phrase EN
 *  - Nouveau type d'exercice "match" (relier 2 colonnes par tap, pas de drag&drop)
 *  - Plus de typing libre en A1 (les "translate" sont remplacés par "match" ou "mcq")
 *
 * Types d'étapes :
 *  - discover : intro courte (1-2 phrases)
 *  - concept  : mini-règle isolée (1 phrase, 1 idée)
 *  - structure: formule visuelle colorée
 *  - tip      : astuce/contractions
 *  - practice : 1 exercice (mcq / fill_blank / reorder / translate / match)
 *  - recap    : 2-3 exercices mélangés sans aide
 */

export interface StepContent {
  text?: string
  text_fr?: string                                    // v5.2 — Traduction FR optionnelle
  highlight?: string[]
  formula?: { label: string; color: string }[]
  exercise_type?: 'mcq' | 'fill_blank' | 'reorder' | 'translate' | 'match'
  question?: string
  question_fr?: string                                // v5.2
  options?: string[]
  answer?: string
  answer_fr?: string                                  // v5.2 — Traduction FR de la bonne réponse
  explanation?: string
  pairs?: { left: string; right: string }[]          // v5.2 — Pour exercice "match"
  intro?: string
  exercises?: Array<{
    exercise_type: string
    question: string
    question_fr?: string
    options?: string[]
    answer: string
    answer_fr?: string
    pairs?: { left: string; right: string }[]
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
  onBack?: () => void
  isLast: boolean
  canGoBack: boolean
}

const COLOR_MAP: Record<string, string> = {
  blue:   'bg-primary-500 text-white',     // Sujet
  red:    'bg-warn text-white',            // Verbe
  green:  'bg-ok text-white',              // Complément
  yellow: 'bg-yellow-400 text-gray-900',   // Auxiliaire
  purple: 'bg-purple-500 text-white',      // Adverbe
  white:  'bg-white text-gray-700 border border-rule',
}

/* ---------- Helpers ---------- */

function MarkdownLite({ text }: { text: string }) {
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

/** v5.6 — Bouton 🔊 intelligent :
 *  - Si le texte contient des mots anglais entre **xxx** ou 'xxx' → speakMixed (FR + EN alternés)
 *  - Sinon lecture simple avec la langue demandée */
function SpeakerBtn({
  text, voiceName, size = 'md', lang,
}: {
  text: string
  voiceName?: string | null
  size?: 'sm' | 'md'
  lang?: 'fr-FR' | 'en-GB'
}) {
  const sz = size === 'sm' ? 'w-8 h-8 text-sm' : 'w-9 h-9 text-base'
  // v5.8 — Détection uniquement des **xxx** (les 'xxx' ambiguous avec l'apostrophe française)
  const hasMixed = /\*\*[^*]+\*\*/.test(text)
  const handleClick = () => {
    if (hasMixed) {
      // Détection des mots EN dans un texte FR : alterner les voix (async)
      void speakMixed(text, lang === 'en-GB' ? 'en-GB' : 'fr-FR')
    } else {
      speak(text, voiceName, { lang })
    }
  }
  return (
    <button
      onClick={handleClick}
      aria-label="Écouter"
      className={`shrink-0 rounded-full bg-primary-50 text-primary-700 hover:bg-primary-100 ${sz}`}
    >🔊</button>
  )
}

/** v5.5 — Retire le markdown ** pour affichage texte. */
function stripMd(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, '$1')
}

/** v5.2 — Phrase EN + traduction FR + 🔊 */
function PhraseBlock({ en, fr, voiceName }: { en: string; fr?: string; voiceName?: string | null }) {
  return (
    <div className="space-y-1">
      <div className="flex items-start gap-2">
        <div className="flex-1 text-base font-medium text-primary-900">{en}</div>
        <SpeakerBtn text={en} voiceName={voiceName} />
      </div>
      {fr && <div className="text-sm italic text-gray-600 pl-1">→ {fr}</div>}
    </div>
  )
}

/* ---------- Étapes "lecture" (discover, concept, structure, tip) ---------- */

function StepHeader({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="text-xs uppercase font-bold text-primary-500 tracking-wider flex items-center gap-2">
      <span className="text-base">{icon}</span> {label}
    </div>
  )
}

function StepLecture({ step, voiceName }: { step: Step; voiceName?: string | null }) {
  const c = step.content_json
  const ICONS = { discover: '💡', concept: '🎯', structure: '📐', tip: '💡' } as const
  const LABELS = { discover: 'Découverte', concept: 'Règle', structure: 'Structure', tip: 'À retenir' } as const
  const icon = ICONS[step.type as keyof typeof ICONS]
  const label = LABELS[step.type as keyof typeof LABELS]

  // Repérer les snippets EN dans le texte (entre **) pour ajouter un 🔊 dédié
  const enSnippets = (c.text || '').match(/\*\*([^*]+)\*\*/g)?.map(m => m.slice(2, -2)) || []

  // v5.6 — Texte à lire avec markdown CONSERVÉ pour que SpeakerBtn détecte
  // les mots anglais et alterne les voix (FR pour le texte, EN pour les mots **xxx**)
  const textToSpeakFr = (c.text || '') + (c.text_fr ? '. ' + c.text_fr : '')

  return (
    <div className={step.type === 'tip' ? 'border-l-4 border-amber-400 bg-amber-50 p-4 rounded-r-lg space-y-3' : 'space-y-3'}>
      <StepHeader icon={icon} label={label} />

      {/* v5.11 — Bloc texte FR avec 🔊 général + traduction MISE EN VALEUR */}
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-3">
          <div className="text-base leading-relaxed text-gray-900">
            <MarkdownLite text={c.text || ''} />
          </div>
          {c.text_fr && (
            <div className="bg-blue-50 border-l-4 border-primary-500 px-3 py-2 rounded-r-lg">
              <div className="text-[10px] uppercase font-bold text-primary-600 tracking-wide mb-0.5">
                Règle clé
              </div>
              <div className="text-base font-semibold text-primary-900 leading-snug">
                <MarkdownLite text={c.text_fr} />
              </div>
            </div>
          )}
        </div>
        <SpeakerBtn text={textToSpeakFr} voiceName={voiceName} lang="fr-FR" />
      </div>

      {/* Boutons 🔊 sur les snippets EN repérés (ex: **to be**, **am**, **She's**) — en anglais */}
      {enSnippets.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {enSnippets.map((s, i) => (
            <button key={i} onClick={() => speak(s, voiceName)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-50 text-primary-700 text-sm font-semibold hover:bg-primary-100">
              🔊 {s}
            </button>
          ))}
        </div>
      )}

      {step.type === 'structure' && c.formula && c.formula.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2 p-4 bg-gray-50 rounded-xl">
          {c.formula.map((slot, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className={`px-3 py-1.5 rounded-lg text-sm font-bold ${COLOR_MAP[slot.color] || COLOR_MAP.white}`}>
                {slot.label}
              </span>
              {i < c.formula!.length - 1 && <span className="text-gray-400 text-xl">+</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------- Étape MATCH (relier sujet ↔ verbe par tap) ---------- */

function StepMatch({ step, voiceName, onValidate }: { step: Step; voiceName?: string | null; onValidate: (correct: boolean) => void }) {
  const c = step.content_json
  const pairs = c.pairs || []
  // v5.5 — On stocke matches par INDEX (pas par valeur) pour gérer les doublons
  // (ex: "is" ou "are" peuvent être à la fois pour He, She, It / You, We, They)
  const [matches, setMatches] = useState<Record<string, number>>({}) // left -> index dans rightShuffled
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<boolean | null>(null)

  const rightShuffled = useMemo(
    () => shuffle(pairs.map((p, i) => ({ idx: i, val: p.right }))),
    [pairs]
  )

  function pickLeft(l: string) {
    if (matches[l] !== undefined || feedback !== null) return
    setSelectedLeft(l)
  }

  function pickRight(idx: number) {
    if (!selectedLeft || feedback !== null) return
    // v5.5 — vérification par INDEX (pas par valeur) → gère les doublons
    if (Object.values(matches).includes(idx)) return
    const newMatches = { ...matches, [selectedLeft]: idx }
    setMatches(newMatches)
    setSelectedLeft(null)
    if (Object.keys(newMatches).length === pairs.length) {
      // Validation : pour chaque paire (left), la valeur droite à l'index choisi doit être la bonne
      const allOk = pairs.every(p => {
        const chosenIdx = newMatches[p.left]
        const chosenVal = rightShuffled.find(r => r.idx === chosenIdx)?.val
        return chosenVal === p.right
      })
      setFeedback(allOk)
    }
  }

  return (
    <div className="space-y-4">
      <StepHeader icon="🔗" label="Relie chaque sujet à sa forme" />

      {c.question && <div className="text-base text-gray-700">{c.question}</div>}

      {/* v5.15 — Accessibilité illettrés : un 🔊 sur CHAQUE colonne (EN à gauche, FR à droite).
         Le 🔊 est SÉPARÉ du bouton de sélection pour ne pas déclencher le match en cliquant sur écoute. */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          {pairs.map(p => {
            const matchedIdx = matches[p.left]
            const matchedVal = matchedIdx !== undefined
              ? rightShuffled.find(r => r.idx === matchedIdx)?.val
              : undefined
            const isSelected = selectedLeft === p.left
            const isCorrect = feedback !== null && matchedVal === p.right
            const isWrong = feedback !== null && matchedVal !== undefined && matchedVal !== p.right
            const disabled = matchedIdx !== undefined && feedback === null
            return (
              <div key={p.left} className="flex items-center gap-1">
                <button
                  onClick={() => pickLeft(p.left)}
                  disabled={disabled}
                  className={`flex-1 p-3 rounded-xl border-2 font-semibold text-base ${
                    isCorrect ? 'border-ok bg-green-50 text-ok' :
                    isWrong ? 'border-warn bg-red-50 text-warn' :
                    matchedVal ? 'border-primary-300 bg-primary-50 text-primary-700' :
                    isSelected ? 'border-primary-500 bg-primary-100 text-primary-700' :
                    'border-rule bg-white'
                  }`}>
                  {p.left} {matchedVal && <span className="text-xs font-normal">→ {matchedVal}</span>}
                </button>
                {/* 🔊 EN sur la colonne gauche (pronom anglais) */}
                <SpeakerBtn text={p.left} voiceName={voiceName} size="sm" lang="en-GB" />
              </div>
            )
          })}
        </div>
        <div className="space-y-2">
          {rightShuffled.map(r => {
            // v5.5 — used par INDEX, pas par valeur
            const used = Object.values(matches).includes(r.idx)
            return (
              <div key={r.idx} className="flex items-center gap-1">
                <button
                  onClick={() => pickRight(r.idx)}
                  disabled={used || feedback !== null}
                  className={`flex-1 p-3 rounded-xl border-2 font-semibold text-base ${
                    used ? 'bg-gray-100 text-gray-400 line-through border-rule' :
                    selectedLeft ? 'border-primary-500 bg-white hover:bg-primary-50' :
                    'border-rule bg-white'
                  }`}>
                  {r.val}
                </button>
                {/* v5.15 — 🔊 FR sur la colonne droite (traduction française)
                   Avant v5.15 : lang non précisée → la voix EN lisait "elle" en anglais. */}
                {!used && <SpeakerBtn text={r.val} voiceName={voiceName} size="sm" lang="fr-FR" />}
              </div>
            )
          })}
        </div>
      </div>

      {feedback !== null && (
        <div className={`border-l-4 p-4 rounded-r-lg space-y-2 ${feedback ? 'border-ok bg-green-50' : 'border-warn bg-yellow-50'}`}>
          <div className={`text-sm font-bold ${feedback ? 'text-ok' : 'text-warn'}`}>
            {feedback ? '✓ Tout est juste !' : '✗ Quelques erreurs.'}
          </div>
          {!feedback && (
            <div className="text-sm text-gray-700 space-y-1">
              {pairs.map(p => (
                <div key={p.left}>
                  <span className="font-semibold">{p.left}</span> → <span className="text-ok font-bold">{p.right}</span>
                </div>
              ))}
            </div>
          )}
          {c.explanation && <div className="text-xs italic text-gray-600">💡 {c.explanation}</div>}
          <button onClick={() => onValidate(feedback)}
            className="w-full mt-2 p-3 bg-primary-700 text-white rounded-xl font-semibold hover:bg-primary-900">
            Continuer →
          </button>
        </div>
      )}
    </div>
  )
}

/* ---------- Étape PRACTICE (mcq / fill_blank / reorder / translate) ---------- */

function StepPractice({ step, voiceName, onContinue }: { step: Step; voiceName?: string | null; onContinue: (correct: boolean) => void }) {
  const c = step.content_json

  // v5.2 — Si type = match, on délègue au composant dédié
  if (c.exercise_type === 'match') {
    return <StepMatch step={step} voiceName={voiceName} onValidate={onContinue} />
  }

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
      <StepHeader icon="✏️" label="Pratique" />

      {/* v5.14 — Bloc question SANS 🔊 sur mcq/fill_blank
         (avant : "I blank French" était lu littéralement, peu utile et confus)
         Le 🔊 reste sur "Bonne réponse" (phrase complète) pour entendre la solution.
         Pour reorder/translate : pas de 🔊 non plus (mots scramblés / texte FR à traduire) */}
      <div className="bg-white border border-rule rounded-xl p-4 space-y-2">
        <div className="text-lg font-semibold text-primary-900">{c.question}</div>
        {c.question_fr && (
          <div className="text-sm italic text-gray-600">→ {c.question_fr}</div>
        )}
      </div>

      {!feedback && c.exercise_type === 'mcq' && c.options && (
        <div className="space-y-2">
          {c.options.map(opt => (
            <div key={opt} className="flex items-center gap-1">
              {/* v5.13 — 🔊 SÉPARÉ du bouton de sélection (avant : cliquer 🔊 sélectionnait l'option) */}
              <button
                onClick={() => check(opt)}
                className="flex-1 p-3 rounded-xl border-2 border-rule bg-white text-left text-base font-semibold hover:bg-primary-50">
                {opt}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); speak(opt, voiceName) }}
                aria-label={`Écouter ${opt}`}
                className="shrink-0 w-9 h-9 rounded-full bg-primary-50 text-primary-700 hover:bg-primary-100">
                🔊
              </button>
            </div>
          ))}
        </div>
      )}

      {!feedback && (c.exercise_type === 'fill_blank' || c.exercise_type === 'translate') && (
        <form onSubmit={e => { e.preventDefault(); check(userText) }} className="space-y-2">
          <input type="text" autoFocus value={userText} onChange={e => setUserText(e.target.value)}
            placeholder={c.exercise_type === 'fill_blank' ? 'Le mot manquant…' : 'Traduction anglaise…'}
            className="w-full p-3 border-2 border-rule rounded-xl text-base font-semibold focus:border-primary-500 outline-none" />
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
                className="px-3 py-2 rounded-lg text-base font-semibold bg-primary-700 text-white">{p.t}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {shuffledReorder.map(p => {
              const used = reorderTokens.find(x => x.i === p.i)
              return (
                <button key={p.i} disabled={!!used} onClick={() => setReorderTokens([...reorderTokens, p])}
                  className={`px-3 py-2 rounded-lg text-base font-semibold ${used ? 'bg-gray-100 text-gray-400 line-through' : 'bg-white border border-rule'}`}>
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

      {feedback && (() => {
        // v5.12 — Calcul de la phrase complète selon le type d'exercice
        // - mcq, fill_blank : on remplace ___ dans la question par la réponse
        // - reorder, translate : on affiche directement c.answer (pas la question avec mots à ordonner)
        // - match : c.answer (déjà géré par StepMatch séparément)
        const completeSentence = (c.exercise_type === 'mcq' || c.exercise_type === 'fill_blank')
          ? (c.question || '').replace(/___/g, c.answer || '')
          : (c.answer || '')
        return (
        <div className={`border-l-4 p-4 rounded-r-lg space-y-3 ${feedback.correct ? 'border-ok bg-green-50' : 'border-warn bg-yellow-50'}`}>
          <div className={`text-sm font-bold ${feedback.correct ? 'text-ok' : 'text-warn'}`}>
            {feedback.correct ? '✓ Correct !' : '✗ Pas tout à fait.'}
          </div>
          {!feedback.correct && (
            <div className="text-sm text-gray-500">Ta réponse : <span className="line-through">{feedback.userAnswer || '—'}</span></div>
          )}
          <div className="space-y-1">
            <div className="text-xs uppercase font-bold text-ok">Bonne réponse</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 text-2xl font-extrabold text-ok leading-tight">
                {completeSentence}
              </div>
              <SpeakerBtn
                text={completeSentence}
                voiceName={voiceName}
              />
            </div>
            {c.question_fr && <div className="text-base italic text-gray-700">→ {c.question_fr}</div>}
          </div>
          {/* v5.11 — Astuce/rappel MISE EN VALEUR (fond ambré + gras) avec 🔊 dédié */}
          {c.explanation && (
            <div className="flex items-start gap-2 bg-amber-50 border-l-4 border-amber-400 p-3 rounded-r-lg">
              <div className="flex-1">
                <div className="text-[10px] uppercase font-bold text-amber-700 tracking-wide mb-1">
                  💡 À retenir
                </div>
                <div className="text-base font-semibold text-gray-900 leading-snug">
                  <MarkdownLite text={c.explanation} />
                </div>
              </div>
              <SpeakerBtn text={c.explanation} voiceName={voiceName} lang="fr-FR" size="sm" />
            </div>
          )}
          <button onClick={() => onContinue(feedback.correct)}
            className="w-full mt-2 p-3 bg-primary-700 text-white rounded-xl font-semibold hover:bg-primary-900">
            Continuer →
          </button>
        </div>
        )
      })()}
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
  const [picked, setPicked] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<boolean | null>(null)

  function check(answer: string) {
    const norm = (s: string) => s.toLowerCase().replace(/[.,!?;:]/g, '').trim().replace(/\s+/g, ' ')
    const ok = norm(answer) === norm(ex.answer)
    setFeedback(ok)
    if (ok) setScore(s => s + 1)
    setTimeout(() => {
      setFeedback(null); setUserText(''); setPicked(null)
      if (idx + 1 >= exercises.length) setDone(true)
      else setIdx(idx + 1)
    }, 1400)
  }

  if (done) {
    const allOk = score === exercises.length
    return (
      <div className="space-y-4 text-center">
        <div className="text-5xl">{allOk ? '🏆' : '👍'}</div>
        <div className="text-xl font-bold text-primary-900">Synthèse : {score}/{exercises.length}</div>
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
      <StepHeader icon="🏆" label={`Synthèse · ${idx + 1} / ${exercises.length}`} />
      {step.content_json.intro && idx === 0 && (
        <div className="text-sm italic text-gray-600">{step.content_json.intro}</div>
      )}
      <div className="bg-white border border-rule rounded-xl p-4 space-y-2">
        <div className="flex items-start gap-2">
          <div className="flex-1 text-lg font-semibold text-primary-900">{ex.question}</div>
          {ex.exercise_type !== 'translate' && (
            <SpeakerBtn text={ex.question.replace(/___/g, ex.answer).replace(/\s*\/\s*/g, ' ')} voiceName={voiceName} />
          )}
        </div>
        {ex.question_fr && <div className="text-sm italic text-gray-600">→ {ex.question_fr}</div>}
      </div>

      {feedback === null && ex.exercise_type === 'mcq' && ex.options && (
        <div className="space-y-2">
          {ex.options.map(opt => (
            <button key={opt} onClick={() => { setPicked(opt); check(opt) }} disabled={picked !== null}
              className="w-full p-3 rounded-xl border-2 border-rule bg-white text-left text-base font-semibold hover:bg-primary-50 disabled:opacity-50">
              {opt}
            </button>
          ))}
        </div>
      )}
      {feedback === null && (ex.exercise_type === 'fill_blank' || ex.exercise_type === 'translate') && (
        <form onSubmit={e => { e.preventDefault(); check(userText) }} className="space-y-2">
          <input type="text" autoFocus value={userText} onChange={e => setUserText(e.target.value)}
            className="w-full p-3 border-2 border-rule rounded-xl text-base font-semibold focus:border-primary-500 outline-none" />
          <button type="submit" disabled={!userText.trim()}
            className="w-full p-3 bg-primary-700 text-white rounded-xl font-semibold disabled:opacity-50">Valider</button>
        </form>
      )}
      {feedback !== null && (
        <div className={`p-4 rounded-xl text-center space-y-1 ${feedback ? 'bg-green-50' : 'bg-yellow-50'}`}>
          <div className={`text-sm font-bold ${feedback ? 'text-ok' : 'text-warn'}`}>
            {feedback ? '✓ Correct' : '✗ Faux'}
          </div>
          <div className="text-2xl font-extrabold text-ok">{ex.answer}</div>
          {ex.answer_fr && <div className="text-sm italic text-gray-600">→ {ex.answer_fr}</div>}
        </div>
      )}
    </div>
  )
}

/* ---------- Composant principal ---------- */

export function GrammarStep({ step, voiceName, onContinue, onBack, isLast, canGoBack }: Props) {
  return (
    <div className="space-y-4">
      {step.type === 'practice' ? (
        <StepPractice step={step} voiceName={voiceName} onContinue={onContinue} />
      ) : step.type === 'recap' ? (
        <StepRecap step={step} voiceName={voiceName} onContinue={onContinue} />
      ) : (
        <>
          <StepLecture step={step} voiceName={voiceName} />
          <button onClick={() => onContinue()}
            className="w-full p-3 bg-primary-700 text-white rounded-xl font-semibold hover:bg-primary-900">
            {isLast ? 'Terminer la leçon →' : 'J\'ai compris →'}
          </button>
        </>
      )}

      {/* v5.2 — Bouton précédent (en bas, discret) */}
      {canGoBack && onBack && (
        <button onClick={onBack}
          className="w-full p-2 text-sm text-gray-500 hover:text-primary-700 hover:bg-gray-50 rounded-lg">
          ← Étape précédente
        </button>
      )}
      {/* v5.9 — Indicateur de version pour debug : visible uniquement par data-attribute */}
      <div data-tts-version={TTS_VERSION} className="text-[8px] text-gray-300 text-center select-none">
        TTS {TTS_VERSION}
      </div>
    </div>
  )
}
