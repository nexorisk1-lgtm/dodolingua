'use client'

/**
 * v9.2 — Refonte UX cohérente grammaire après retours utilisateur v9.1 :
 *   - Auto-next partout après que la voix a terminé (hook useAutoNextAfterSpeech)
 *   - Suppression de la définition affichée à l'écran (lue à l'oral uniquement,
 *     accessibilité illettrés)
 *   - Suppression des context_emojis affichés (encombrant)
 *   - Capitalisation Title Case sur les mots EN et FR ("Hi", "Bonjour")
 *   - Encouragement vocal après prononciation ("Bravo, tu as bien prononcé !")
 *   - Feedback vocal sur erreurs (gap fill, association)
 *   - Mini dialog : 2 voix EN différentes + dernière réplique = micro utilisateur
 *   - Phase 7 finale : mots EN du pavé vert lus en voix anglaise (via **xxx**)
 *   - Type 'phase_intro' pour transitions vocales entre phases
 *   - Nettoyage virgule TTS sur gap fill (regex "comma" → pause)
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import {
  speakSequence, stopSpeaking, recognizeSpeech, type SequenceSegment,
} from '@/components/games/utils'

export interface VocabStepData {
  id: string
  position: number
  phase: number
  type: string
  content_json: any
}

interface Props {
  step: VocabStepData
  onContinue: (correct?: boolean) => void
  onBack: () => void
  canGoBack: boolean
  isLast: boolean
  userName?: string
  lessonTitle?: string
}

/* ============================================================================
   HELPERS
   ============================================================================ */

function titleCase(s: string): string {
  if (!s) return s
  return s.split(' ').map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : w).join(' ')
}

/** Hook : joue les segments puis appelle onContinue automatiquement après pauseMs. */
function useAutoNextAfterSpeech(segments: SequenceSegment[], onContinue: () => void, pauseMs = 1200, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const run = async () => {
      if (segments.length > 0) await speakSequence(segments, 0.9)
      if (!cancelled) setTimeout(() => { if (!cancelled) onContinue() }, pauseMs)
    }
    const t = setTimeout(() => void run(), 300)
    return () => { cancelled = true; clearTimeout(t); stopSpeaking() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

/* ============================================================================
   ROUTER
   ============================================================================ */
export function VocabLessonStep({ step, onContinue, onBack, canGoBack, isLast, userName, lessonTitle }: Props) {
  const c = step.content_json

  switch (step.type) {
    case 'phase_intro':
      return <StepPhaseIntro c={c} onContinue={() => onContinue()} userName={userName} lessonTitle={lessonTitle} />
    case 'discovery_word':
      return <StepDiscoveryWord c={c} onContinue={() => onContinue()} onBack={onBack} canGoBack={canGoBack} />
    case 'immersion_scene':
      return <StepImmersionScene c={c} onContinue={() => onContinue()} onBack={onBack} canGoBack={canGoBack} />
    case 'flashcard':
      return <StepFlashcard c={c} onContinue={onContinue} onBack={onBack} canGoBack={canGoBack} />
    case 'pronunciation_breakdown':
      return <StepPronunciationBreakdown c={c} onContinue={() => onContinue()} onBack={onBack} canGoBack={canGoBack} />
    case 'situation_qcm':
      return <StepSituationQcm c={c} onContinue={onContinue} onBack={onBack} canGoBack={canGoBack} />
    case 'mini_dialog':
      return <StepMiniDialog c={c} onContinue={() => onContinue()} onBack={onBack} canGoBack={canGoBack} />
    case 'qcm_audio':
      return <StepQcmAudio c={c} onContinue={onContinue} onBack={onBack} canGoBack={canGoBack} />
    case 'association':
      return <StepAssociation c={c} onContinue={onContinue} onBack={onBack} canGoBack={canGoBack} />
    case 'gap_fill':
      return <StepGapFill c={c} onContinue={onContinue} onBack={onBack} canGoBack={canGoBack} />
    case 'final_validation':
      return <StepFinalValidation c={c} onContinue={() => onContinue()} userName={userName} lessonTitle={lessonTitle} />
    default:
      return <div className="text-sm text-gray-500 italic">Type de step inconnu : {step.type}</div>
  }
}

/* ============================================================================
   STEP 0 — PHASE INTRO (transition vocale entre phases)
   v9.3 — Minimaliste à l'écran (emoji + titre court). Le contenu détaillé est
   uniquement en voix off. Personnalisation prénom sur Phase 0 (intro lesson).
   ============================================================================ */
function StepPhaseIntro({ c, onContinue, userName, lessonTitle }: {
  c: { phase_emoji: string; phase_title_fr: string; audio_intro_fr: string; is_lesson_intro?: boolean }
  onContinue: () => void
  userName?: string
  lessonTitle?: string
}) {
  const firstName = userName?.split(' ')[0]
  // v9.3 — Personnalise la 1re intro de leçon (phase=0) avec le prénom
  const personalizedAudio = useMemo(() => {
    if (c.is_lesson_intro && firstName) {
      return `Bienvenue ${firstName} ! ${c.audio_intro_fr}`
    }
    return c.audio_intro_fr
  }, [c.audio_intro_fr, c.is_lesson_intro, firstName])

  useAutoNextAfterSpeech([{ text: personalizedAudio, lang: 'fr-FR' }], onContinue, 1200)

  return (
    <div className="space-y-3 text-center py-12">
      <div className="text-8xl">{c.phase_emoji}</div>
      <div className="text-lg font-bold text-primary-900">
        {c.is_lesson_intro && firstName ? `Bienvenue ${firstName} !` : c.phase_title_fr}
      </div>
    </div>
  )
}

/* ============================================================================
   PHASE 1 — DÉCOUVERTE
   ============================================================================ */
function StepDiscoveryWord({ c, onContinue, onBack, canGoBack }: {
  c: { lemma: string; gloss_fr: string; definition_fr?: string; example_en?: string; example_fr?: string }
  onContinue: () => void; onBack: () => void; canGoBack: boolean
}) {
  const segs: SequenceSegment[] = useMemo(() => {
    const s: SequenceSegment[] = []
    s.push({ text: c.lemma, lang: 'en-GB', pauseAfter: 600 })
    s.push({ text: `veut dire ${c.gloss_fr}`, lang: 'fr-FR', pauseAfter: 700 })
    if (c.definition_fr) s.push({ text: c.definition_fr, lang: 'fr-FR', pauseAfter: 600 })
    if (c.example_en) {
      s.push({ text: 'Par exemple…', lang: 'fr-FR', pauseAfter: 300 })
      s.push({ text: c.example_en, lang: 'en-GB', pauseAfter: 500 })
      if (c.example_fr) s.push({ text: c.example_fr, lang: 'fr-FR', pauseAfter: 400 })
    }
    return s
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.lemma])

  useAutoNextAfterSpeech(segs, onContinue, 1400)

  function replay() { speakSequence(segs, 0.9) }

  return (
    <div className="space-y-4 text-center">
      <div className="text-[10px] uppercase font-bold text-gray-500">Voici un nouveau mot</div>
      <div className="text-5xl font-extrabold text-primary-900">{titleCase(c.lemma)}</div>
      <div className="text-2xl text-primary-700">→ {titleCase(c.gloss_fr)}</div>

      <button onClick={replay} className="text-sm bg-primary-50 text-primary-700 font-semibold px-4 py-2 rounded-full">🔊 Réécouter</button>

      {c.example_en && (
        <div className="bg-amber-50 rounded-xl p-3 mt-2">
          <div className="text-[10px] uppercase font-bold text-amber-700 mb-1">Exemple</div>
          <div className="text-base italic font-semibold text-gray-900">{titleCase(c.example_en)}</div>
          {c.example_fr && <div className="text-sm italic text-gray-600 mt-1">{titleCase(c.example_fr)}</div>}
        </div>
      )}

      {canGoBack && <Button variant="ghost" onClick={onBack}>← Précédent</Button>}
    </div>
  )
}

/* ============================================================================
   PHASE 2 — IMMERSION SCENE
   ============================================================================ */
function StepImmersionScene({ c, onContinue, onBack, canGoBack }: {
  c: { context_emoji: string; context_fr: string; audio_en: string }
  onContinue: () => void; onBack: () => void; canGoBack: boolean
}) {
  const [revealed, setRevealed] = useState(false)
  const segs: SequenceSegment[] = useMemo(() => ([
    { text: c.context_fr, lang: 'fr-FR' as const, pauseAfter: 700 },
    { text: c.audio_en, lang: 'en-GB' as const, pauseAfter: 500 },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ]), [c.audio_en])

  useEffect(() => {
    const tReveal = setTimeout(() => setRevealed(true), 2500)
    return () => clearTimeout(tReveal)
  }, [])

  useAutoNextAfterSpeech(segs, onContinue, 1600)

  return (
    <div className="space-y-4 text-center">
      <div className="text-[10px] uppercase font-bold text-gray-500">Mini scène</div>
      <div className="text-7xl py-4">{c.context_emoji}</div>
      <div className="text-base text-gray-800 font-semibold">{c.context_fr}</div>

      {revealed && (
        <div className="bg-emerald-50 rounded-xl p-3 animate-pulse-once">
          <div className="text-[10px] uppercase font-bold text-emerald-700 mb-1">Elle a dit :</div>
          <div className="text-2xl font-extrabold text-emerald-900">{titleCase(c.audio_en)}</div>
        </div>
      )}

      {canGoBack && <Button variant="ghost" onClick={onBack}>← Précédent</Button>}
    </div>
  )
}

/* ============================================================================
   PHASE 3 — FLASHCARD
   ============================================================================ */
function StepFlashcard({ c, onContinue, onBack, canGoBack }: {
  c: { lemma: string; gloss_fr: string; definition_fr?: string }
  onContinue: (correct: boolean) => void; onBack: () => void; canGoBack: boolean
}) {
  const [revealed, setRevealed] = useState(false)
  const [picked, setPicked] = useState<'savais' | 'hesite' | 'pas_su' | null>(null)

  useEffect(() => {
    setRevealed(false); setPicked(null)
    const t = setTimeout(() => speakSequence([{ text: c.lemma, lang: 'en-GB' }], 0.9), 400)
    return () => { clearTimeout(t); stopSpeaking() }
  }, [c.lemma])

  function speakAgain() { speakSequence([{ text: c.lemma, lang: 'en-GB' }], 0.9) }

  function flip() {
    if (revealed) return
    setRevealed(true)
    setTimeout(() => speakSequence([
      { text: c.gloss_fr, lang: 'fr-FR' as const, pauseAfter: 500 },
      ...(c.definition_fr ? [{ text: c.definition_fr, lang: 'fr-FR' as const }] : []),
    ], 0.9), 400)
  }

  function pickGrade(g: 'savais' | 'hesite' | 'pas_su') {
    if (picked) return
    setPicked(g)
    // v9.2 — Encouragement vocal selon le grade
    const msg = g === 'savais' ? 'Excellent !' : g === 'hesite' ? 'Tu y es presque.' : 'Pas grave, on recommencera.'
    speakSequence([{ text: msg, lang: 'fr-FR' }], 0.95)
    setTimeout(() => onContinue(g === 'savais'), 1000)
  }

  return (
    <div className="space-y-4 text-center">
      <div className="text-[10px] uppercase font-bold text-gray-500">Tu te souviens du sens ? Clique la carte.</div>

      <div className="flip-perspective" style={{ minHeight: 220 }}>
        <div className={`flip-3d cursor-pointer ${revealed ? 'flipped' : ''}`} style={{ minHeight: 220 }} onClick={flip}>
          <div className="flip-face bg-emerald-50 rounded-xl p-5 border-2 border-emerald-200">
            <div className="w-full">
              <div className="text-[10px] uppercase font-bold text-emerald-700 mb-2">🇬🇧 Mot anglais</div>
              <div className="text-3xl font-extrabold text-emerald-900">{titleCase(c.lemma)}</div>
              <button onClick={(e) => { e.stopPropagation(); speakAgain() }} className="mt-3 text-xs bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full font-semibold">🔊 Écouter</button>
              <div className="text-[11px] text-gray-500 italic mt-3">↻ Touche pour voir la traduction</div>
            </div>
          </div>
          <div className="flip-face flip-back bg-purple-50 rounded-xl p-5 border-2 border-purple-200">
            <div className="w-full">
              <div className="text-[10px] uppercase font-bold text-purple-700 mb-2">🇫🇷 Traduction</div>
              <div className="text-3xl font-extrabold text-purple-900">{titleCase(c.gloss_fr)}</div>
            </div>
          </div>
        </div>
      </div>

      {revealed && (
        <>
          <div className="text-[10px] uppercase font-bold text-gray-500 mt-2">Comment tu te débrouilles ?</div>
          <div className="grid grid-cols-3 gap-2">
            <button disabled={!!picked} onClick={() => pickGrade('pas_su')} className={`p-3 rounded-xl border-2 text-xs font-extrabold ${picked === 'pas_su' ? 'bg-red-600 text-white border-red-700 scale-105' : 'bg-white border-gray-300 hover:bg-red-50'}`}>😖<br />Je ne savais pas</button>
            <button disabled={!!picked} onClick={() => pickGrade('hesite')} className={`p-3 rounded-xl border-2 text-xs font-extrabold ${picked === 'hesite' ? 'bg-amber-600 text-white border-amber-700 scale-105' : 'bg-white border-gray-300 hover:bg-amber-50'}`}>🤔<br />J&apos;ai hésité</button>
            <button disabled={!!picked} onClick={() => pickGrade('savais')} className={`p-3 rounded-xl border-2 text-xs font-extrabold ${picked === 'savais' ? 'bg-emerald-600 text-white border-emerald-700 scale-105' : 'bg-white border-gray-300 hover:bg-emerald-50'}`}>✅<br />Je savais</button>
          </div>
        </>
      )}

      {canGoBack && !revealed && <Button variant="ghost" onClick={onBack}>← Précédent</Button>}
    </div>
  )
}

/* ============================================================================
   PHASE 4 — PRONONCIATION
   ============================================================================ */
function StepPronunciationBreakdown({ c, onContinue, onBack, canGoBack }: {
  c: { lemma: string; syllables: string[] }
  onContinue: () => void; onBack: () => void; canGoBack: boolean
}) {
  const [recording, setRecording] = useState(false)
  const [transcript, setTranscript] = useState<string | null>(null)
  const [score, setScore] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    setTranscript(null); setScore(null); setFeedback(null)
    const segs: SequenceSegment[] = [
      { text: c.lemma, lang: 'en-GB', pauseAfter: 700, rate: 0.7 },
    ]
    if (c.syllables.length > 1) {
      c.syllables.forEach(s => segs.push({ text: s, lang: 'en-GB', pauseAfter: 500, rate: 0.75 }))
      segs.push({ text: c.lemma, lang: 'en-GB', pauseAfter: 500, rate: 0.9 })
    }
    const t = setTimeout(() => speakSequence(segs, 0.85), 500)
    return () => { clearTimeout(t); stopSpeaking() }
  }, [c.lemma])

  function speakSlow() { speakSequence([{ text: c.lemma, lang: 'en-GB', rate: 0.6 }], 0.6) }
  function speakNormal() { speakSequence([{ text: c.lemma, lang: 'en-GB', rate: 0.95 }], 0.95) }

  async function recordMic() {
    if (recording) return
    setRecording(true); setTranscript(null); setScore(null); setFeedback(null)
    try {
      const res = await recognizeSpeech(c.lemma, 'en-US')
      const t = (res?.transcript || '').trim()
      setTranscript(t || '(rien entendu)')
      const sc = Math.round((res?.similarity || 0) * 100)
      setScore(sc)
      // v9.2 — Feedback vocal selon le score
      if (sc >= 80) {
        setFeedback('Bravo, tu as bien prononcé !')
        speakSequence([{ text: 'Bravo, tu as bien prononcé !', lang: 'fr-FR' }], 0.95)
        setTimeout(() => onContinue(), 2200)
      } else if (sc >= 50) {
        setFeedback('Bien, mais tu peux encore t\'améliorer.')
        speakSequence([
          { text: 'Bien, écoute encore une fois.', lang: 'fr-FR', pauseAfter: 500 },
          { text: c.lemma, lang: 'en-GB' },
        ], 0.9)
      } else {
        setFeedback('Essaye encore, écoute bien.')
        speakSequence([
          { text: 'Essaye encore, écoute bien.', lang: 'fr-FR', pauseAfter: 500 },
          { text: c.lemma, lang: 'en-GB', rate: 0.7 },
        ], 0.85)
      }
    } catch {
      setTranscript('(micro indisponible)')
    } finally {
      setRecording(false)
    }
  }

  return (
    <div className="space-y-4 text-center">
      <div className="text-[10px] uppercase font-bold text-gray-500">Apprends à le prononcer</div>
      <div className="text-3xl font-extrabold text-primary-900">{titleCase(c.lemma)}</div>

      {c.syllables.length > 1 && (
        <div className="flex justify-center gap-2 flex-wrap">
          {c.syllables.map((s, i) => (
            <button key={i} onClick={() => speakSequence([{ text: s, lang: 'en-GB', rate: 0.7 }], 0.7)} className="px-3 py-2 bg-primary-50 text-primary-800 rounded-lg font-semibold text-sm hover:bg-primary-100">
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2 justify-center">
        <button onClick={speakSlow} className="text-xs bg-primary-50 text-primary-700 font-semibold px-3 py-2 rounded-full">🐢 Lentement</button>
        <button onClick={speakNormal} className="text-xs bg-primary-50 text-primary-700 font-semibold px-3 py-2 rounded-full">🔊 Normal</button>
      </div>

      <div className="pt-2">
        <div className="text-xs text-gray-600 italic mb-2">Clique sur 🎤 et dis le mot à voix haute</div>
        <button onClick={recordMic} disabled={recording} className={`w-16 h-16 rounded-full text-2xl mx-auto flex items-center justify-center font-bold ${recording ? 'bg-warn text-white animate-pulse' : 'bg-primary-700 text-white'}`}>🎤</button>
      </div>

      {transcript && (
        <div className="bg-gray-50 rounded-xl p-3">
          <div className="text-[10px] uppercase font-bold text-gray-500 mb-1">Tu as dit</div>
          <div className="text-base">{transcript}</div>
          {score !== null && (
            <div className="text-xs mt-1">
              Score : <b className={score >= 80 ? 'text-emerald-700' : score >= 50 ? 'text-amber-700' : 'text-red-700'}>{score}%</b>
            </div>
          )}
          {feedback && (
            <div className={`text-sm font-bold mt-2 ${score && score >= 80 ? 'text-emerald-700' : score && score >= 50 ? 'text-amber-700' : 'text-red-700'}`}>
              {score && score >= 80 ? '🎯 ' : ''}{feedback}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        {canGoBack && <Button variant="ghost" onClick={onBack}>← Précédent</Button>}
        {(score === null || score < 80) && (
          <Button block onClick={onContinue}>Passer →</Button>
        )}
      </div>
    </div>
  )
}

/* ============================================================================
   PHASE 5 — SITUATION QCM
   ============================================================================ */
function StepSituationQcm({ c, onContinue, onBack, canGoBack }: {
  c: { context_emoji: string; context_fr: string; question_fr: string; options: string[]; correct: string }
  onContinue: (correct: boolean) => void; onBack: () => void; canGoBack: boolean
}) {
  const [picked, setPicked] = useState<string | null>(null)

  const shuffled = useMemo(() => {
    const a = [...c.options]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }, [c.options])

  useEffect(() => {
    setPicked(null)
    const segs: SequenceSegment[] = [
      { text: c.context_fr, lang: 'fr-FR', pauseAfter: 700 },
      { text: c.question_fr, lang: 'fr-FR', pauseAfter: 500 },
    ]
    const t = setTimeout(() => speakSequence(segs, 0.9), 400)
    return () => { clearTimeout(t); stopSpeaking() }
  }, [c.context_fr, c.question_fr])

  function pick(opt: string) {
    if (picked) return
    setPicked(opt)
    const isCorrect = opt === c.correct
    if (isCorrect) {
      speakSequence([
        { text: 'Très bien ! ', lang: 'fr-FR', pauseAfter: 300 },
        { text: c.correct, lang: 'en-GB' },
      ], 0.95)
      setTimeout(() => onContinue(true), 1800)
    } else {
      // v9.2 — Feedback erreur vocal : la bonne réponse était...
      speakSequence([
        { text: 'Non, la bonne réponse était :', lang: 'fr-FR', pauseAfter: 400 },
        { text: c.correct, lang: 'en-GB' },
      ], 0.9)
      setTimeout(() => onContinue(false), 2200)
    }
  }

  return (
    <div className="space-y-4 text-center">
      <div className="text-[10px] uppercase font-bold text-gray-500">Situation</div>
      <div className="text-6xl py-2">{c.context_emoji}</div>
      <div className="text-base text-gray-800 font-semibold">{c.context_fr}</div>
      <div className="text-sm text-gray-600">{c.question_fr}</div>

      <div className="space-y-2">
        {shuffled.map(opt => {
          const isCorrect = opt === c.correct
          const isPicked = picked === opt
          let cls = 'bg-white border-rule text-gray-800 hover:border-primary-300'
          if (picked) {
            if (isCorrect) cls = 'bg-emerald-500 border-emerald-600 text-white scale-105'
            else if (isPicked) cls = 'bg-red-500 border-red-600 text-white'
            else cls = 'bg-white border-gray-200 text-gray-400 opacity-50'
          }
          return (
            <button key={opt} disabled={!!picked} onClick={() => pick(opt)} className={`w-full p-3 rounded-xl border-2 text-sm font-semibold transition flex items-center justify-between ${cls}`}>
              <span>{titleCase(opt)}</span>
              {picked && isCorrect && <span>✓</span>}
              {isPicked && !isCorrect && <span>✗</span>}
            </button>
          )
        })}
      </div>

      {canGoBack && !picked && <Button variant="ghost" onClick={onBack}>← Précédent</Button>}
    </div>
  )
}

/* ============================================================================
   PHASE 5 — MINI DIALOG (style coach interactif)
   v9.3 — Le coach pose une question contextuelle ("Tu rencontres un ami qui te
   dit Hello. Que lui réponds-tu ?"). L'utilisateur répond au micro. Pas de
   liste de répliques affichée comme un script.
   ============================================================================ */
function StepMiniDialog({ c, onContinue, onBack, canGoBack }: {
  c: { context_emoji: string; context_fr: string; turns: { speaker: string; text_en: string; text_fr: string; is_user?: boolean }[] }
  onContinue: () => void; onBack: () => void; canGoBack: boolean
}) {
  const [recording, setRecording] = useState(false)
  const [userSaid, setUserSaid] = useState<string | null>(null)
  const [userScore, setUserScore] = useState<number | null>(null)
  const [showExpected, setShowExpected] = useState(false)

  // v9.3 — Trouve la 1ère réplique non-user (= ce que l'ami dit) et la 1ère réplique user
  const friendTurn = useMemo(() => c.turns.find(t => !t.is_user), [c.turns])
  const userTurn = useMemo(() => c.turns.find(t => t.is_user), [c.turns])
  const friendQuestion = useMemo(() => {
    if (!friendTurn) return ''
    // Construit la question coach style : "Tu rencontres un ami à l'école. Il te dit Hello. Que lui réponds-tu ?"
    return `${c.context_fr} Il te dit ${friendTurn.text_en}. Que lui réponds-tu ?`
  }, [c.context_fr, friendTurn])

  useEffect(() => {
    setUserSaid(null); setUserScore(null); setShowExpected(false)
    const segs: SequenceSegment[] = []
    // Coach pose la question (voix FR avec mot EN intercalé via **xxx**)
    segs.push({ text: c.context_fr, lang: 'fr-FR', pauseAfter: 600 })
    if (friendTurn) {
      segs.push({ text: 'Ton ami te dit :', lang: 'fr-FR', pauseAfter: 300 })
      segs.push({ text: friendTurn.text_en, lang: 'en-GB', pauseAfter: 700 })
      segs.push({ text: 'Que lui réponds-tu ?', lang: 'fr-FR', pauseAfter: 500 })
    }
    const t = setTimeout(() => speakSequence(segs, 0.9), 400)
    return () => { clearTimeout(t); stopSpeaking() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.context_fr, friendTurn?.text_en])

  async function recordUser() {
    if (recording || !userTurn) return
    setRecording(true)
    try {
      const res = await recognizeSpeech(userTurn.text_en || '', 'en-US')
      const t = (res?.transcript || '').trim()
      const sc = Math.round((res?.similarity || 0) * 100)
      setUserSaid(t || '(rien entendu)')
      setUserScore(sc)
      if (sc >= 60) {
        speakSequence([
          { text: 'Bravo !', lang: 'fr-FR', pauseAfter: 400 },
          { text: userTurn.text_en, lang: 'en-GB' },
        ], 0.95)
        setTimeout(() => onContinue(), 2000)
      } else {
        // v9.3 — Feedback explicite : montre + dit la réponse attendue
        setShowExpected(true)
        speakSequence([
          { text: 'On dit :', lang: 'fr-FR', pauseAfter: 300 },
          { text: userTurn.text_en, lang: 'en-GB' },
        ], 0.9)
        setTimeout(() => onContinue(), 2500)
      }
    } catch {
      setUserSaid('(micro indisponible)')
    } finally {
      setRecording(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="text-center text-[10px] uppercase font-bold text-gray-500">Mise en situation</div>
      <div className="text-center text-7xl py-2">{c.context_emoji}</div>
      <div className="text-center text-base text-gray-800 font-semibold">{c.context_fr}</div>

      {friendTurn && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-3">
          <div className="text-xs font-bold text-blue-700 mb-1">{friendTurn.speaker} :</div>
          <div className="text-lg font-extrabold text-blue-900">{titleCase(friendTurn.text_en)}</div>
        </div>
      )}

      <div className="text-center text-sm text-gray-700 font-semibold">Que lui réponds-tu ?</div>

      {!userSaid && userTurn && (
        <div className="text-center space-y-2 pt-2">
          <div className="text-xs text-gray-600 italic">Clique sur 🎤 et réponds à voix haute</div>
          <button onClick={recordUser} disabled={recording} className={`w-20 h-20 rounded-full text-3xl mx-auto flex items-center justify-center font-bold shadow-lg ${recording ? 'bg-warn text-white animate-pulse' : 'bg-primary-700 text-white hover:scale-105'}`}>🎤</button>
        </div>
      )}

      {userSaid && (
        <div className={`rounded-xl p-3 text-center ${userScore && userScore >= 60 ? 'bg-emerald-50 border-2 border-emerald-300' : 'bg-amber-50 border-2 border-amber-300'}`}>
          <div className="text-[10px] uppercase font-bold text-gray-600 mb-1">Tu as dit</div>
          <div className="text-base font-bold">{userSaid}</div>
          {userScore !== null && (
            <div className="text-xs mt-1">
              Score : <b className={userScore >= 60 ? 'text-emerald-700' : 'text-amber-700'}>{userScore}%</b>
              {userScore >= 60 ? ' — Bravo !' : ' — pas tout à fait'}
            </div>
          )}
          {showExpected && userTurn && (
            <div className="mt-2 pt-2 border-t border-amber-200 text-sm">
              On dit : <b className="text-emerald-700">{titleCase(userTurn.text_en)}</b>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        {canGoBack && <Button variant="ghost" onClick={onBack}>← Précédent</Button>}
        {!userTurn && <Button block onClick={onContinue}>Continuer →</Button>}
      </div>
    </div>
  )
}

/* ============================================================================
   PHASE 6 — QCM AUDIO
   ============================================================================ */
function StepQcmAudio({ c, onContinue, onBack, canGoBack }: {
  c: { audio_en: string; question_fr: string; options: string[]; correct: string }
  onContinue: (correct: boolean) => void; onBack: () => void; canGoBack: boolean
}) {
  const [picked, setPicked] = useState<string | null>(null)

  const shuffled = useMemo(() => {
    const a = [...c.options]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }, [c.options])

  useEffect(() => {
    setPicked(null)
    const segs: SequenceSegment[] = [
      { text: c.audio_en, lang: 'en-GB', pauseAfter: 700 },
      { text: c.question_fr, lang: 'fr-FR', pauseAfter: 500 },
    ]
    const t = setTimeout(() => speakSequence(segs, 0.9), 400)
    return () => { clearTimeout(t); stopSpeaking() }
  }, [c.audio_en, c.question_fr])

  function replay() { speakSequence([{ text: c.audio_en, lang: 'en-GB' }], 0.9) }

  function pick(opt: string) {
    if (picked) return
    setPicked(opt)
    const isCorrect = opt === c.correct
    if (isCorrect) {
      speakSequence([{ text: 'Très bien !', lang: 'fr-FR' }], 0.95)
      setTimeout(() => onContinue(true), 1200)
    } else {
      // v9.3 — Feedback explicite : redire le mot EN + sa traduction
      speakSequence([
        { text: 'Non, ', lang: 'fr-FR', pauseAfter: 200 },
        { text: c.audio_en, lang: 'en-GB', pauseAfter: 300 },
        { text: `veut dire ${c.correct}`, lang: 'fr-FR' },
      ], 0.9)
      setTimeout(() => onContinue(false), 2800)
    }
  }

  return (
    <div className="space-y-4 text-center">
      <div className="text-[10px] uppercase font-bold text-gray-500">Écoute et choisis</div>
      <div className="bg-primary-50 rounded-xl p-5">
        <div className="text-2xl font-extrabold text-primary-900">🔊 {titleCase(c.audio_en)}</div>
        <button onClick={replay} className="mt-2 text-xs bg-primary-100 text-primary-700 font-semibold px-3 py-1.5 rounded-full">🔊 Réécouter</button>
      </div>
      <div className="text-sm text-gray-700">{c.question_fr}</div>

      <div className="space-y-2">
        {shuffled.map(opt => {
          const isCorrect = opt === c.correct
          const isPicked = picked === opt
          let cls = 'bg-white border-rule text-gray-800 hover:border-primary-300'
          if (picked) {
            if (isCorrect) cls = 'bg-emerald-500 border-emerald-600 text-white scale-105'
            else if (isPicked) cls = 'bg-red-500 border-red-600 text-white'
            else cls = 'bg-white border-gray-200 text-gray-400 opacity-50'
          }
          return (
            <button key={opt} disabled={!!picked} onClick={() => pick(opt)} className={`w-full p-3 rounded-xl border-2 text-sm font-semibold transition ${cls}`}>
              {titleCase(opt)}
            </button>
          )
        })}
      </div>

      {canGoBack && !picked && <Button variant="ghost" onClick={onBack}>← Précédent</Button>}
    </div>
  )
}

/* ============================================================================
   PHASE 6 — ASSOCIATION
   ============================================================================ */
function StepAssociation({ c, onContinue, onBack, canGoBack }: {
  c: { question_fr: string; pairs: { left: string; right: string }[] }
  onContinue: (correct: boolean) => void; onBack: () => void; canGoBack: boolean
}) {
  const [matches, setMatches] = useState<Record<number, number>>({})
  const [leftPicked, setLeftPicked] = useState<number | null>(null)
  const [done, setDone] = useState(false)
  const [lastErrorMsg, setLastErrorMsg] = useState<string | null>(null)

  const lefts = c.pairs.map(p => p.left)
  const rights = useMemo(() => {
    const r = c.pairs.map((p, i) => ({ text: p.right, originalIdx: i }))
    for (let i = r.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[r[i], r[j]] = [r[j], r[i]]
    }
    return r
  }, [c.pairs])

  useEffect(() => {
    setMatches({}); setLeftPicked(null); setDone(false); setLastErrorMsg(null)
    const t = setTimeout(() => speakSequence([{ text: c.question_fr, lang: 'fr-FR' }], 0.9), 400)
    return () => { clearTimeout(t); stopSpeaking() }
  }, [c.question_fr])

  function clickLeft(i: number) {
    if (done || matches[i] !== undefined) return
    setLeftPicked(i); setLastErrorMsg(null)
    // v9.3 — Au clic sur l'emoji left, lit son expression EN correspondante
    // (aide l'utilisateur à comprendre ce que l'emoji représente)
    speakSequence([{ text: c.pairs[i].right, lang: 'en-GB' }], 0.9)
  }

  function clickRight(displayIdx: number) {
    if (done || leftPicked === null) return
    const rightOriginalIdx = rights[displayIdx].originalIdx
    const isCorrect = rightOriginalIdx === leftPicked
    setMatches(prev => ({ ...prev, [leftPicked]: rightOriginalIdx }))
    if (isCorrect) {
      speakSequence([
        { text: 'Bien !', lang: 'fr-FR', pauseAfter: 300 },
        { text: c.pairs[rightOriginalIdx].right, lang: 'en-GB' },
      ], 0.95)
    } else {
      const expectedRight = c.pairs[leftPicked].right
      const wrongRight = c.pairs[rightOriginalIdx].right
      setLastErrorMsg(`La bonne paire était : ${expectedRight}`)
      // v9.3 — Feedback explicite : dire ce qui aurait été bon
      speakSequence([
        { text: 'Non. ', lang: 'fr-FR', pauseAfter: 200 },
        { text: wrongRight, lang: 'en-GB', pauseAfter: 300 },
        { text: 'ne va pas ici. Ça aurait été :', lang: 'fr-FR', pauseAfter: 300 },
        { text: expectedRight, lang: 'en-GB' },
      ], 0.9)
    }
    setLeftPicked(null)
  }

  useEffect(() => {
    if (Object.keys(matches).length === c.pairs.length && !done) {
      setDone(true)
      const allCorrect = Object.entries(matches).every(([leftIdx, rightOrig]) => parseInt(leftIdx) === rightOrig)
      setTimeout(() => onContinue(allCorrect), 1800)
    }
  }, [matches, c.pairs.length, done, onContinue])

  return (
    <div className="space-y-4">
      <div className="text-center text-[10px] uppercase font-bold text-gray-500">Associe les paires</div>
      <div className="text-center text-sm text-gray-700">{c.question_fr}</div>

      <div className="grid grid-cols-2 gap-3 pt-2">
        <div className="space-y-2">
          {lefts.map((l, i) => {
            const matched = matches[i] !== undefined
            const isPicked = leftPicked === i
            const isCorrect = matched && matches[i] === i
            let cls = 'bg-white border-gray-300'
            if (matched) cls = isCorrect ? 'bg-emerald-100 border-emerald-300' : 'bg-red-100 border-red-300'
            else if (isPicked) cls = 'bg-blue-200 border-blue-400 scale-105'
            return (
              <button key={i} disabled={matched} onClick={() => clickLeft(i)} className={`w-full p-4 rounded-xl border-2 text-3xl font-bold transition ${cls}`}>
                {l}
              </button>
            )
          })}
        </div>
        <div className="space-y-2">
          {rights.map((r, displayIdx) => {
            const matched = Object.values(matches).includes(r.originalIdx)
            const correctEntry = Object.entries(matches).find(([li, ri]) => ri === r.originalIdx)
            const isCorrect = matched && correctEntry && parseInt(correctEntry[0]) === r.originalIdx
            let cls = 'bg-white border-gray-300 hover:border-primary-400'
            if (matched) cls = isCorrect ? 'bg-emerald-100 border-emerald-300 text-emerald-900' : 'bg-red-100 border-red-300 text-red-900'
            return (
              <button key={displayIdx} disabled={matched} onClick={() => clickRight(displayIdx)} className={`w-full p-3 rounded-xl border-2 text-sm font-semibold transition ${cls}`}>
                {titleCase(r.text)}
              </button>
            )
          })}
        </div>
      </div>

      {lastErrorMsg && (
        <div className="text-center text-xs text-red-600 italic">{lastErrorMsg}</div>
      )}

      {canGoBack && !done && <Button variant="ghost" onClick={onBack}>← Précédent</Button>}
    </div>
  )
}

/* ============================================================================
   PHASE 6 — GAP FILL
   ============================================================================ */
function StepGapFill({ c, onContinue, onBack, canGoBack }: {
  c: { sentence_with_blank: string; options: string[]; correct: string; sentence_fr?: string }
  onContinue: (correct: boolean) => void; onBack: () => void; canGoBack: boolean
}) {
  const [picked, setPicked] = useState<string | null>(null)

  const shuffled = useMemo(() => {
    const a = [...c.options]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }, [c.options])

  // v9.3 — Nettoyage TTS : retire les traits bas COMPLÈTEMENT (TTS lisait
  // "horizontal line" / "underscore"). Aussi retire la virgule (lue "comma").
  function cleanForTTS(text: string): string {
    return text
      .replace(/_+/g, ' ')          // ___ → espace (silence)
      .replace(/,/g, ' ')           // virgule → pause silencieuse
      .replace(/\s+/g, ' ')         // collapse spaces
      .trim()
  }

  useEffect(() => {
    setPicked(null)
    const sentenceForSpeech = cleanForTTS(c.sentence_with_blank)
    const segs: SequenceSegment[] = [
      { text: 'Complète la phrase.', lang: 'fr-FR', pauseAfter: 400 },
      { text: sentenceForSpeech, lang: 'en-GB', pauseAfter: 600 },
    ]
    const t = setTimeout(() => speakSequence(segs, 0.9), 400)
    return () => { clearTimeout(t); stopSpeaking() }
  }, [c.sentence_with_blank])

  function pick(opt: string) {
    if (picked) return
    setPicked(opt)
    const isCorrect = opt === c.correct
    const completed = cleanForTTS(c.sentence_with_blank.replace(/_+/g, c.correct))
    if (isCorrect) {
      speakSequence([
        { text: 'Très bien !', lang: 'fr-FR', pauseAfter: 400 },
        { text: completed, lang: 'en-GB' },
      ], 0.95)
      setTimeout(() => onContinue(true), 1800)
    } else {
      // v9.2 — Feedback vocal pour mauvaise réponse
      speakSequence([
        { text: 'Non, la bonne réponse était :', lang: 'fr-FR', pauseAfter: 400 },
        { text: c.correct, lang: 'en-GB' },
        { text: completed, lang: 'en-GB' },
      ], 0.9)
      setTimeout(() => onContinue(false), 2800)
    }
  }

  const displaySentence = picked
    ? c.sentence_with_blank.replace(/_+/g, `[${picked}]`)
    : c.sentence_with_blank

  return (
    <div className="space-y-4 text-center">
      <div className="text-[10px] uppercase font-bold text-gray-500">Complète la phrase</div>
      <div className="bg-amber-50 rounded-xl p-5 text-xl font-bold text-gray-900 italic">{titleCase(displaySentence)}</div>
      {c.sentence_fr && <div className="text-xs text-gray-500 italic">{c.sentence_fr}</div>}

      <div className="space-y-2">
        {shuffled.map(opt => {
          const isCorrect = opt === c.correct
          const isPicked = picked === opt
          let cls = 'bg-white border-rule text-gray-800 hover:border-primary-300'
          if (picked) {
            if (isCorrect) cls = 'bg-emerald-500 border-emerald-600 text-white scale-105'
            else if (isPicked) cls = 'bg-red-500 border-red-600 text-white'
            else cls = 'bg-white border-gray-200 text-gray-400 opacity-50'
          }
          return (
            <button key={opt} disabled={!!picked} onClick={() => pick(opt)} className={`w-full p-3 rounded-xl border-2 text-base font-semibold transition ${cls}`}>
              {titleCase(opt)}
            </button>
          )
        })}
      </div>

      {/* v9.2 — Affiche la bonne réponse en clair quand mauvaise réponse */}
      {picked && picked !== c.correct && (
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-3 text-sm">
          La bonne réponse était : <b className="text-emerald-700">{titleCase(c.correct)}</b>
        </div>
      )}

      {canGoBack && !picked && <Button variant="ghost" onClick={onBack}>← Précédent</Button>}
    </div>
  )
}

/* ============================================================================
   PHASE 7 — FINAL VALIDATION (mots EN entre **xxx** → parseMixedText les détecte)
   ============================================================================ */
function StepFinalValidation({ c, onContinue, userName, lessonTitle }: {
  c: { title_fr: string; achievements: string[] }
  onContinue: () => void
  userName?: string
  lessonTitle?: string
}) {
  const firstName = userName?.split(' ')[0]

  useEffect(() => {
    const segs: SequenceSegment[] = []
    if (firstName && lessonTitle) {
      segs.push({ text: `Bravo ${firstName}, tu as terminé ton cours sur ${lessonTitle}.`, lang: 'fr-FR', pauseAfter: 1000 })
    } else if (firstName) {
      segs.push({ text: `Bravo ${firstName}, tu as terminé ce cours.`, lang: 'fr-FR', pauseAfter: 1000 })
    } else {
      segs.push({ text: 'Bravo, tu as terminé ce cours.', lang: 'fr-FR', pauseAfter: 1000 })
    }
    if (c.achievements?.length) {
      segs.push({ text: 'Tu sais maintenant :', lang: 'fr-FR', pauseAfter: 700 })
      // v9.2 — Les achievements contiennent des **xxx** pour les mots EN.
      // speakSequence + parseMixedText les détectent et bascule la voix EN automatiquement.
      c.achievements.forEach(a => segs.push({ text: a, lang: 'fr-FR', pauseAfter: 600 }))
    }
    const t = setTimeout(() => speakSequence(segs, 0.9), 500)
    return () => { clearTimeout(t); stopSpeaking() }
  }, [firstName, lessonTitle, c.achievements])

  return (
    <div className="text-center space-y-4">
      <img src="/dodo-champion.png" alt="Dodo champion" className="w-48 h-48 mx-auto object-contain" />
      <h2 className="text-2xl font-extrabold text-primary-900">
        Bravo {firstName || ''} !
      </h2>
      {lessonTitle && <p className="text-sm text-primary-700">Tu as terminé : {lessonTitle}</p>}

      {c.achievements?.length > 0 && (
        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 text-left">
          <div className="text-sm uppercase font-bold text-green-700 tracking-wide mb-2">
            Tu sais maintenant :
          </div>
          <ul className="space-y-2">
            {c.achievements.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-base font-semibold text-gray-900">
                <span className="text-green-700">✅</span>
                {/* Affichage sans les ** (qui sont des marqueurs TTS uniquement) */}
                <span>{a.replace(/\*\*/g, '')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Button block onClick={onContinue}>Terminer la leçon</Button>
    </div>
  )
}
