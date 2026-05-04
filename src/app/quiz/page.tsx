/**
 * v3.16 — Page quiz CEFR multi-sections.
 * - Affiche la section courante en header
 * - Différents types de questions :
 *   - listening : bouton 🔊 Écouter, puis 4 choix FR
 *   - speaking : afficher la cible, micro pour enregistrer, score auto
 *   - word_to_fr / fr_to_word : QCM classique
 * - Score per section + global
 * - >= 70% global = passe au level suivant + certificat
 */
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Mascot } from '@/components/Mascot'
import { speak, getBestVoice, waitForVoices } from '@/components/games/utils'
import { scoreAgainstTarget, type WordScore } from '@/components/coach/PronunciationBadge'

declare global {
  interface Window {
    webkitSpeechRecognition?: any
    SpeechRecognition?: any
  }
}

interface Section {
  key: string
  label: string
  description: string
  questions: any[]
}

export default function QuizPage() {
  const router = useRouter()
  const search = useSearchParams()
  const level = (search.get('level') || 'A1').toUpperCase()
  const [sections, setSections] = useState<Section[]>([])
  const [userMode, setUserMode] = useState<'oral' | 'complet'>('complet')
  const [voiceName, setVoiceName] = useState<string | null>(null)
  const [secIdx, setSecIdx] = useState(0)  // index de la section courante
  const [qIdx, setQIdx] = useState(0)      // index de la question dans la section
  const [picked, setPicked] = useState<any>(null)  // dernière réponse (pour visu)
  const [answers, setAnswers] = useState<{ section: string; correct: boolean }[]>([])
  const [done, setDone] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Pour speaking phase
  const [speakingScore, setSpeakingScore] = useState<number | null>(null)
  const [recording, setRecording] = useState(false)
  const recRef = useRef<any>(null)

  useEffect(() => {
    (async () => {
      try {
        await waitForVoices(2000)
        const best = getBestVoice('en')
        if (best?.name) setVoiceName(best.name)
        const res = await fetch(`/api/quiz?level=${encodeURIComponent(level)}`)
        const txt = await res.text()
        let data: any = {}
        if (txt) { try { data = JSON.parse(txt) } catch {} }
        if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`)
        setSections(data.sections || [])
        setUserMode(data.user_mode || 'complet')
      } catch (e: any) {
        setError(e.message || 'Erreur réseau')
      } finally {
        setLoading(false)
      }
    })()
  }, [level])

  const currentSection = sections[secIdx]
  const currentQ = currentSection?.questions[qIdx]
  const totalQuestions = sections.reduce((s, sec) => s + sec.questions.length, 0)
  const questionsAnswered = answers.length

  function recordAnswer(correct: boolean, sectionKey: string) {
    const newAnswers = [...answers, { section: sectionKey, correct }]
    setAnswers(newAnswers)
    setPicked(null)
    setSpeakingScore(null)
    // Avance : prochaine question OU prochaine section OU fin
    if (currentSection && qIdx + 1 < currentSection.questions.length) {
      setQIdx(qIdx + 1)
    } else if (secIdx + 1 < sections.length) {
      setSecIdx(secIdx + 1)
      setQIdx(0)
    } else {
      finish(newAnswers)
    }
  }

  function pickQcm(opt: any) {
    if (picked !== null) return
    setPicked(opt)
    const isCorrect = opt === currentQ.correct
    setTimeout(() => recordAnswer(isCorrect, currentSection.key), 1200)
  }

  // Listening : TTS automatique au montage de la question
  useEffect(() => {
    if (currentQ?.type === 'listening' && currentQ.tts_text) {
      const t = setTimeout(() => speak(currentQ.tts_text, voiceName, 0.9), 300)
      return () => clearTimeout(t)
    }
  }, [secIdx, qIdx, voiceName])

  function replayListen() {
    if (currentQ?.tts_text) speak(currentQ.tts_text, voiceName, 0.85)
  }

  // Speaking : enregistrer + scorer
  function startSpeak() {
    const SR = (window.SpeechRecognition || window.webkitSpeechRecognition)
    if (!SR) { alert('Reconnaissance vocale non disponible (utilise Chrome).'); return }
    const rec = new SR()
    rec.lang = 'en-GB'
    rec.continuous = false
    rec.interimResults = false
    rec.onstart = () => setRecording(true)
    rec.onerror = () => setRecording(false)
    rec.onend = () => setRecording(false)
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript
      const conf = e.results[0][0].confidence || 0
      const scores = scoreAgainstTarget(transcript, currentQ.target_lemma, conf)
      const matched = scores.filter(s => s.matchesTarget).length
      const pct = scores.length > 0 ? (matched / scores.length) * 100 : 0
      setSpeakingScore(Math.round(pct))
      // >= 60% match = correct (plus permissif que QCM strict)
      setTimeout(() => recordAnswer(pct >= 60, currentSection.key), 1500)
    }
    try { rec.start(); recRef.current = rec } catch {}
  }
  function stopSpeak() { try { recRef.current?.stop() } catch {} }

  async function finish(finalAnswers: { section: string; correct: boolean }[]) {
    const score = finalAnswers.filter(a => a.correct).length
    const total = finalAnswers.length
    const pct = total > 0 ? Math.round(100 * score / total) : 0
    // Score par section
    const breakdown: Record<string, { score: number; total: number; pct: number }> = {}
    for (const sec of sections) {
      const secAnswers = finalAnswers.filter(a => a.section === sec.key)
      const sScore = secAnswers.filter(a => a.correct).length
      const sTotal = secAnswers.length
      breakdown[sec.key] = {
        score: sScore,
        total: sTotal,
        pct: sTotal > 0 ? Math.round(100 * sScore / sTotal) : 0,
      }
    }
    setDone(true)
    try {
      const res = await fetch('/api/quiz/finish', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, score, total, pct, breakdown, mode: userMode }),
      })
      const txt = await res.text()
      let data: any = {}
      if (txt) { try { data = JSON.parse(txt) } catch {} }
      setResult({ score, total, pct, breakdown, ...data })
    } catch {
      setResult({ score, total, pct, breakdown })
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md text-center"><p className="text-sm text-gray-500 italic">Préparation du quiz {level}…</p></Card>
      </main>
    )
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
    const passed = (result?.pct || 0) >= 70
    const promoted = result?.promoted
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md text-center space-y-4">
          <Mascot pose={passed ? 'champion' : 'study'} size={120} animation={passed ? 'celebrate' : 'breathe'} />
          <h1 className="text-2xl font-bold text-primary-900">
            {passed ? `🎉 Quiz ${level} réussi !` : `Quiz ${level} pas tout à fait`}
          </h1>
          <div className="text-3xl font-extrabold text-primary-700">
            {result?.score || 0} / {result?.total || 0} ({result?.pct || 0}%)
          </div>
          {/* Breakdown par section */}
          {result?.breakdown && (
            <div className="text-left space-y-1.5 text-xs bg-gray-50 rounded-lg p-3">
              <div className="font-bold text-gray-700 text-center mb-1">Détail par section</div>
              {sections.map(sec => {
                const b = result.breakdown[sec.key]
                if (!b) return null
                return (
                  <div key={sec.key} className="flex items-center justify-between">
                    <span>{sec.label}</span>
                    <span className={`font-bold ${b.pct >= 70 ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {b.score}/{b.total} ({b.pct}%)
                    </span>
                  </div>
                )
              })}
            </div>
          )}
          {passed && promoted ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <div className="text-sm font-bold text-emerald-700">🎓 Tu passes en {result?.newLevel}</div>
              {result?.certificateUrl && (
                <Link href={result.certificateUrl}>
                  <span className="mt-3 inline-block px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold cursor-pointer">
                    📜 Voir mon certificat {level}
                  </span>
                </Link>
              )}
            </div>
          ) : passed ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs">
              Quiz réussi mais ton niveau actuel reste {level}.
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs">
              Il faut au moins 70% global pour passer. Continue à pratiquer et réessaie !
            </div>
          )}
          <Button block onClick={() => router.push('/dashboard')}>Retour au dashboard</Button>
        </Card>
      </main>
    )
  }

  if (!currentSection || !currentQ) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md text-center"><p className="text-sm text-gray-500">Aucune question disponible.</p></Card>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-start justify-center p-4">
      <Container className="max-w-md space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-primary-700">🎓 Test {level} {userMode === 'oral' && '(oral seul)'}</span>
          <span className="text-gray-500">{questionsAnswered + 1} / {totalQuestions}</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-primary-500 transition-all" style={{ width: `${((questionsAnswered + 1) / totalQuestions) * 100}%` }} />
        </div>

        {/* Section header */}
        <div className="bg-primary-50 rounded-lg p-3 text-center">
          <div className="font-bold text-primary-900 text-sm">{currentSection.label}</div>
          <div className="text-[11px] text-gray-600 mt-0.5">{currentSection.description}</div>
        </div>

        <Card className="!p-5 space-y-4">
          {/* === LISTENING === */}
          {currentQ.type === 'listening' && (
            <>
              <div className="text-[10px] uppercase font-bold text-gray-500 text-center">Écoute le mot anglais</div>
              <div className="flex justify-center">
                <button onClick={replayListen}
                  className="bg-primary-700 text-white px-6 py-3 rounded-full text-base font-bold hover:bg-primary-900 animate-breath">
                  🔊 Réécouter
                </button>
              </div>
              <div className="text-[10px] uppercase font-bold text-gray-500 text-center mt-2">Choisis sa traduction</div>
              <div className="space-y-2">
                {currentQ.choices.map((opt: string) => {
                  const isCorrect = opt === currentQ.correct
                  const isPicked = picked === opt
                  let cls = 'bg-white border-rule text-gray-800 hover:border-primary-300'
                  if (picked !== null) {
                    if (isCorrect) cls = 'bg-emerald-500 border-emerald-600 text-white shadow-md scale-[1.02]'
                    else if (isPicked) cls = 'bg-red-500 border-red-600 text-white'
                    else cls = 'bg-white border-rule text-gray-400 opacity-50'
                  }
                  return (
                    <button key={opt} disabled={picked !== null} onClick={() => pickQcm(opt)}
                      className={`w-full p-3 rounded-xl border-2 text-sm font-semibold transition flex items-center justify-between ${cls}`}>
                      <span className="flex-1 text-left">{opt}</span>
                      {picked !== null && isCorrect && <span className="text-xl ml-2">✓</span>}
                      {picked === opt && !isCorrect && <span className="text-xl ml-2">✗</span>}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* === SPEAKING === */}
          {currentQ.type === 'speaking' && (
            <>
              <div className="text-[10px] uppercase font-bold text-gray-500 text-center">Prononce ce mot</div>
              <div className="text-center">
                <div className="text-3xl font-extrabold text-primary-900">{currentQ.target_lemma}</div>
                {currentQ.ipa && <div className="font-mono text-primary-500 mt-1">{currentQ.ipa}</div>}
                <div className="text-xs text-gray-600 italic mt-1">🇫🇷 {currentQ.target_fr}</div>
              </div>
              <button onClick={() => speak(currentQ.target_lemma, voiceName, 0.85)}
                className="bg-primary-50 text-primary-700 font-semibold px-4 py-2 rounded-full text-sm mx-auto block">
                🔊 Écouter le modèle
              </button>
              {speakingScore === null ? (
                <div className="flex justify-center">
                  {!recording ? (
                    <button onClick={startSpeak} className="w-20 h-20 rounded-full bg-primary-700 text-white text-3xl mx-auto flex items-center justify-center animate-breath">🎤</button>
                  ) : (
                    <button onClick={stopSpeak} className="w-20 h-20 rounded-full bg-warn text-white text-3xl mx-auto flex items-center justify-center animate-pulse">■</button>
                  )}
                </div>
              ) : (
                <div className={`text-center p-3 rounded-xl ${speakingScore >= 60 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                  <div className={`text-2xl font-extrabold ${speakingScore >= 60 ? 'text-emerald-700' : 'text-red-700'}`}>
                    Score : {speakingScore}%
                  </div>
                  <div className="text-xs text-gray-700 mt-1">
                    {speakingScore >= 60 ? '🎯 Bonne prononciation !' : '❌ Pas tout à fait, on continue'}
                  </div>
                </div>
              )}
            </>
          )}

          {/* === WORD TO FR (QCM lecture) === */}
          {(currentQ.type === 'word_to_fr' || currentQ.type === 'fr_to_word') && (
            <>
              <div className="text-[10px] uppercase font-bold text-gray-500 text-center">
                {currentQ.type === 'word_to_fr' ? 'Que veut dire ce mot ?' : 'Quel est le mot anglais ?'}
              </div>
              <div className="text-center">
                <div className="text-3xl font-extrabold text-primary-900">{currentQ.prompt}</div>
                {currentQ.ipa && <div className="font-mono text-primary-500 text-sm mt-1">{currentQ.ipa}</div>}
              </div>
              <div className="space-y-2">
                {currentQ.choices.map((opt: string) => {
                  const isCorrect = opt === currentQ.correct
                  const isPicked = picked === opt
                  let cls = 'bg-white border-rule text-gray-800 hover:border-primary-300'
                  if (picked !== null) {
                    if (isCorrect) cls = 'bg-emerald-500 border-emerald-600 text-white shadow-md scale-[1.02]'
                    else if (isPicked) cls = 'bg-red-500 border-red-600 text-white'
                    else cls = 'bg-white border-rule text-gray-400 opacity-50'
                  }
                  return (
                    <button key={opt} disabled={picked !== null} onClick={() => pickQcm(opt)}
                      className={`w-full p-3 rounded-xl border-2 text-sm font-semibold transition flex items-center justify-between ${cls}`}>
                      <span className="flex-1 text-left">{opt}</span>
                      {picked !== null && isCorrect && <span className="text-xl ml-2">✓</span>}
                      {picked === opt && !isCorrect && <span className="text-xl ml-2">✗</span>}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </Card>
      </Container>
    </main>
  )
}
