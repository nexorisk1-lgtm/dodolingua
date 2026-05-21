'use client'

/**
 * v9.1 — Composant unique gérant les 10 types de step d'une leçon vocab A1
 * (architecture cohérente avec GrammarStepV6).
 *
 * Types supportés :
 *   - discovery_word        : Phase 1 (mot + traduction + définition + exemple + contexte)
 *   - immersion_scene       : Phase 2 (mini scène audio sans texte EN au démarrage)
 *   - flashcard             : Phase 3 (carte EN/FR retournable, 3 boutons FSRS)
 *   - pronunciation_breakdown : Phase 4 (décomposition syllabique + micro)
 *   - situation_qcm         : Phase 5 (contexte + QCM 3 choix)
 *   - mini_dialog           : Phase 5 (dialogue à compléter)
 *   - qcm_audio             : Phase 6 (audio → sens, QCM)
 *   - association           : Phase 6 (paires emoji ↔ expression)
 *   - gap_fill              : Phase 6 (phrase à trou + 3 options)
 *   - final_validation      : Phase 7 (Bravo + acquis, voix complète)
 *
 * Auto-voice EN→FR via speakSequence (réutilise utils.ts).
 * Voix EN : Daniel | Voix FR : Thomas (cohérence grammaire).
 * Footer TTS_VERSION sur l'écran final.
 */

import { useEffect, useMemo, useState } from 'react'
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

export function VocabLessonStep({ step, onContinue, onBack, canGoBack, isLast, userName, lessonTitle }: Props) {
  const c = step.content_json

  switch (step.type) {
    case 'discovery_word':
      return <StepDiscoveryWord c={c} onContinue={onContinue} onBack={onBack} canGoBack={canGoBack} />
    case 'immersion_scene':
      return <StepImmersionScene c={c} onContinue={onContinue} onBack={onBack} canGoBack={canGoBack} />
    case 'flashcard':
      return <StepFlashcard c={c} onContinue={onContinue} onBack={onBack} canGoBack={canGoBack} />
    case 'pronunciation_breakdown':
      return <StepPronunciationBreakdown c={c} onContinue={onContinue} onBack={onBack} canGoBack={canGoBack} />
    case 'situation_qcm':
      return <StepSituationQcm c={c} onContinue={onContinue} onBack={onBack} canGoBack={canGoBack} />
    case 'mini_dialog':
      return <StepMiniDialog c={c} onContinue={onContinue} onBack={onBack} canGoBack={canGoBack} />
    case 'qcm_audio':
      return <StepQcmAudio c={c} onContinue={onContinue} onBack={onBack} canGoBack={canGoBack} />
    case 'association':
      return <StepAssociation c={c} onContinue={onContinue} onBack={onBack} canGoBack={canGoBack} />
    case 'gap_fill':
      return <StepGapFill c={c} onContinue={onContinue} onBack={onBack} canGoBack={canGoBack} />
    case 'final_validation':
      return <StepFinalValidation c={c} onContinue={onContinue} userName={userName} lessonTitle={lessonTitle} />
    default:
      return <div className="text-sm text-gray-500 italic">Type de step inconnu : {step.type}</div>
  }
}

/* ===========================================================================
   PHASE 1 — DÉCOUVERTE
   =========================================================================== */
function StepDiscoveryWord({ c, onContinue, onBack, canGoBack }: {
  c: { lemma: string; gloss_fr: string; definition_fr: string; example_en: string; example_fr: string; context_emojis: string; context_fr: string }
  onContinue: () => void; onBack: () => void; canGoBack: boolean
}) {
  useEffect(() => {
    const segs: SequenceSegment[] = []
    segs.push({ text: c.lemma, lang: 'en-GB', pauseAfter: 600 })
    segs.push({ text: `veut dire ${c.gloss_fr}`, lang: 'fr-FR', pauseAfter: 700 })
    if (c.definition_fr) segs.push({ text: c.definition_fr, lang: 'fr-FR', pauseAfter: 600 })
    if (c.example_en) {
      segs.push({ text: 'Par exemple…', lang: 'fr-FR', pauseAfter: 300 })
      segs.push({ text: c.example_en, lang: 'en-GB', pauseAfter: 500 })
      if (c.example_fr) segs.push({ text: c.example_fr, lang: 'fr-FR', pauseAfter: 400 })
    }
    const t = setTimeout(() => speakSequence(segs, 0.9), 500)
    return () => { clearTimeout(t); stopSpeaking() }
  }, [c.lemma])

  function replay() {
    const segs: SequenceSegment[] = [
      { text: c.lemma, lang: 'en-GB', pauseAfter: 500 },
      { text: `veut dire ${c.gloss_fr}`, lang: 'fr-FR', pauseAfter: 500 },
    ]
    if (c.example_en) {
      segs.push({ text: c.example_en, lang: 'en-GB', pauseAfter: 400 })
      if (c.example_fr) segs.push({ text: c.example_fr, lang: 'fr-FR' })
    }
    speakSequence(segs, 0.9)
  }

  return (
    <div className="space-y-4 text-center">
      <div className="text-[10px] uppercase font-bold text-gray-500">Voici un nouveau mot</div>
      <div className="text-4xl font-extrabold text-primary-900">{c.lemma}</div>
      <button onClick={replay} className="text-sm bg-primary-50 text-primary-700 font-semibold px-4 py-1.5 rounded-full">🔊 Réécouter</button>

      <div className="bg-primary-50 rounded-xl p-3">
        <div className="text-[10px] uppercase font-bold text-primary-700 mb-1">🇫🇷 Traduction</div>
        <div className="text-base font-bold text-primary-900">{c.gloss_fr}</div>
      </div>

      {c.definition_fr && (
        <div className="bg-gray-50 rounded-xl p-3 text-left">
          <div className="text-[10px] uppercase font-bold text-gray-500 mb-1">Définition</div>
          <div className="text-sm text-gray-800">{c.definition_fr}</div>
        </div>
      )}

      {c.example_en && (
        <div className="bg-amber-50 rounded-xl p-3 text-left">
          <div className="text-[10px] uppercase font-bold text-amber-700 mb-1">Exemple</div>
          <div className="text-base italic text-gray-900 font-semibold">{c.example_en}</div>
          {c.example_fr && <div className="text-sm italic text-gray-600 mt-1">{c.example_fr}</div>}
        </div>
      )}

      {c.context_emojis && (
        <div className="text-2xl tracking-wide">{c.context_emojis}</div>
      )}

      <div className="flex gap-2 pt-2">
        {canGoBack && <Button variant="ghost" onClick={onBack}>← Précédent</Button>}
        <Button block onClick={onContinue}>Continuer →</Button>
      </div>
    </div>
  )
}

/* ===========================================================================
   PHASE 2 — IMMERSION
   =========================================================================== */
function StepImmersionScene({ c, onContinue, onBack, canGoBack }: {
  c: { context_emoji: string; context_fr: string; audio_en: string }
  onContinue: () => void; onBack: () => void; canGoBack: boolean
}) {
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    setRevealed(false)
    // Sequence : contexte FR → audio EN (sans afficher le texte EN avant reveal)
    const segs: SequenceSegment[] = [
      { text: c.context_fr, lang: 'fr-FR', pauseAfter: 800 },
      { text: c.audio_en, lang: 'en-GB', pauseAfter: 500 },
    ]
    const t = setTimeout(() => speakSequence(segs, 0.9), 500)
    return () => { clearTimeout(t); stopSpeaking() }
  }, [c.audio_en, c.context_fr])

  function replayEn() {
    speakSequence([{ text: c.audio_en, lang: 'en-GB' }], 0.85)
  }

  return (
    <div className="space-y-4 text-center">
      <div className="text-[10px] uppercase font-bold text-gray-500">Écoute la scène</div>
      <div className="text-7xl py-4">{c.context_emoji}</div>
      <div className="text-base text-gray-800 font-semibold">{c.context_fr}</div>

      <button onClick={replayEn} className="text-sm bg-primary-50 text-primary-700 font-semibold px-4 py-2 rounded-full">
        🔊 Réécouter
      </button>

      {!revealed ? (
        <button onClick={() => setRevealed(true)} className="text-sm text-primary-700 underline">
          Voir ce que la personne a dit
        </button>
      ) : (
        <div className="bg-emerald-50 rounded-xl p-3">
          <div className="text-[10px] uppercase font-bold text-emerald-700 mb-1">Elle a dit :</div>
          <div className="text-xl font-extrabold text-emerald-900">{c.audio_en}</div>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        {canGoBack && <Button variant="ghost" onClick={onBack}>← Précédent</Button>}
        <Button block onClick={onContinue}>Continuer →</Button>
      </div>
    </div>
  )
}

/* ===========================================================================
   PHASE 3 — FLASHCARD
   =========================================================================== */
function StepFlashcard({ c, onContinue, onBack, canGoBack }: {
  c: { lemma: string; gloss_fr: string; definition_fr: string }
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
    // Lecture FR au flip
    setTimeout(() => speakSequence([
      { text: c.gloss_fr, lang: 'fr-FR', pauseAfter: 500 },
      ...(c.definition_fr ? [{ text: c.definition_fr, lang: 'fr-FR' as const }] : []),
    ], 0.9), 400)
  }

  function pickGrade(g: 'savais' | 'hesite' | 'pas_su') {
    if (picked) return
    setPicked(g)
    setTimeout(() => onContinue(g === 'savais'), 600)
  }

  return (
    <div className="space-y-4 text-center">
      <div className="text-[10px] uppercase font-bold text-gray-500">Tu te souviens du sens ? Clique pour retourner la carte.</div>

      <div className="flip-perspective" style={{ minHeight: 220 }}>
        <div className={`flip-3d cursor-pointer ${revealed ? 'flipped' : ''}`} style={{ minHeight: 220 }} onClick={flip}>
          <div className="flip-face bg-emerald-50 rounded-xl p-5 border-2 border-emerald-200">
            <div className="w-full">
              <div className="text-[10px] uppercase font-bold text-emerald-700 mb-2">🇬🇧 Mot anglais</div>
              <div className="text-3xl font-extrabold text-emerald-900">{c.lemma}</div>
              <button onClick={(e) => { e.stopPropagation(); speakAgain() }} className="mt-3 text-xs bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full font-semibold">🔊 Écouter</button>
              <div className="text-[11px] text-gray-500 italic mt-3">↻ Touche pour voir la traduction</div>
            </div>
          </div>
          <div className="flip-face flip-back bg-purple-50 rounded-xl p-5 border-2 border-purple-200">
            <div className="w-full">
              <div className="text-[10px] uppercase font-bold text-purple-700 mb-2">🇫🇷 Traduction</div>
              <div className="text-3xl font-extrabold text-purple-900">{c.gloss_fr}</div>
              {c.definition_fr && <div className="text-xs text-purple-700 italic mt-2">{c.definition_fr}</div>}
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

      {canGoBack && !revealed && (
        <Button variant="ghost" onClick={onBack}>← Précédent</Button>
      )}
    </div>
  )
}

/* ===========================================================================
   PHASE 4 — PRONONCIATION (avec décomposition syllabique + micro)
   =========================================================================== */
function StepPronunciationBreakdown({ c, onContinue, onBack, canGoBack }: {
  c: { lemma: string; syllables: string[] }
  onContinue: () => void; onBack: () => void; canGoBack: boolean
}) {
  const [recording, setRecording] = useState(false)
  const [transcript, setTranscript] = useState<string | null>(null)
  const [score, setScore] = useState<number | null>(null)

  useEffect(() => {
    setTranscript(null); setScore(null)
    // Lit le mot complet lentement puis chaque syllabe
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
    setRecording(true)
    setTranscript(null); setScore(null)
    try {
      const res = await recognizeSpeech(c.lemma, 'en-US')
      const t = (res?.transcript || '').trim()
      setTranscript(t || '(rien entendu)')
      setScore(Math.round((res?.similarity || 0) * 100))
    } catch {
      setTranscript('(micro indisponible)')
    } finally {
      setRecording(false)
    }
  }

  return (
    <div className="space-y-4 text-center">
      <div className="text-[10px] uppercase font-bold text-gray-500">Apprends à le prononcer</div>
      <div className="text-3xl font-extrabold text-primary-900">{c.lemma}</div>

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
        <button onClick={recordMic} disabled={recording} className={`w-16 h-16 rounded-full text-2xl mx-auto flex items-center justify-center font-bold ${recording ? 'bg-warn text-white animate-pulse' : 'bg-primary-700 text-white'}`}>
          🎤
        </button>
      </div>

      {transcript && (
        <div className="bg-gray-50 rounded-xl p-3">
          <div className="text-[10px] uppercase font-bold text-gray-500 mb-1">Tu as dit</div>
          <div className="text-base">{transcript}</div>
          {score !== null && (
            <div className="text-xs mt-1">
              Score : <b className={score >= 80 ? 'text-emerald-700' : score >= 50 ? 'text-amber-700' : 'text-red-700'}>{score}%</b>
              {score >= 80 ? ' — excellent 🎯' : score >= 50 ? ' — à affiner' : ' — refais lentement'}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        {canGoBack && <Button variant="ghost" onClick={onBack}>← Précédent</Button>}
        <Button block onClick={onContinue}>Continuer →</Button>
      </div>
    </div>
  )
}

/* ===========================================================================
   PHASE 5 — SITUATION QCM (contexte + 3 choix)
   =========================================================================== */
function StepSituationQcm({ c, onContinue, onBack, canGoBack }: {
  c: { context_emoji: string; context_fr: string; question_fr: string; options: string[]; correct: string }
  onContinue: (correct: boolean) => void; onBack: () => void; canGoBack: boolean
}) {
  const [picked, setPicked] = useState<string | null>(null)

  // Shuffle options à chaque mount
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
    // Lit la bonne réponse en EN
    setTimeout(() => speakSequence([{ text: c.correct, lang: 'en-GB' }], 0.9), 200)
    setTimeout(() => onContinue(isCorrect), 1500)
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
              <span>{opt}</span>
              {picked && isCorrect && <span>✓</span>}
              {isPicked && !isCorrect && <span>✗</span>}
            </button>
          )
        })}
      </div>

      {canGoBack && !picked && (
        <Button variant="ghost" onClick={onBack}>← Précédent</Button>
      )}
    </div>
  )
}

/* ===========================================================================
   PHASE 5 — MINI DIALOG (dialogue à compléter)
   =========================================================================== */
function StepMiniDialog({ c, onContinue, onBack, canGoBack }: {
  c: { context_emoji: string; context_fr: string; turns: { speaker: string; text_en: string; text_fr: string; is_user?: boolean }[] }
  onContinue: () => void; onBack: () => void; canGoBack: boolean
}) {
  useEffect(() => {
    const segs: SequenceSegment[] = [
      { text: c.context_fr, lang: 'fr-FR', pauseAfter: 800 },
    ]
    c.turns.forEach(t => {
      segs.push({ text: t.text_en, lang: 'en-GB', pauseAfter: 600 })
      if (t.text_fr) segs.push({ text: t.text_fr, lang: 'fr-FR', pauseAfter: 500 })
    })
    const t = setTimeout(() => speakSequence(segs, 0.9), 500)
    return () => { clearTimeout(t); stopSpeaking() }
  }, [JSON.stringify(c.turns)])

  return (
    <div className="space-y-4">
      <div className="text-center text-[10px] uppercase font-bold text-gray-500">Mini dialogue</div>
      <div className="text-center text-5xl py-2">{c.context_emoji}</div>
      <div className="text-center text-sm text-gray-700 italic">{c.context_fr}</div>

      <div className="space-y-3 pt-2">
        {c.turns.map((t, i) => (
          <div key={i} className={`p-3 rounded-xl ${t.is_user ? 'bg-emerald-50 ml-8' : 'bg-blue-50 mr-8'}`}>
            <div className="text-xs font-bold text-gray-600 mb-1">{t.speaker}</div>
            <div className="text-base font-semibold text-primary-900">{t.text_en}</div>
            {t.text_fr && <div className="text-xs italic text-gray-600">{t.text_fr}</div>}
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-2">
        {canGoBack && <Button variant="ghost" onClick={onBack}>← Précédent</Button>}
        <Button block onClick={onContinue}>Continuer →</Button>
      </div>
    </div>
  )
}

/* ===========================================================================
   PHASE 6 — QCM AUDIO (audio → sens)
   =========================================================================== */
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
    setTimeout(() => onContinue(opt === c.correct), 1200)
  }

  return (
    <div className="space-y-4 text-center">
      <div className="text-[10px] uppercase font-bold text-gray-500">Écoute et choisis</div>
      <div className="bg-primary-50 rounded-xl p-5">
        <div className="text-2xl font-extrabold text-primary-900">🔊 {c.audio_en}</div>
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
              {opt}
            </button>
          )
        })}
      </div>

      {canGoBack && !picked && (
        <Button variant="ghost" onClick={onBack}>← Précédent</Button>
      )}
    </div>
  )
}

/* ===========================================================================
   PHASE 6 — ASSOCIATION (paires emoji ↔ expression)
   =========================================================================== */
function StepAssociation({ c, onContinue, onBack, canGoBack }: {
  c: { question_fr: string; pairs: { left: string; right: string }[] }
  onContinue: (correct: boolean) => void; onBack: () => void; canGoBack: boolean
}) {
  const [matches, setMatches] = useState<Record<number, number>>({}) // leftIdx → rightIdx
  const [leftPicked, setLeftPicked] = useState<number | null>(null)
  const [done, setDone] = useState(false)

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
    setMatches({}); setLeftPicked(null); setDone(false)
    const t = setTimeout(() => speakSequence([{ text: c.question_fr, lang: 'fr-FR' }], 0.9), 400)
    return () => { clearTimeout(t); stopSpeaking() }
  }, [c.question_fr])

  function clickLeft(i: number) {
    if (done) return
    if (matches[i] !== undefined) return
    setLeftPicked(i)
  }

  function clickRight(displayIdx: number) {
    if (done || leftPicked === null) return
    const rightOriginalIdx = rights[displayIdx].originalIdx
    setMatches(prev => ({ ...prev, [leftPicked]: rightOriginalIdx }))
    // Lit l'expression EN
    speakSequence([{ text: c.pairs[rightOriginalIdx].right, lang: 'en-GB' }], 0.9)
    setLeftPicked(null)
  }

  useEffect(() => {
    if (Object.keys(matches).length === c.pairs.length && !done) {
      setDone(true)
      // Vérif : toutes les paires correctes ?
      const allCorrect = Object.entries(matches).every(([leftIdx, rightOrig]) => parseInt(leftIdx) === rightOrig)
      setTimeout(() => onContinue(allCorrect), 1500)
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
            const isCorrect = matched && Object.entries(matches).find(([li, ri]) => ri === r.originalIdx)?.[0] === String(r.originalIdx)
            let cls = 'bg-white border-gray-300 hover:border-primary-400'
            if (matched) cls = isCorrect ? 'bg-emerald-100 border-emerald-300 text-emerald-900' : 'bg-red-100 border-red-300 text-red-900'
            return (
              <button key={displayIdx} disabled={matched} onClick={() => clickRight(displayIdx)} className={`w-full p-3 rounded-xl border-2 text-sm font-semibold transition ${cls}`}>
                {r.text}
              </button>
            )
          })}
        </div>
      </div>

      {canGoBack && !done && (
        <Button variant="ghost" onClick={onBack}>← Précédent</Button>
      )}
    </div>
  )
}

/* ===========================================================================
   PHASE 6 — GAP FILL (phrase à trou + 3 options)
   =========================================================================== */
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

  useEffect(() => {
    setPicked(null)
    // Lit la phrase avec un blanc audible
    const sentenceForSpeech = c.sentence_with_blank.replace(/_+/g, '… ')
    const segs: SequenceSegment[] = [
      { text: 'Complète la phrase.', lang: 'fr-FR', pauseAfter: 400 },
      { text: sentenceForSpeech, lang: 'en-GB', pauseAfter: 600 },
    ]
    if (c.sentence_fr) segs.push({ text: c.sentence_fr, lang: 'fr-FR', pauseAfter: 400 })
    const t = setTimeout(() => speakSequence(segs, 0.9), 400)
    return () => { clearTimeout(t); stopSpeaking() }
  }, [c.sentence_with_blank, c.sentence_fr])

  function pick(opt: string) {
    if (picked) return
    setPicked(opt)
    // Lit la phrase complétée
    setTimeout(() => {
      const completed = c.sentence_with_blank.replace(/_+/g, c.correct)
      speakSequence([{ text: completed, lang: 'en-GB' }], 0.9)
    }, 200)
    setTimeout(() => onContinue(opt === c.correct), 1500)
  }

  const displaySentence = picked
    ? c.sentence_with_blank.replace(/_+/g, `[${picked}]`)
    : c.sentence_with_blank

  return (
    <div className="space-y-4 text-center">
      <div className="text-[10px] uppercase font-bold text-gray-500">Complète la phrase</div>
      <div className="bg-amber-50 rounded-xl p-5 text-xl font-bold text-gray-900 italic">{displaySentence}</div>
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
              {opt}
            </button>
          )
        })}
      </div>

      {canGoBack && !picked && (
        <Button variant="ghost" onClick={onBack}>← Précédent</Button>
      )}
    </div>
  )
}

/* ===========================================================================
   PHASE 7 — FINAL VALIDATION (Bravo + acquis lus à voix haute, style v8.24)
   =========================================================================== */
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
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Button block onClick={onContinue}>Terminer la leçon</Button>
    </div>
  )
}
