'use client'
import { useState, useMemo, useEffect } from 'react'
import { speak, speakSequence, stopSpeaking, TTS_VERSION, type SequenceSegment } from '@/components/games/utils'

/**
 * V6 — Composant unifié pour les 13 types d'étapes du nouveau format grammaire.
 *
 * Règles UX (cf. BRIEF_V6_REFONTE_GRAMMAIRE.md) :
 *  - Clic sur bouton = audio AUTO (pas besoin de bouton 🔊 séparé)
 *  - Code couleur consistant : sujet=bleu, verbe=rouge, complément=vert, contraction=violet
 *  - Pas de saisie texte (tap-to-build pour toute construction)
 *  - Auto-next 700ms après bonne réponse, pas d'auto-next sur erreur
 *  - Pauses 400-2000ms entre segments audio (via speakSequence)
 */

// ============================================================================
// TYPES
// ============================================================================

export type StepTypeV6 =
  | 'immersion' | 'discover_text' | 'recognition' | 'pattern' | 'match'
  | 'listen_target' | 'tap_build' | 'gap_fill' | 'variants'
  | 'contractions_intro' | 'contractions_recognition' | 'contractions_build'
  | 'recap_challenge'

export interface ColorToken {
  text: string
  role?: string
  color?: 'blue' | 'red' | 'green' | 'yellow' | 'purple'
  is_gap?: boolean
}

export interface StepV6 {
  id: string
  position: number
  type: StepTypeV6
  content_json: Record<string, unknown>
}

interface Props {
  step: StepV6
  onContinue: (correct?: boolean) => void
  onBack?: () => void
  isLast: boolean
  canGoBack: boolean
  /** Mode speaking = vitesse 0.8, complet = 0.9 */
  mode?: 'speaking' | 'complete'
}

// ============================================================================
// PALETTE DE COULEURS
// ============================================================================

const COLOR_BG: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-900 border-blue-300',
  red: 'bg-red-100 text-red-900 border-red-300',
  green: 'bg-green-100 text-green-900 border-green-300',
  yellow: 'bg-yellow-100 text-yellow-900 border-yellow-300',
  purple: 'bg-purple-100 text-purple-900 border-purple-300',
}

const COLOR_BG_STRONG: Record<string, string> = {
  blue: 'bg-blue-500 text-white border-blue-600',
  red: 'bg-red-500 text-white border-red-600',
  green: 'bg-green-500 text-white border-green-600',
  yellow: 'bg-yellow-500 text-yellow-900 border-yellow-600',
  purple: 'bg-purple-500 text-white border-purple-600',
}

function colorClass(c?: string): string {
  return COLOR_BG[c || ''] || 'bg-gray-100 text-gray-900 border-gray-300'
}

// ============================================================================
// HELPERS
// ============================================================================

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Composant utilitaire : token coloré (chip code couleur) */
function TokenChip({ token, size = 'md' }: { token: ColorToken; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'sm' ? 'px-2 py-1 text-sm' : size === 'lg' ? 'px-4 py-2 text-xl' : 'px-3 py-1.5 text-base'
  if (token.is_gap) {
    return (
      <span className={`inline-block rounded-lg border-2 border-dashed ${sz} bg-white text-gray-400 font-bold tracking-wider`}>
        _____
      </span>
    )
  }
  return (
    <span className={`inline-block rounded-lg border-2 font-bold ${sz} ${colorClass(token.color)}`}>
      {token.text}
    </span>
  )
}

/** Joue automatiquement l'audio d'introduction d'une étape (au mount) */
function useAutoIntro(segments: SequenceSegment[], rate: number) {
  useEffect(() => {
    if (segments.length === 0) return
    const t = setTimeout(() => {
      void speakSequence(segments, rate)
    }, 300)
    return () => {
      clearTimeout(t)
      stopSpeaking()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

// ============================================================================
// HEADER GÉNÉRIQUE (icône + label + bouton replay)
// ============================================================================

function StepHeader({ icon, label, onReplay }: { icon: string; label: string; onReplay?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="text-xs uppercase font-bold text-primary-500 tracking-wider flex items-center gap-2">
        <span className="text-base">{icon}</span> {label}
      </div>
      {onReplay && (
        <button onClick={onReplay} aria-label="Réécouter"
          className="w-9 h-9 rounded-full bg-primary-50 text-primary-700 hover:bg-primary-100 text-base">
          🔊
        </button>
      )}
    </div>
  )
}

// ============================================================================
// 1. IMMERSION — écoute simple
// ============================================================================

function StepImmersion({ step, onContinue, rate }: { step: StepV6; onContinue: () => void; rate: number }) {
  const c = step.content_json as { audio_intro?: string; audio_full?: string; audio_fr?: string; media?: { emoji?: string } }
  const segments: SequenceSegment[] = useMemo(() => [
    ...(c.audio_intro ? [{ text: c.audio_intro, lang: 'fr-FR' as const, pauseAfter: 1500 }] : []),
    ...(c.audio_full ? [{ text: c.audio_full, lang: 'en-GB' as const, pauseAfter: 1000 }] : []),
    ...(c.audio_fr ? [{ text: c.audio_fr, lang: 'fr-FR' as const }] : []),
  ], [c.audio_intro, c.audio_full, c.audio_fr])
  useAutoIntro(segments, rate)
  const replay = () => void speakSequence(segments, rate)

  return (
    <div className="space-y-6">
      <StepHeader icon="👂" label="Écoute" onReplay={replay} />
      <div className="text-center py-8 space-y-4">
        {c.media?.emoji && <div className="text-7xl">{c.media.emoji}</div>}
        {c.audio_full && (
          <div className="text-3xl font-extrabold text-primary-900">{c.audio_full}</div>
        )}
        {c.audio_fr && (
          <div className="text-base italic text-gray-600">→ {c.audio_fr}</div>
        )}
      </div>
      <button onClick={onContinue}
        className="w-full p-4 bg-primary-700 text-white rounded-xl font-semibold hover:bg-primary-900 text-lg">
        J&apos;ai écouté →
      </button>
    </div>
  )
}

// ============================================================================
// 2. DISCOVER_TEXT — phrase tokenisée avec code couleur
// ============================================================================

function StepDiscoverText({ step, onContinue, rate }: { step: StepV6; onContinue: () => void; rate: number }) {
  const c = step.content_json as { audio_intro?: string; tokens?: ColorToken[]; audio_fr?: string; media?: { emoji?: string } }
  const tokens = c.tokens || []

  const segments: SequenceSegment[] = useMemo(() => {
    const segs: SequenceSegment[] = []
    if (c.audio_intro) segs.push({ text: c.audio_intro, lang: 'fr-FR', pauseAfter: 1200 })
    tokens.forEach(t => segs.push({ text: t.text, lang: 'en-GB', pauseAfter: 600 }))
    if (c.audio_fr) segs.push({ text: c.audio_fr, lang: 'fr-FR' })
    return segs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useAutoIntro(segments, rate)
  const replay = () => void speakSequence(segments, rate)

  return (
    <div className="space-y-6">
      <StepHeader icon="🎨" label="Découverte" onReplay={replay} />
      <div className="text-center space-y-4 py-4">
        {c.media?.emoji && <div className="text-5xl">{c.media.emoji}</div>}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {tokens.map((t, i) => (
            <button
              key={i}
              onClick={() => speak(t.text)}
              className={`rounded-lg border-2 font-bold text-2xl px-4 py-2 hover:scale-105 transition-transform ${colorClass(t.color)}`}>
              {t.text}
            </button>
          ))}
        </div>
        {c.audio_fr && <div className="text-base italic text-gray-600">→ {c.audio_fr}</div>}
        <div className="text-xs text-gray-400">Tape sur un mot pour l&apos;écouter</div>
      </div>
      <button onClick={onContinue}
        className="w-full p-4 bg-primary-700 text-white rounded-xl font-semibold hover:bg-primary-900 text-lg">
        J&apos;ai compris →
      </button>
    </div>
  )
}

// ============================================================================
// 3. RECOGNITION — MCQ avec clic = audio auto
// ============================================================================

function StepRecognition({
  step, onContinue, rate,
}: { step: StepV6; onContinue: (correct: boolean) => void; rate: number }) {
  const c = step.content_json as {
    audio_intro?: string; question_fr?: string; audio_full?: string;
    options?: { text: string; correct: boolean }[];
    media?: { emoji?: string };
  }
  const options = c.options || []
  const [picked, setPicked] = useState<number | null>(null)
  const [shown, setShown] = useState<'idle' | 'wrong'>('idle')

  const segments: SequenceSegment[] = useMemo(() => {
    const segs: SequenceSegment[] = []
    if (c.audio_intro) segs.push({ text: c.audio_intro, lang: 'fr-FR', pauseAfter: 1200 })
    if (c.audio_full) segs.push({ text: c.audio_full, lang: 'en-GB', pauseAfter: 800 })
    if (c.question_fr) segs.push({ text: c.question_fr, lang: 'fr-FR' })
    return segs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useAutoIntro(segments, rate)
  const replay = () => void speakSequence(segments, rate)

  function pick(idx: number) {
    if (picked !== null && options[picked].correct) return // déjà gagné, ignore
    setPicked(idx)
    speak(options[idx].text)
    if (options[idx].correct) {
      setTimeout(() => onContinue(true), 900)
    } else {
      setShown('wrong')
      // Permettre de réessayer : reset après 1200ms
      setTimeout(() => { setPicked(null); setShown('idle') }, 1200)
    }
  }

  return (
    <div className="space-y-5">
      <StepHeader icon="🎯" label="Reconnaissance" onReplay={replay} />
      <div className="text-center space-y-2 py-3">
        {c.media?.emoji && <div className="text-5xl">{c.media.emoji}</div>}
        {c.audio_full && (
          <button onClick={() => speak(c.audio_full!)}
            className="text-2xl font-bold text-primary-900 hover:text-primary-700 inline-flex items-center gap-2">
            🔊 {c.audio_full}
          </button>
        )}
        {c.question_fr && (
          <div className="text-lg font-semibold text-primary-900">{c.question_fr}</div>
        )}
      </div>
      <div className="space-y-2">
        {options.map((opt, idx) => {
          const isPicked = picked === idx
          const isWrong = isPicked && shown === 'wrong'
          const isCorrect = isPicked && opt.correct
          return (
            <button key={idx}
              onClick={() => pick(idx)}
              disabled={isCorrect}
              className={`w-full p-4 rounded-xl border-2 font-bold text-lg transition-all ${
                isCorrect ? 'border-ok bg-green-50 text-ok' :
                isWrong ? 'border-warn bg-red-50 text-warn animate-shake' :
                'border-rule bg-white hover:bg-primary-50 hover:border-primary-300'
              }`}>
              {opt.text}
            </button>
          )
        })}
      </div>
      <div className="text-xs text-center text-gray-400">Tape une réponse — l&apos;audio se déclenche automatiquement</div>
    </div>
  )
}

// ============================================================================
// 4. PATTERN — tableau visuel sujet → verbe
// ============================================================================

function StepPattern({ step, onContinue, rate }: { step: StepV6; onContinue: () => void; rate: number }) {
  const c = step.content_json as {
    audio_intro?: string;
    pattern_rows?: { subject: string; verb: string; fr: string }[];
  }
  const rows = c.pattern_rows || []

  const segments: SequenceSegment[] = useMemo(() => {
    const segs: SequenceSegment[] = []
    if (c.audio_intro) segs.push({ text: c.audio_intro, lang: 'fr-FR', pauseAfter: 1500 })
    rows.forEach(r => {
      segs.push({ text: `${r.subject} ${r.verb}`, lang: 'en-GB', pauseAfter: 600 })
    })
    return segs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useAutoIntro(segments, rate)
  const replay = () => void speakSequence(segments, rate)

  return (
    <div className="space-y-5">
      <StepHeader icon="📐" label="Le pattern" onReplay={replay} />
      <div className="bg-gray-50 rounded-xl p-3 space-y-2">
        {rows.map((r, i) => (
          <button key={i}
            onClick={() => speak(`${r.subject} ${r.verb}`)}
            className="w-full flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors">
            <TokenChip token={{ text: r.subject, color: 'blue' }} />
            <span className="text-gray-400 text-xl">→</span>
            <TokenChip token={{ text: r.verb, color: 'red' }} />
            <span className="ml-auto text-sm italic text-gray-500">{r.fr}</span>
            <span className="text-primary-500">🔊</span>
          </button>
        ))}
      </div>
      <button onClick={onContinue}
        className="w-full p-4 bg-primary-700 text-white rounded-xl font-semibold hover:bg-primary-900 text-lg">
        J&apos;ai compris →
      </button>
    </div>
  )
}

// ============================================================================
// 5. MATCH — tap-to-match 2 colonnes
// ============================================================================

function StepMatch({ step, onContinue, rate }: { step: StepV6; onContinue: (correct: boolean) => void; rate: number }) {
  const c = step.content_json as {
    audio_intro?: string;
    pairs?: { left: string; right: string }[];
    explanation_fr?: string;
  }
  const pairs = c.pairs || []
  const [matches, setMatches] = useState<Record<string, number>>({})
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<boolean | null>(null)

  const rightShuffled = useMemo(
    () => shuffle(pairs.map((p, i) => ({ idx: i, val: p.right }))),
    [pairs]
  )

  const segments: SequenceSegment[] = useMemo(() =>
    c.audio_intro ? [{ text: c.audio_intro, lang: 'fr-FR' }] : []
    // eslint-disable-next-line react-hooks/exhaustive-deps
  , [])
  useAutoIntro(segments, rate)

  function pickLeft(l: string) {
    if (feedback !== null) return
    speak(l)
    setSelectedLeft(l)
  }

  function pickRight(idx: number, val: string) {
    if (!selectedLeft || feedback !== null) return
    if (Object.values(matches).includes(idx)) return
    speak(val)
    const newMatches = { ...matches, [selectedLeft]: idx }
    setMatches(newMatches)
    setSelectedLeft(null)
    if (Object.keys(newMatches).length === pairs.length) {
      const allOk = pairs.every(p => {
        const chosenIdx = newMatches[p.left]
        const chosenVal = rightShuffled.find(r => r.idx === chosenIdx)?.val
        return chosenVal === p.right
      })
      setFeedback(allOk)
    }
  }

  /** v6.0 — Permettre de défaire un match avant validation finale */
  function undoMatch(l: string) {
    if (feedback !== null) return
    const next = { ...matches }
    delete next[l]
    setMatches(next)
  }

  return (
    <div className="space-y-4">
      <StepHeader icon="🔗" label="Relie les paires" />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          {pairs.map(p => {
            const matchedIdx = matches[p.left]
            const matchedVal = matchedIdx !== undefined
              ? rightShuffled.find(r => r.idx === matchedIdx)?.val : undefined
            const isSelected = selectedLeft === p.left
            const isCorrect = feedback !== null && matchedVal === p.right
            const isWrong = feedback !== null && matchedVal !== undefined && matchedVal !== p.right
            return (
              <button key={p.left}
                onClick={() => matchedVal ? undoMatch(p.left) : pickLeft(p.left)}
                disabled={feedback === true}
                className={`w-full p-3 rounded-xl border-2 font-bold text-lg ${
                  isCorrect ? 'border-ok bg-green-50 text-ok' :
                  isWrong ? 'border-warn bg-red-50 text-warn' :
                  matchedVal ? `${colorClass('blue')} opacity-70` :
                  isSelected ? 'border-primary-500 bg-primary-100 text-primary-700' :
                  colorClass('blue')
                }`}>
                {p.left}
                {matchedVal && <span className="text-xs font-normal block mt-1">→ {matchedVal} (toucher pour défaire)</span>}
              </button>
            )
          })}
        </div>
        <div className="space-y-2">
          {rightShuffled.map(r => {
            const used = Object.values(matches).includes(r.idx)
            return (
              <button key={r.idx}
                onClick={() => pickRight(r.idx, r.val)}
                disabled={used || feedback !== null}
                className={`w-full p-3 rounded-xl border-2 font-bold text-lg ${
                  used ? 'bg-gray-100 text-gray-400 line-through border-rule' :
                  selectedLeft ? `${colorClass('red')} hover:scale-105` :
                  colorClass('red')
                }`}>
                {r.val}
              </button>
            )
          })}
        </div>
      </div>
      {feedback !== null && (
        <div className={`border-l-4 p-4 rounded-r-lg space-y-3 ${feedback ? 'border-ok bg-green-50' : 'border-warn bg-yellow-50'}`}>
          <div className={`text-base font-bold ${feedback ? 'text-ok' : 'text-warn'}`}>
            {feedback ? '✓ Tout est juste !' : '✗ Quelques erreurs.'}
          </div>
          {!feedback && (
            <div className="text-sm space-y-1">
              {pairs.map(p => (
                <div key={p.left}>
                  <span className="font-bold text-blue-700">{p.left}</span> → <span className="font-bold text-red-700">{p.right}</span>
                </div>
              ))}
            </div>
          )}
          {c.explanation_fr && (
            <div className="text-sm italic text-gray-700">💡 {c.explanation_fr.replace(/\*\*/g, '')}</div>
          )}
          <button onClick={() => onContinue(feedback)}
            className="w-full p-3 bg-primary-700 text-white rounded-xl font-bold hover:bg-primary-900">
            Continuer →
          </button>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// 6. LISTEN_TARGET — écoute ciblée + MCQ
// ============================================================================

function StepListenTarget({ step, onContinue, rate }: { step: StepV6; onContinue: (correct: boolean) => void; rate: number }) {
  const c = step.content_json as {
    audio_intro?: string; audio_full?: string; question_fr?: string;
    options?: { text: string; correct: boolean }[];
  }
  const options = c.options || []
  const [picked, setPicked] = useState<number | null>(null)
  const [shown, setShown] = useState<'idle' | 'wrong'>('idle')

  const segments: SequenceSegment[] = useMemo(() => {
    const segs: SequenceSegment[] = []
    if (c.audio_intro) segs.push({ text: c.audio_intro, lang: 'fr-FR', pauseAfter: 1200 })
    if (c.audio_full) segs.push({ text: c.audio_full, lang: 'en-GB', pauseAfter: 600 })
    if (c.audio_full) segs.push({ text: c.audio_full, lang: 'en-GB' }) // Répète 2x
    return segs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useAutoIntro(segments, rate)
  const replay = () => c.audio_full && speak(c.audio_full)

  function pick(idx: number) {
    if (picked !== null && options[picked].correct) return
    setPicked(idx)
    speak(options[idx].text)
    if (options[idx].correct) {
      setTimeout(() => onContinue(true), 900)
    } else {
      setShown('wrong')
      setTimeout(() => { setPicked(null); setShown('idle') }, 1200)
    }
  }

  return (
    <div className="space-y-5">
      <StepHeader icon="👂" label="Écoute ciblée" />
      <div className="text-center py-4">
        <button onClick={replay}
          className="w-24 h-24 rounded-full bg-primary-700 text-white text-4xl hover:bg-primary-900 shadow-lg">
          🔊
        </button>
        <div className="text-xs mt-2 text-gray-500">Tape pour réécouter</div>
      </div>
      {c.question_fr && (
        <div className="text-center text-base font-semibold text-primary-900">{c.question_fr}</div>
      )}
      <div className="space-y-2">
        {options.map((opt, idx) => {
          const isPicked = picked === idx
          const isWrong = isPicked && shown === 'wrong'
          const isCorrect = isPicked && opt.correct
          return (
            <button key={idx}
              onClick={() => pick(idx)}
              disabled={isCorrect}
              className={`w-full p-4 rounded-xl border-2 font-bold text-lg ${
                isCorrect ? 'border-ok bg-green-50 text-ok' :
                isWrong ? 'border-warn bg-red-50 text-warn animate-shake' :
                colorClass('red')
              }`}>
              {opt.text}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================================
// 7. TAP_BUILD — construire la phrase en cliquant sur les mots
// ============================================================================

function StepTapBuild({ step, onContinue, rate }: { step: StepV6; onContinue: (correct: boolean) => void; rate: number }) {
  const c = step.content_json as {
    audio_intro?: string; audio_target?: string; audio_target_fr?: string;
    expected_tokens?: ColorToken[]; distractors?: ColorToken[];
  }
  const expected = c.expected_tokens || []
  const distractors = c.distractors || []
  const allTokens = useMemo(
    () => shuffle([...expected, ...distractors].map((t, i) => ({ ...t, _idx: i }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )
  const [picked, setPicked] = useState<typeof allTokens>([])
  const [feedback, setFeedback] = useState<boolean | null>(null)

  const segments: SequenceSegment[] = useMemo(() => {
    const segs: SequenceSegment[] = []
    if (c.audio_intro) segs.push({ text: c.audio_intro, lang: 'fr-FR', pauseAfter: 1200 })
    if (c.audio_target_fr) segs.push({ text: c.audio_target_fr, lang: 'fr-FR' })
    return segs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useAutoIntro(segments, rate)

  function pickToken(t: typeof allTokens[number]) {
    if (feedback !== null) return
    speak(t.text)
    setPicked([...picked, t])
  }
  function unpickToken(t: typeof allTokens[number]) {
    if (feedback !== null) return
    setPicked(picked.filter(p => p._idx !== t._idx))
  }
  function validate() {
    const userText = picked.map(p => p.text).join(' ').toLowerCase().replace(/[.,]/g, '').trim()
    const expectedText = expected.map(p => p.text).join(' ').toLowerCase().replace(/[.,]/g, '').trim()
    const ok = userText === expectedText
    setFeedback(ok)
    if (ok && c.audio_target) speak(c.audio_target)
  }
  function reset() {
    setPicked([])
    setFeedback(null)
  }

  return (
    <div className="space-y-4">
      <StepHeader icon="🧩" label="Construis la phrase" />
      {c.audio_target_fr && (
        <div className="text-center text-base font-semibold text-primary-900 bg-blue-50 p-3 rounded-lg">
          {c.audio_target_fr}
        </div>
      )}

      {/* Zone de construction */}
      <div className="min-h-[68px] p-3 border-2 border-dashed border-primary-300 rounded-xl flex flex-wrap gap-2 items-center justify-center">
        {picked.length === 0 && <span className="text-gray-400 text-sm">Tape les mots dans l&apos;ordre</span>}
        {picked.map(t => (
          <button key={t._idx} onClick={() => unpickToken(t)}
            className={`rounded-lg border-2 font-bold text-lg px-3 py-1.5 ${colorClass(t.color)}`}>
            {t.text}
          </button>
        ))}
      </div>

      {/* Pool de mots disponibles */}
      <div className="flex flex-wrap gap-2 justify-center">
        {allTokens.map(t => {
          const used = picked.find(p => p._idx === t._idx)
          return (
            <button key={t._idx} onClick={() => pickToken(t)}
              disabled={!!used || feedback !== null}
              className={`rounded-lg border-2 font-bold text-lg px-3 py-1.5 ${
                used ? 'bg-gray-100 text-gray-400 line-through border-gray-200' :
                colorClass(t.color)
              } hover:scale-105 transition-transform`}>
              {t.text}
            </button>
          )
        })}
      </div>

      {feedback === null && (
        <button onClick={validate} disabled={picked.length === 0}
          className="w-full p-4 bg-primary-700 text-white rounded-xl font-bold hover:bg-primary-900 text-lg disabled:opacity-50">
          Valider
        </button>
      )}

      {feedback !== null && (
        <div className={`border-l-4 p-4 rounded-r-lg space-y-3 ${feedback ? 'border-ok bg-green-50' : 'border-warn bg-yellow-50'}`}>
          <div className={`text-base font-bold ${feedback ? 'text-ok' : 'text-warn'}`}>
            {feedback ? '✓ Bravo !' : '✗ Pas tout à fait.'}
          </div>
          {!feedback && (
            <>
              <div className="text-sm">La bonne réponse :</div>
              <div className="flex flex-wrap gap-2">
                {expected.map((t, i) => <TokenChip key={i} token={t} />)}
              </div>
            </>
          )}
          <div className="flex gap-2">
            {!feedback && (
              <button onClick={reset}
                className="flex-1 p-3 border-2 border-primary-700 text-primary-700 rounded-xl font-bold">
                Recommencer
              </button>
            )}
            <button onClick={() => onContinue(feedback)}
              className="flex-1 p-3 bg-primary-700 text-white rounded-xl font-bold">
              Continuer →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// 8. GAP_FILL — phrase à trou + 3 options
// ============================================================================

function StepGapFill({
  step, onContinue, rate,
  data,  // si fourni, override step.content_json (pour variants/recap)
}: {
  step: StepV6
  onContinue: (correct: boolean) => void
  rate: number
  data?: Record<string, unknown>
}) {
  const c = (data || step.content_json) as {
    audio_intro?: string;
    sentence_tokens?: ColorToken[];
    sentence_fr_tokens?: ColorToken[];
    sentence_fr?: string;
    options?: { text: string; correct: boolean; color?: string }[];
    explanation_fr?: string;
  }
  const options = c.options || []
  const sentence = c.sentence_tokens || []
  const sentenceFr = c.sentence_fr_tokens
  const [picked, setPicked] = useState<number | null>(null)
  const [shown, setShown] = useState<'idle' | 'wrong'>('idle')
  const [filled, setFilled] = useState<string | null>(null)

  const segments: SequenceSegment[] = useMemo(() =>
    c.audio_intro ? [{ text: c.audio_intro, lang: 'fr-FR' }] : []
    // eslint-disable-next-line react-hooks/exhaustive-deps
  , [step.id])
  useAutoIntro(segments, rate)

  function pick(idx: number) {
    if (picked !== null && options[picked].correct) return
    const opt = options[idx]
    setPicked(idx)
    speak(opt.text)
    setFilled(opt.text)
    if (opt.correct) {
      // Lit la phrase complète corrigée
      setTimeout(() => {
        const full = sentence.map(t => t.is_gap ? opt.text : t.text).join(' ')
        speak(full)
      }, 600)
      setTimeout(() => onContinue(true), 1800)
    } else {
      setShown('wrong')
      setTimeout(() => { setPicked(null); setShown('idle'); setFilled(null) }, 1300)
    }
  }

  function renderTokens(tokens: ColorToken[], filledOverride: string | null) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-2">
        {tokens.map((t, i) => {
          if (t.is_gap && filledOverride) {
            return <TokenChip key={i} token={{ text: filledOverride, color: t.color }} size="lg" />
          }
          return <TokenChip key={i} token={t} size="lg" />
        })}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <StepHeader icon="✏️" label="Complète la phrase" />
      <div className="bg-white border-2 border-rule rounded-xl p-4 space-y-3">
        {renderTokens(sentence, filled)}
        {sentenceFr && (
          <>
            <div className="border-t border-gray-200 my-2" />
            {renderTokens(sentenceFr, filled ? translateOption(filled) : null)}
          </>
        )}
        {!sentenceFr && c.sentence_fr && (
          <div className="text-center text-sm italic text-gray-600 border-t border-gray-200 pt-2">→ {c.sentence_fr}</div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {options.map((opt, idx) => {
          const isPicked = picked === idx
          const isWrong = isPicked && shown === 'wrong'
          const isCorrect = isPicked && opt.correct
          return (
            <button key={idx}
              onClick={() => pick(idx)}
              disabled={isCorrect}
              className={`p-4 rounded-xl border-2 font-bold text-xl ${
                isCorrect ? 'border-ok bg-green-50 text-ok' :
                isWrong ? 'border-warn bg-red-50 text-warn animate-shake' :
                colorClass(opt.color || 'red')
              } hover:scale-105 transition-transform`}>
              {opt.text}
            </button>
          )
        })}
      </div>
      {c.explanation_fr && picked !== null && options[picked].correct && (
        <div className="bg-amber-50 border-l-4 border-amber-400 p-3 rounded-r-lg text-sm">
          💡 {c.explanation_fr.replace(/\*\*/g, '')}
        </div>
      )}
    </div>
  )
}

/** Helper : traduit am/is/are en français pour l'affichage du blanc rempli côté FR */
function translateOption(en: string): string {
  const map: Record<string, string> = {
    'am': 'suis', 'is': 'est', 'are': 'sommes',
    'I am': 'je suis', 'You are': 'tu es', 'He is': 'il est',
    'I’m': 'je suis', 'She’s': 'elle est', 'They’re': 'ils sont',
  }
  return map[en] || en
}

// ============================================================================
// 9. VARIANTS — 3 mini gap_fill enchaînés
// ============================================================================

function StepVariants({ step, onContinue, rate }: { step: StepV6; onContinue: (correct: boolean) => void; rate: number }) {
  const c = step.content_json as {
    audio_intro?: string;
    variants?: Record<string, unknown>[];
  }
  const variants = c.variants || []
  const [idx, setIdx] = useState(0)
  const [score, setScore] = useState(0)

  const segments: SequenceSegment[] = useMemo(() =>
    c.audio_intro ? [{ text: c.audio_intro, lang: 'fr-FR' }] : []
    // eslint-disable-next-line react-hooks/exhaustive-deps
  , [])
  useAutoIntro(segments, rate)

  function next(correct: boolean) {
    if (correct) setScore(s => s + 1)
    if (idx + 1 >= variants.length) {
      setTimeout(() => onContinue(score + (correct ? 1 : 0) >= variants.length / 2), 200)
    } else {
      setIdx(idx + 1)
    }
  }

  if (variants.length === 0) return null
  const v = variants[idx]

  // Pseudo-step pour réutiliser StepGapFill
  return (
    <div className="space-y-3">
      <div className="text-center text-xs text-gray-500">Question {idx + 1} / {variants.length}</div>
      <StepGapFill
        key={idx}
        step={step}
        rate={rate}
        data={v}
        onContinue={next}
      />
    </div>
  )
}

// ============================================================================
// 10. CONTRACTIONS_INTRO — animation full → contracté
// ============================================================================

function StepContractionsIntro({ step, onContinue, rate }: { step: StepV6; onContinue: () => void; rate: number }) {
  const c = step.content_json as {
    audio_intro?: string;
    transformations?: { full: string; short: string; fr: string }[];
    explanation_fr?: string;
  }
  const trans = c.transformations || []

  const segments: SequenceSegment[] = useMemo(() => {
    const segs: SequenceSegment[] = []
    if (c.audio_intro) segs.push({ text: c.audio_intro, lang: 'fr-FR', pauseAfter: 1200 })
    trans.forEach(t => {
      segs.push({ text: t.full, lang: 'en-GB', pauseAfter: 400 })
      segs.push({ text: t.short, lang: 'en-GB', pauseAfter: 700 })
    })
    return segs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useAutoIntro(segments, rate)
  const replay = () => void speakSequence(segments, rate)

  return (
    <div className="space-y-5">
      <StepHeader icon="🔗" label="Les contractions" onReplay={replay} />
      <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4 space-y-3">
        {trans.map((t, i) => (
          <button key={i} onClick={() => { void speakSequence([
            { text: t.full, lang: 'en-GB', pauseAfter: 500 },
            { text: t.short, lang: 'en-GB' },
          ], rate) }}
            className="w-full flex items-center gap-2 p-2 hover:bg-white rounded-lg">
            <TokenChip token={{ text: t.full, color: 'blue' }} />
            <span className="text-purple-500 text-2xl font-bold">→</span>
            <TokenChip token={{ text: t.short, color: 'purple' }} />
            <span className="ml-auto text-sm italic text-gray-600">{t.fr}</span>
            <span className="text-primary-500">🔊</span>
          </button>
        ))}
      </div>
      {c.explanation_fr && (
        <div className="bg-amber-50 border-l-4 border-amber-400 p-3 rounded-r-lg text-sm">
          💡 {c.explanation_fr}
        </div>
      )}
      <button onClick={onContinue}
        className="w-full p-4 bg-primary-700 text-white rounded-xl font-bold hover:bg-primary-900 text-lg">
        J&apos;ai compris →
      </button>
    </div>
  )
}

// ============================================================================
// 11. CONTRACTIONS_RECOGNITION — écoute contraction + MCQ
// ============================================================================

function StepContractionsRecognition({ step, onContinue, rate }: { step: StepV6; onContinue: (correct: boolean) => void; rate: number }) {
  // Réutilise la logique de StepListenTarget
  return <StepListenTarget step={step} onContinue={onContinue} rate={rate} />
}

// ============================================================================
// 12. CONTRACTIONS_BUILD — réutilise StepTapBuild
// ============================================================================

function StepContractionsBuild({ step, onContinue, rate }: { step: StepV6; onContinue: (correct: boolean) => void; rate: number }) {
  return <StepTapBuild step={step} onContinue={onContinue} rate={rate} />
}

// ============================================================================
// 13. RECAP_CHALLENGE — 5 questions enchaînées
// ============================================================================

function StepRecapChallenge({ step, onContinue, rate }: { step: StepV6; onContinue: (correct: boolean) => void; rate: number }) {
  const c = step.content_json as {
    audio_intro?: string;
    challenges?: Record<string, unknown>[];
  }
  const chs = c.challenges || []
  const [idx, setIdx] = useState(0)
  const [score, setScore] = useState(0)

  const segments: SequenceSegment[] = useMemo(() =>
    c.audio_intro ? [{ text: c.audio_intro, lang: 'fr-FR' }] : []
    // eslint-disable-next-line react-hooks/exhaustive-deps
  , [])
  useAutoIntro(segments, rate)

  function next(correct: boolean) {
    const newScore = score + (correct ? 1 : 0)
    setScore(newScore)
    if (idx + 1 >= chs.length) {
      setTimeout(() => onContinue(newScore >= chs.length * 0.6), 300)
    } else {
      setIdx(idx + 1)
    }
  }

  if (chs.length === 0) return null
  const ch = chs[idx]
  const chType = ch.type as string

  return (
    <div className="space-y-3">
      <div className="text-center text-xs text-gray-500">Challenge {idx + 1} / {chs.length} · Score {score}</div>
      {chType === 'recognition' && (
        <StepRecognition
          key={idx}
          step={{ ...step, content_json: ch }}
          rate={rate}
          onContinue={next}
        />
      )}
      {chType === 'gap_fill' && (
        <StepGapFill
          key={idx}
          step={step}
          rate={rate}
          data={ch}
          onContinue={next}
        />
      )}
    </div>
  )
}

// ============================================================================
// COMPOSANT PRINCIPAL — router selon le type
// ============================================================================

export function GrammarStepV6({ step, onContinue, onBack, isLast, canGoBack, mode = 'complete' }: Props) {
  const rate = mode === 'speaking' ? 0.8 : 0.9

  function handleContinue(correct?: boolean) {
    onContinue(correct)
  }

  return (
    <div className="space-y-4">
      {step.type === 'immersion' && <StepImmersion step={step} onContinue={() => handleContinue()} rate={rate} />}
      {step.type === 'discover_text' && <StepDiscoverText step={step} onContinue={() => handleContinue()} rate={rate} />}
      {step.type === 'recognition' && <StepRecognition step={step} onContinue={handleContinue} rate={rate} />}
      {step.type === 'pattern' && <StepPattern step={step} onContinue={() => handleContinue()} rate={rate} />}
      {step.type === 'match' && <StepMatch step={step} onContinue={handleContinue} rate={rate} />}
      {step.type === 'listen_target' && <StepListenTarget step={step} onContinue={handleContinue} rate={rate} />}
      {step.type === 'tap_build' && <StepTapBuild step={step} onContinue={handleContinue} rate={rate} />}
      {step.type === 'gap_fill' && <StepGapFill step={step} onContinue={handleContinue} rate={rate} />}
      {step.type === 'variants' && <StepVariants step={step} onContinue={handleContinue} rate={rate} />}
      {step.type === 'contractions_intro' && <StepContractionsIntro step={step} onContinue={() => handleContinue()} rate={rate} />}
      {step.type === 'contractions_recognition' && <StepContractionsRecognition step={step} onContinue={handleContinue} rate={rate} />}
      {step.type === 'contractions_build' && <StepContractionsBuild step={step} onContinue={handleContinue} rate={rate} />}
      {step.type === 'recap_challenge' && <StepRecapChallenge step={step} onContinue={handleContinue} rate={rate} />}

      {canGoBack && onBack && (
        <button onClick={onBack}
          className="w-full p-2 text-sm text-gray-500 hover:text-primary-700 hover:bg-gray-50 rounded-lg">
          ← Étape précédente
        </button>
      )}

      {isLast && step.type !== 'recap_challenge' && (
        <div className="text-xs text-center text-gray-400">Dernière étape</div>
      )}

      <div data-tts-version={TTS_VERSION} className="text-[8px] text-gray-300 text-center select-none">
        TTS {TTS_VERSION}
      </div>
    </div>
  )
}
