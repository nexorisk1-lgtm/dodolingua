/**
 * v3.7 — Page session avec UI dédiée par phase :
 *   - 🔍 Discovery : image + mot + IPA + traduction + exemple + audio
 *   - 🎙️ Pronunciation : enregistrement micro + score vs phrase cible
 *   - 🃏 Flashcard : FR → "quel est le mot ?" → reveal → 3 boutons FSRS
 *   - 📝 QCM : EN → 4 choix FR → validation auto
 *   - 💬 Cloze : phrase à trous, 3 options
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ConceptImage } from '@/components/ConceptImage'
import { createClient } from '@/lib/supabase/client'
import { phaseLabel, phaseEmoji, type PlanItem, type Phase } from '@/lib/session-engine'
import { speak, getBestVoice, waitForVoices } from '@/components/games/utils'
import { extractWordScores, scoreAgainstTarget, type WordScore } from '@/components/coach/PronunciationBadge'
import { Mascot } from '@/components/Mascot'

interface WordData {
  id: string
  lemma: string
  ipa: string | null
  audio_url: string | null
  example: string | null
  gloss_fr: string | null
  image_url: string | null
  image_alt: string | null
  qcm: { correct: string; options: string[] }
  cloze: { sentence: string; correct: string; options: string[] } | null
}

declare global {
  interface Window {
    webkitSpeechRecognition?: any
    SpeechRecognition?: any
  }
}

export default function SessionRunner() {
  const router = useRouter()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [plan, setPlan] = useState<PlanItem[]>([])
  const [words, setWords] = useState<Record<string, WordData>>({})
  const [voiceName, setVoiceName] = useState<string | null>(null)
  const [idx, setIdx] = useState(0)
  const [done, setDone] = useState(false)
  const [points, setPoints] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // v3.7.4 — Track des échecs pour construire un tour de remédiation à la fin
  const [results, setResults] = useState<any[]>([])
  const [remediationActive, setRemediationActive] = useState(false)
  const [remediationCount, setRemediationCount] = useState(0)
  // v3.8.1 — corrections (révision unifiée)
  const [corrections, setCorrections] = useState<any[]>([])
  // v3.11 — détecte mode révision pour passer à submit
  const isReviewRef = useRef(false)

  const current = plan[idx]
  const word = current ? words[current.word_id] : null

  useEffect(() => {
    (async () => {
      const supabase = createClient()
      const search = new URLSearchParams(window.location.search)
      const isReview = search.get('mode') === 'revision'
      const typeFilter = search.get('type') || undefined  // v3.12 : 'words' | 'grammar'
      const forceNew = search.get('new') === '1'
      const courseId = search.get('course') || undefined  // v3.22 : ?course=A1-1
      isReviewRef.current = isReview

      // v3.21 — Reprise : check localStorage pour session non terminée < 24h
      const storageKey = `dodolingua-session-${isReview ? 'rev' : courseId ? `course-${courseId}` : 'learn'}-${typeFilter || 'def'}`
      if (!forceNew) {
        try {
          const saved = localStorage.getItem(storageKey)
          if (saved) {
            const state = JSON.parse(saved)
            const ageH = (Date.now() - (state.savedAt || 0)) / 3600000
            if (ageH < 24 && state.plan?.length > 0 && state.idx < state.plan.length) {
              // Reprise OK
              setSessionId(state.sessionId)
              setPlan(state.plan)
              setWords(state.words || {})
              setCorrections(state.corrections || [])
              setIdx(state.idx || 0)
              setResults(state.results || [])
              setRemediationActive(state.remediationActive || false)
              setRemediationCount(state.remediationCount || 0)
              const { data: { user } } = await supabase.auth.getUser()
              if (user) {
                const { data: vp } = await supabase.from('user_voice_pref')
                  .select('voice_name').eq('user_id', user.id).eq('lang_code', 'en-GB').maybeSingle()
                await waitForVoices(2000)
                if (vp?.voice_name) setVoiceName(vp.voice_name)
                else { const best = getBestVoice('en'); if (best?.name) setVoiceName(best.name) }
              }
              return
            } else {
              localStorage.removeItem(storageKey)
            }
          }
        } catch (e) { /* silent */ }
      }

      // Nouvelle session
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang_code: 'en-GB', word_count: isReview ? 15 : 5, mode: isReview ? 'revision' : undefined, type: typeFilter, course_id: courseId }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erreur'); return }
      setSessionId(data.id)
      setPlan(data.plan)
      setWords(data.words || {})
      setCorrections(data.corrections || [])
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: vp } = await supabase.from('user_voice_pref')
          .select('voice_name').eq('user_id', user.id).eq('lang_code', 'en-GB').maybeSingle()
        await waitForVoices(2000)
        if (vp?.voice_name) setVoiceName(vp.voice_name)
        else {
          const best = getBestVoice('en')
          if (best?.name) setVoiceName(best.name)
        }
      }
    })()
  }, [])

  // v3.21 — Sauve l'état session à chaque update pour reprise
  useEffect(() => {
    if (!sessionId || done || plan.length === 0) return
    try {
      const search = new URLSearchParams(window.location.search)
      const isReview = search.get('mode') === 'revision'
      const typeFilter = search.get('type') || undefined
      const courseId = search.get('course') || undefined
      const storageKey = `dodolingua-session-${isReview ? 'rev' : courseId ? `course-${courseId}` : 'learn'}-${typeFilter || 'def'}`
      localStorage.setItem(storageKey, JSON.stringify({
        sessionId, plan, words, corrections, idx, results,
        remediationActive, remediationCount, savedAt: Date.now(),
      }))
    } catch (e) { /* silent */ }
  }, [sessionId, idx, results, remediationActive, remediationCount, plan.length, done])

  // v3.21 — À la fin, on supprime le stockage
  useEffect(() => {
    if (!done) return
    try {
      const search = new URLSearchParams(window.location.search)
      const isReview = search.get('mode') === 'revision'
      const typeFilter = search.get('type') || undefined
      const courseId = search.get('course') || undefined
      const storageKey = `dodolingua-session-${isReview ? 'rev' : courseId ? `course-${courseId}` : 'learn'}-${typeFilter || 'def'}`
      localStorage.removeItem(storageKey)
    } catch (e) {}
  }, [done])

  function next() {
    if (idx + 1 >= plan.length) {
      // v3.7.4 — Avant de finir, regarde si on doit lancer un tour de remédiation
      if (!remediationActive) {
        const failedItems = computeFailedItems(results)
        if (failedItems.length > 0 && remediationCount < 1) {
          // Lance UN tour de remédiation (max 1 itération pour éviter les boucles infinies)
          setPlan(failedItems)
          setIdx(0)
          setRemediationActive(true)
          setRemediationCount(remediationCount + 1)
          setResults([])  // reset pour ce tour (on ne reboucle pas dessus)
          return
        }
      }
      finish()
    } else {
      setIdx(idx + 1)
    }
  }

  // v3.7.4 — Détermine les items à refaire après un tour standard.
  // Critères "fail" :
  //  - pronunciation_score < 90
  //  - flashcard grade='pas_su' (hésité = pass, savais = pass)
  //  - qcm_correct === false
  //  - cloze_correct === false
  function computeFailedItems(rs: any[]): PlanItem[] {
    const failed: PlanItem[] = []
    for (const r of rs) {
      let isFail = false
      if (r.phase === 'pronunciation' && typeof r.pronunciation_score === 'number' && r.pronunciation_score < 90) isFail = true
      if (r.phase === 'flashcard' && r.grade === 'pas_su') isFail = true
      if (r.phase === 'qcm' && r.qcm_correct === false) isFail = true
      if (r.phase === 'cloze' && r.cloze_correct === false) isFail = true
      if (isFail) {
        failed.push({ phase: r.phase, word_id: r.word_id, est_seconds: 30 })
      }
    }
    return failed
  }

  async function recordPhase(payload: any) {
    if (!sessionId || !current) return
    setBusy(true)
    setResults(prev => [...prev, { word_id: current.word_id, phase: current.phase, ...payload }])
    try {
      // v3.11 — pass mode=revision dans l'URL pour mettre à jour la bonne quête
      const submitUrl = `/api/sessions/${sessionId}/submit${isReviewRef.current ? '?mode=revision' : ''}`
      await fetch(submitUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word_id: current.word_id, phase: current.phase, ...payload }),
      })
    } catch {}
    setBusy(false)
    next()
  }

  // v3.8.1 — Grade une correction et avance (utilise /api/corrections/grade)
  async function gradeCorrection(id: string, button: 'savais' | 'hesite' | 'pas_su') {
    setBusy(true)
    try {
      await fetch('/api/corrections/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, button }),
      })
    } catch {}
    setBusy(false)
    next()
  }

  async function finish() {
    if (!sessionId) return
    const search = new URLSearchParams(window.location.search)
    const isReview = search.get('mode') === 'revision'
    const url = `/api/sessions/${sessionId}/submit?finalize=1${isReview ? '&mode=revision' : ''}`
    const res = await fetch(url, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}',
    })
    const data = await res.json()
    setPoints(data.points)
    setDone(true)
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md text-center space-y-4">
          <div className="text-3xl">⚠️</div>
          <p className="text-sm text-warn">{error}</p>
          <Button block onClick={() => router.push('/dashboard')}>Retour au dashboard</Button>
        </Card>
      </main>
    )
  }

  if (done) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md text-center space-y-5 overflow-visible">
          <div className="flex justify-center -mt-12">
            <Mascot pose="champion" size={260} animation="slideUp" />
          </div>
          <div className="-mt-2">
            <h1 className="text-3xl font-extrabold text-primary-900 animate-pop-in">🎉 Session terminée !</h1>
            <div className="text-5xl font-extrabold text-emerald-600 mt-3 animate-pop-in">+{points?.total ?? 10} pts</div>
          </div>
          <p className="text-sm text-gray-600">À demain pour la suite !</p>
          <Button block onClick={() => router.push('/dashboard')}>Retour au dashboard</Button>
        </Card>
      </main>
    )
  }

  // v3.8.1 — correction_review n'a pas de 'word' attaché (c'est un corr-${id})
  const isCorrectionReview = current?.phase === ('correction_review' as any)
  if (!current || (!word && !isCorrectionReview)) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md"><p className="text-center text-gray-500">Préparation de la session…</p></Card>
      </main>
    )
  }

  // v3.7.1 — Plan groupé par phase : on compte la position dans le groupe courant
  const groupIndices: number[] = []
  for (let i = 0; i < plan.length; i++) if (plan[i].phase === current.phase) groupIndices.push(i)
  const positionInGroup = groupIndices.indexOf(idx) + 1
  const groupSize = groupIndices.length

  return (
    <main className="min-h-screen flex items-start justify-center p-4 pb-20">
      <Container className="max-w-md space-y-3">
        {remediationActive && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-2">
              <Mascot pose="study" size={40} animation="breathe" />
              <div>
                <div className="text-xs font-extrabold text-amber-700">🔁 Tour de révision</div>
                <div className="text-[11px] text-amber-700">On revoit les mots qui ont besoin de plus.</div>
              </div>
            </div>
          </div>
        )}

        {/* Header progress — v3.21 : étoile au lieu du compteur, plus encourageant */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span className="font-bold text-primary-700">{phaseEmoji(current.phase)} {phaseLabel(current.phase)}</span>
            <button
              onClick={() => router.push('/dashboard')}
              className="text-[11px] text-gray-500 hover:text-primary-700 underline"
              title="Tu peux quitter, ta progression est sauvée"
            >
              💾 Reprendre plus tard
            </button>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden relative">
            <div className="h-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all" style={{ width: `${((idx + 1) / plan.length) * 100}%` }} />
            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow">
              ⭐ {Math.round(((idx + 1) / plan.length) * 100)}%
            </div>
          </div>
        </div>

        {/* Phase content */}
        <Card className="!p-5 space-y-4">
          {current.phase === 'discovery' && word && (
            <DiscoveryPhase key={`d-${idx}`} word={word} voiceName={voiceName} onNext={() => recordPhase({ completed: true })} busy={busy} />
          )}
          {current.phase === 'pronunciation' && word && (
            <PronunciationPhase key={`p-${idx}`} word={word} voiceName={voiceName} onNext={(score) => recordPhase({ pronunciation_score: score })} busy={busy} />
          )}
          {current.phase === 'flashcard' && word && (
            <FlashcardPhase key={`f-${idx}`} word={word} voiceName={voiceName} onGrade={(g) => recordPhase({ grade: g })} busy={busy} />
          )}
          {current.phase === 'qcm' && word && (
            <QcmPhase key={`q-${idx}`} word={word} onAnswer={(correct) => recordPhase({ qcm_correct: correct })} busy={busy} />
          )}
          {current.phase === 'cloze' && word && (
            <ClozePhase key={`c-${idx}`} word={word} onAnswer={(correct) => recordPhase({ cloze_correct: correct })} busy={busy} />
          )}
          {(current.phase as any) === 'correction_review' && (() => {
            const corrId = current.word_id.replace(/^corr-/, '')
            const corr = corrections.find((c: any) => c.id === corrId)
            return corr ? (
              <CorrectionReviewPhase key={`cr-${idx}`} corr={corr} onGrade={(g) => gradeCorrection(corr.id, g)} busy={busy} />
            ) : (
              <div className="text-center text-sm text-gray-500 italic py-8">Correction introuvable, on passe.</div>
            )
          })()}
        </Card>
      </Container>
    </main>
  )
}

// ============================
// PHASE COMPONENTS
// ============================

function DiscoveryPhase({ word, voiceName, onNext, busy }: { word: WordData; voiceName: string | null; onNext: () => void; busy: boolean }) {
  function speakWord(rate = 1) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    speak(word.lemma, voiceName, rate)
  }
  function speakExample() {
    if (!word.example) return
    speak(word.example, voiceName, 0.85)
  }
  return (
    <div className="space-y-4 text-center">
      <div className="text-[10px] uppercase font-bold text-gray-500">Voici ton nouveau mot</div>
      {word.image_url && (
        <div className="flex justify-center">
          <ConceptImage url={word.image_url} alt={word.image_alt} variant="lesson" />
        </div>
      )}
      <div>
        <div className="text-4xl font-extrabold text-primary-900">{word.lemma}</div>
        {word.ipa && <div className="font-mono text-primary-500 mt-1">{word.ipa}</div>}
      </div>
      <div className="flex gap-2 justify-center">
        <button onClick={() => speakWord(1)} className="bg-primary-50 text-primary-700 font-semibold px-4 py-2 rounded-full text-sm">🔊 Écouter</button>
        <button onClick={() => speakWord(0.6)} className="bg-primary-50 text-primary-700 font-semibold px-4 py-2 rounded-full text-sm">🐢 Lentement</button>
      </div>
      {word.gloss_fr && (
        <div className="bg-primary-50 rounded-xl p-3">
          <div className="text-[10px] uppercase font-bold text-primary-700 mb-1">🇫🇷 Traduction</div>
          <div className="text-base font-bold text-primary-900">{word.gloss_fr}</div>
        </div>
      )}
      {word.example && (
        <div className="bg-amber-50 rounded-xl p-3">
          <div className="text-[10px] uppercase font-bold text-amber-700 mb-1">Exemple</div>
          <div className="text-sm italic text-gray-800">{word.example}</div>
          <button onClick={speakExample} className="mt-2 text-xs text-amber-700 font-semibold">🔊 Écouter la phrase</button>
        </div>
      )}
      <Button block onClick={onNext} disabled={busy}>J&apos;ai compris →</Button>
    </div>
  )
}

function PronunciationPhase({ word, voiceName, onNext, busy }: { word: WordData; voiceName: string | null; onNext: (score: number | null) => void; busy: boolean }) {
  // v3.11 — Afficher traduction FR + bouton Voir/Cacher pour rappel pendant pratique
  const [showFr, setShowFr] = useState(false)
  const [recording, setRecording] = useState(false)
  const [scores, setScores] = useState<WordScore[] | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const recRef = useRef<any>(null)
  const mrRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  function speakWord() { speak(word.lemma, voiceName, 0.85) }

  async function startAudio() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      const mr = new MediaRecorder(stream)
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })
        setAudioUrl(URL.createObjectURL(blob))
        try { streamRef.current?.getTracks().forEach(t => t.stop()) } catch {}
      }
      mr.start()
      mrRef.current = mr
    } catch {}
  }
  function stopAudio() {
    try { mrRef.current?.stop() } catch {}
    mrRef.current = null
  }

  async function startRec() {
    if (recording) return
    const SR = (window.SpeechRecognition || window.webkitSpeechRecognition)
    if (!SR) { alert('Reconnaissance vocale non disponible (utilise Chrome).'); return }
    await startAudio()
    const rec = new SR()
    rec.lang = 'en-GB'
    rec.continuous = false
    rec.interimResults = false
    let confidence = 0
    rec.onstart = () => setRecording(true)
    rec.onerror = () => { setRecording(false); stopAudio() }
    rec.onend = () => setRecording(false)
    rec.onresult = (e: any) => {
      const t = e.results[0][0].transcript
      confidence = e.results[0][0].confidence || 0
      const s = scoreAgainstTarget(t, word.lemma, confidence)
      setScores(s)
      stopAudio()
    }
    try { rec.start(); recRef.current = rec } catch {}
  }
  function stopRec() { try { recRef.current?.stop() } catch {}; setRecording(false); stopAudio() }

  const matchedCount = scores?.filter(w => w.matchesTarget).length || 0
  const totalCount = scores?.length || 0
  const pct = totalCount > 0 ? Math.round(100 * matchedCount / totalCount) : null

  function playMyVoice() { if (audioUrl) { try { new Audio(audioUrl).play() } catch {} } }

  return (
    <div className="space-y-4 text-center">
      <div className="text-[10px] uppercase font-bold text-gray-500">Apprends à le prononcer</div>
      <div className="text-3xl font-extrabold text-primary-900">{word.lemma}</div>
      {word.ipa && <div className="font-mono text-primary-500">{word.ipa}</div>}
      <button onClick={speakWord} className="bg-primary-50 text-primary-700 font-semibold px-4 py-2 rounded-full text-sm">🔊 Écouter le modèle</button>
      {/* v3.11 — Traduction FR (cachée par défaut, dévoilable si besoin) */}
      {word.gloss_fr && (
        <div>
          {showFr ? (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-2 inline-block">
              <span className="text-[10px] uppercase font-bold text-purple-700 mr-2">🇫🇷</span>
              <span className="text-sm font-bold text-purple-900">{word.gloss_fr}</span>
            </div>
          ) : (
            <button onClick={() => setShowFr(true)} className="text-xs text-purple-600 underline">
              Voir la traduction française
            </button>
          )}
        </div>
      )}

      {!scores && (
        <>
          <div className="text-sm text-gray-600 italic">Clique sur 🎤 et dis le mot à voix haute</div>
          {!recording ? (
            <button onClick={startRec} className="w-20 h-20 rounded-full bg-primary-700 text-white text-3xl mx-auto flex items-center justify-center animate-breath">🎤</button>
          ) : (
            <button onClick={stopRec} className="w-20 h-20 rounded-full bg-warn text-white text-3xl mx-auto flex items-center justify-center animate-pulse">■</button>
          )}
        </>
      )}

      {scores && (
        <div className="space-y-3">
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="text-[10px] uppercase font-bold text-gray-500 mb-1">Ce que tu as dit</div>
            <div className="text-base">
              {scores.map((w, i) => (
                <span key={i}>
                  <span className={w.matchesTarget ? 'pron-good' : 'pron-bad'}>{w.word}</span>
                  {i < scores.length - 1 ? ' ' : ''}
                </span>
              ))}
            </div>
            {pct !== null && (
              <div className="text-xs text-gray-700 mt-2">
                Score : <b>{pct}%</b> {pct >= 80 ? '— excellent 🎯' : pct >= 50 ? '— à affiner 👍' : '— refais lentement 🔁'}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {audioUrl && (
              <button onClick={playMyVoice} className="flex-1 px-3 py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-semibold">▶️ Réécouter ma voix</button>
            )}
            <button onClick={() => { setScores(null); setAudioUrl(null) }} className="flex-1 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-semibold">🔁 Refaire</button>
          </div>
          <Button block onClick={() => onNext(pct)} disabled={busy}>Suivant →</Button>
        </div>
      )}
    </div>
  )
}

function FlashcardPhase({ word, voiceName, onGrade, busy }: { word: WordData; voiceName: string | null; onGrade: (g: 'savais' | 'hesite' | 'pas_su') => void; busy: boolean }) {
  // v3.7.3 — Vraie flashcard 3D : tu cliques sur la carte, elle se retourne (rotateY).
  const [revealed, setRevealed] = useState(false)
  const [fsrsPicked, setFsrsPicked] = useState<'savais' | 'hesite' | 'pas_su' | null>(null)
  function pickGrade(g: 'savais' | 'hesite' | 'pas_su') {
    if (fsrsPicked !== null) return
    setFsrsPicked(g)
    setTimeout(() => onGrade(g), 600)
  }
  function speakWord(e: any) {
    e.stopPropagation()  // évite de flipper la carte en cliquant sur le bouton 🔊
    speak(word.lemma, voiceName, 0.9)
  }
  return (
    <div className="space-y-4 text-center">
      <div className="text-[10px] uppercase font-bold text-gray-500">Tu te souviens du sens ? Clique la carte pour la retourner.</div>

      <div className="flip-perspective" style={{ minHeight: 220 }}>
        <div
          className={`flip-3d cursor-pointer ${revealed ? 'flipped' : ''}`}
          style={{ minHeight: 220 }}
          onClick={() => !revealed && setRevealed(true)}>
          {/* FRONT : mot anglais */}
          <div className="flip-face bg-emerald-50 rounded-xl p-5 border-2 border-emerald-200">
            <div className="w-full">
              <div className="text-[10px] uppercase font-bold text-emerald-700 mb-2">🇬🇧 Mot anglais</div>
              <div className="text-3xl font-extrabold text-emerald-900">{word.lemma}</div>
              {word.ipa && <div className="font-mono text-emerald-700 text-sm mt-1">{word.ipa}</div>}
              <button onClick={speakWord} className="mt-3 text-xs bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full font-semibold hover:bg-emerald-200">🔊 Écouter</button>
              <div className="text-[11px] text-gray-500 italic mt-3">↻ Touche la carte pour voir la traduction</div>
            </div>
          </div>
          {/* BACK : traduction française */}
          <div className="flip-face flip-back bg-purple-50 rounded-xl p-5 border-2 border-purple-200">
            <div className="w-full">
              <div className="text-[10px] uppercase font-bold text-purple-700 mb-2">🇫🇷 Traduction</div>
              <div className="text-3xl font-extrabold text-purple-900">{word.gloss_fr || '(traduction manquante)'}</div>
              <div className="text-[11px] text-purple-600 italic mt-3">en anglais : <b>{word.lemma}</b></div>
            </div>
          </div>
        </div>
      </div>

      {revealed && (
        <>
          <div className="text-[10px] uppercase font-bold text-gray-500 mt-2">Comment tu te débrouilles ?</div>
          <div className="grid grid-cols-3 gap-2">
            <FsrsButton color="red"     emoji="😖" label="Je ne savais pas" picked={fsrsPicked === 'pas_su'} disabled={busy || fsrsPicked !== null} onClick={() => pickGrade('pas_su')} />
            <FsrsButton color="amber"   emoji="🤔" label="J&apos;ai hésité"   picked={fsrsPicked === 'hesite'} disabled={busy || fsrsPicked !== null} onClick={() => pickGrade('hesite')} />
            <FsrsButton color="emerald" emoji="✅" label="Je savais"         picked={fsrsPicked === 'savais'} disabled={busy || fsrsPicked !== null} onClick={() => pickGrade('savais')} />
          </div>
        </>
      )}
    </div>
  )
}

// v3.7.2 — Bouton FSRS générique : blanc/neutre par défaut, plein de couleur au clic
function FsrsButton({ color, emoji, label, picked, disabled, onClick }: {
  color: 'red' | 'amber' | 'emerald'
  emoji: string
  label: string
  picked: boolean
  disabled: boolean
  onClick: () => void
}) {
  // v3.7.4 — Couleurs PLUS PROFONDES (600/700) + disabled:text-white !important pour bypass
  // le style natif du navigateur qui grise le texte des boutons disabled.
  const colorMap = {
    red:     { picked: 'bg-red-600 border-red-700 text-white scale-[1.05] shadow-lg',         hover: 'hover:bg-red-50 hover:border-red-300' },
    amber:   { picked: 'bg-amber-600 border-amber-700 text-white scale-[1.05] shadow-lg',     hover: 'hover:bg-amber-50 hover:border-amber-300' },
    emerald: { picked: 'bg-emerald-600 border-emerald-700 text-white scale-[1.05] shadow-lg', hover: 'hover:bg-emerald-50 hover:border-emerald-300' },
  } as const
  const cls = picked
    ? colorMap[color].picked
    : `bg-white border-rule text-gray-700 ${colorMap[color].hover}`
  return (
    <button onClick={onClick} disabled={disabled}
      style={picked ? { color: 'white' } : undefined}
      className={`p-3 rounded-xl border-2 text-xs font-extrabold transition flex flex-col items-center gap-1 disabled:cursor-not-allowed ${cls}`}>
      <span className="text-base leading-none">{emoji}</span>
      <span style={picked ? { color: 'white' } : undefined} dangerouslySetInnerHTML={{ __html: label }} />
    </button>
  )
}

function QcmPhase({ word, onAnswer, busy }: { word: WordData; onAnswer: (correct: boolean) => void; busy: boolean }) {
  const [picked, setPicked] = useState<string | null>(null)
  const correctOpt = word.qcm.correct
  function pick(opt: string) {
    if (picked !== null) return
    setPicked(opt)
    setTimeout(() => onAnswer(opt === correctOpt), 1200)
  }
  return (
    <div className="space-y-4 text-center">
      <div className="text-[10px] uppercase font-bold text-gray-500">Que veut dire ce mot ?</div>
      <div className="bg-emerald-50 rounded-xl p-5">
        <div className="text-3xl font-extrabold text-emerald-900">{word.lemma}</div>
        {word.ipa && <div className="font-mono text-emerald-700 text-sm mt-1">{word.ipa}</div>}
      </div>
      <div className="grid grid-cols-1 gap-2">
        {word.qcm.options.map(opt => {
          const isCorrect = opt === correctOpt
          const isPicked = picked === opt
          let cls = 'bg-white border-rule text-gray-800 hover:border-primary-300'
          if (picked !== null) {
            if (isCorrect) cls = 'bg-emerald-500 border-emerald-600 text-white scale-[1.02] shadow-md'
            else if (isPicked) cls = 'bg-red-500 border-red-600 text-white'
            else cls = 'bg-white border-rule text-gray-400 opacity-50'
          }
          return (
            <button key={opt} disabled={picked !== null || busy} onClick={() => pick(opt)}
              className={`w-full p-3 rounded-xl border-2 text-sm font-semibold transition flex items-center justify-between ${cls}`}>
              <span className="flex-1 text-left">{opt}</span>
              {picked !== null && isCorrect && <span className="text-xl ml-2">✓</span>}
              {picked === opt && !isCorrect && <span className="text-xl ml-2">✗</span>}
            </button>
          )
        })}
      </div>
      {picked !== null && (
        <div className={`flex flex-col items-center justify-center gap-2 mt-2 p-3 rounded-xl ${picked === correctOpt ? 'bg-emerald-50' : 'bg-red-50'} animate-pop-in`}>
          <Mascot pose={picked === correctOpt ? 'champion' : 'sad'} size={180} animation={picked === correctOpt ? 'slideUp' : 'wobble'} />
          <div className={`text-xl font-extrabold ${picked === correctOpt ? 'text-emerald-700' : 'text-red-700'} animate-pop-in`}>
            {picked === correctOpt ? '🎯 Bonne réponse !' : `❌ La bonne réponse était : ${correctOpt}`}
          </div>
        </div>
      )}
    </div>
  )
}

function ClozePhase({ word, onAnswer, busy }: { word: WordData; onAnswer: (correct: boolean) => void; busy: boolean }) {
  const [picked, setPicked] = useState<string | null>(null)
  const [showFr, setShowFr] = useState(false)
  const [sentenceFr, setSentenceFr] = useState<string | null>(null)
  const [loadingFr, setLoadingFr] = useState(false)

  async function loadFr(textEn: string) {
    if (sentenceFr) return  // déjà chargé
    setLoadingFr(true)
    try {
      // Cache localStorage pour éviter re-appels
      const key = `dodo-tr-${textEn.toLowerCase().slice(0, 100)}`
      const cached = localStorage.getItem(key)
      if (cached) { setSentenceFr(cached); setLoadingFr(false); return }
      const res = await fetch('/api/translate-sentence', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentence: textEn }),
      })
      const data = await res.json()
      if (data.fr) {
        setSentenceFr(data.fr)
        try { localStorage.setItem(key, data.fr) } catch {}
      } else {
        setSentenceFr('Traduction indisponible')
      }
    } catch {
      setSentenceFr('Erreur traduction')
    } finally {
      setLoadingFr(false)
    }
  }

  if (!word.cloze) {
    // Pas de phrase d'exemple → skip auto
    return (
      <div className="space-y-4 text-center">
        <div className="text-sm text-gray-500 italic">Pas d&apos;exemple disponible pour ce mot — on passe.</div>
        <Button block onClick={() => onAnswer(true)} disabled={busy}>Suivant →</Button>
      </div>
    )
  }
  const cloze = word.cloze
  function pick(opt: string) {
    if (picked !== null) return
    setPicked(opt)
    setTimeout(() => onAnswer(opt === cloze.correct), 1200)
  }
  // Affiche la phrase avec le ___ remplacé visuellement par soit le pick, soit ___
  const display = picked
    ? cloze.sentence.replace('___', `[${picked}]`)
    : cloze.sentence
  return (
    <div className="space-y-4 text-center">
      <div className="text-[10px] uppercase font-bold text-gray-500">Complète la phrase</div>
      <div className="bg-amber-50 rounded-xl p-5 text-base text-gray-800 italic min-h-[4rem]">
        {display}
      </div>
      {/* v3.21.2 — Aide traduction FR de la PHRASE (Groq à la volée + cache) */}
      <div>
        <button
          type="button"
          onClick={() => {
            const newShow = !showFr
            setShowFr(newShow)
            if (newShow && !sentenceFr) {
              // Si on a déjà la réponse choisie, traduire la phrase complète. Sinon traduire avec ___
              const textEn = picked
                ? cloze!.sentence.replace('___', picked)
                : cloze!.sentence.replace('___', word.gloss_fr ? `[${word.lemma}]` : '___')
              loadFr(textEn)
            }
          }}
          className="text-[11px] text-primary-700 hover:underline font-semibold"
        >
          {showFr ? '🇫🇷 Masquer la traduction' : '🇫🇷 Voir la traduction française'}
        </button>
        {showFr && (
          <div className="mt-2 text-sm bg-blue-50 border border-blue-200 rounded-lg p-3 text-blue-900 space-y-1">
            {loadingFr ? (
              <div className="italic text-blue-700">⏳ Traduction en cours…</div>
            ) : sentenceFr ? (
              <>
                <div className="font-semibold">{sentenceFr}</div>
                {word.gloss_fr && (
                  <div className="text-xs opacity-80 mt-1 pt-1 border-t border-blue-200">
                    Mot à deviner : <b>{word.lemma}</b> = <b>{word.gloss_fr}</b>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2">
        {cloze.options.map(opt => {
          const isCorrect = opt === cloze.correct
          const isPicked = picked === opt
          let cls = 'bg-white border-rule text-gray-800 hover:border-primary-300'
          if (picked !== null) {
            if (isCorrect) cls = 'bg-emerald-500 border-emerald-600 text-white scale-[1.02] shadow-md'
            else if (isPicked) cls = 'bg-red-500 border-red-600 text-white'
            else cls = 'bg-white border-rule text-gray-400 opacity-50'
          }
          return (
            <button key={opt} disabled={picked !== null || busy} onClick={() => pick(opt)}
              className={`w-full p-3 rounded-xl border-2 text-sm font-semibold transition flex items-center justify-between ${cls}`}>
              <span className="flex-1 text-left">{opt}</span>
              {picked !== null && isCorrect && <span className="text-xl ml-2">✓</span>}
              {picked === opt && !isCorrect && <span className="text-xl ml-2">✗</span>}
            </button>
          )
        })}
      </div>
      {picked !== null && (
        <div className={`flex flex-col items-center justify-center gap-2 mt-2 p-3 rounded-xl ${picked === cloze.correct ? 'bg-emerald-50' : 'bg-red-50'} animate-pop-in`}>
          <Mascot pose={picked === cloze.correct ? 'champion' : 'sad'} size={180} animation={picked === cloze.correct ? 'slideUp' : 'wobble'} />
          <div className={`text-xl font-extrabold animate-pop-in ${picked === cloze.correct ? 'text-emerald-700' : 'text-red-700'}`}>
            {picked === cloze.correct ? '🎯 Parfait !' : `❌ La bonne réponse était : ${cloze.correct}`}
          </div>
        </div>
      )}
    </div>
  )
}

// v3.8.1 — Phase de révision d'une correction coach (flip card style)
function CorrectionReviewPhase({ corr, onGrade, busy }: {
  corr: { id: string; original_text: string; corrected_text: string; corrected_fr: string | null; reason: string | null; grammar_rule?: string | null }
  onGrade: (g: 'savais' | 'hesite' | 'pas_su') => void
  busy: boolean
}) {
  const [revealed, setRevealed] = useState(false)
  const [picked, setPicked] = useState<'savais' | 'hesite' | 'pas_su' | null>(null)
  function pickGrade(g: 'savais' | 'hesite' | 'pas_su') {
    if (picked !== null) return
    setPicked(g)
    setTimeout(() => onGrade(g), 600)
  }
  return (
    <div className="space-y-4 text-center">
      <div className="text-[10px] uppercase font-bold text-gray-500">Tu te souviens de la règle ?</div>
      {corr.grammar_rule && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
          <div className="text-[10px] uppercase font-bold text-blue-700">📚 Règle de grammaire</div>
          <div className="text-base font-extrabold text-blue-900">{corr.grammar_rule}</div>
        </div>
      )}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <div className="text-[10px] uppercase font-bold text-gray-500 mb-1">Exemple : ta phrase initiale</div>
        <div className="text-sm">{corr.original_text}</div>
      </div>
      {!revealed ? (
        <Button block onClick={() => setRevealed(true)}>Voir la correction</Button>
      ) : (
        <>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="text-[10px] uppercase font-bold text-emerald-700 mb-1">Correction</div>
            <div className="text-base font-bold text-emerald-900">{corr.corrected_text}</div>
            {corr.corrected_fr && (
              <div className="mt-2 bg-purple-50 border border-purple-200 rounded p-2 text-sm text-purple-900 italic">
                🇫🇷 {corr.corrected_fr}
              </div>
            )}
            {corr.reason && (
              <div className="mt-2 text-xs italic text-gray-600">📖 {corr.reason}</div>
            )}
          </div>
          <div className="text-[10px] uppercase font-bold text-gray-500 mt-2">Comment tu te débrouilles ?</div>
          <div className="grid grid-cols-3 gap-2">
            <FsrsButton color="red"     emoji="😖" label="Je ne savais pas" picked={picked === 'pas_su'} disabled={busy || picked !== null} onClick={() => pickGrade('pas_su')} />
            <FsrsButton color="amber"   emoji="🤔" label="J&apos;ai hésité"   picked={picked === 'hesite'} disabled={busy || picked !== null} onClick={() => pickGrade('hesite')} />
            <FsrsButton color="emerald" emoji="✅" label="Je savais"         picked={picked === 'savais'} disabled={busy || picked !== null} onClick={() => pickGrade('savais')} />
          </div>
        </>
      )}
    </div>
  )
}
