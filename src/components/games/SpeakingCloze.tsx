'use client'
import { useState, useEffect, useRef } from 'react'
import type { GameProps } from './types'
import { speak } from './utils'

declare global {
  interface Window {
    webkitSpeechRecognition?: any
    SpeechRecognition?: any
  }
}

/**
 * Speaking Cloze — répétition vocale avec STT.
 *
 * v1.3 — Ajouts :
 * - Bouton "Réécouter ma réponse" qui rejoue le transcript via TTS
 * - Score de prononciation simple (% de mots reconnus)
 * - Feedback visuel vert/rouge avec score
 */
export function SpeakingClozeGame({ words, voiceName, onResult, onComplete }: GameProps) {
  const [idx, setIdx] = useState(0)
  const [recording, setRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [feedback, setFeedback] = useState<{ correct: boolean; score: number; expected: string; given: string } | null>(null)
  const [results, setResults] = useState<any[]>([])
  const recRef = useRef<any>(null)
  const w = words[idx]
  const sentence = w?.example || (w ? `Please say ${w.lemma} now.` : '')

  useEffect(() => () => { try { recRef.current?.stop() } catch {} }, [])

  function start() {
    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
    if (!SR) { alert('Reconnaissance vocale non disponible sur ce navigateur.'); return }
    const rec = new SR()
    rec.lang = 'en-GB'; rec.continuous = false; rec.interimResults = true
    rec.onresult = (e: any) => {
      let text = ''
      for (let i = e.resultIndex; i < e.results.length; i++) text += e.results[i][0].transcript
      setTranscript(text)
    }
    rec.onend = () => setRecording(false)
    rec.onerror = () => setRecording(false)
    rec.start()
    recRef.current = rec
    setRecording(true); setTranscript('')
  }
  function stop() { recRef.current?.stop(); setRecording(false) }

  // v1.3 — Score de prononciation = % de mots cibles présents dans le transcript.
  function scoreFor(target: string, said: string): number {
    const norm = (s: string) => s.toLowerCase().replace(/[.,!?]/g, '').trim()
    const targetWords = norm(target).split(/\s+/).filter(Boolean)
    const saidNorm = norm(said)
    if (targetWords.length === 0) return 0
    const matched = targetWords.filter(tw => saidNorm.includes(tw)).length
    return Math.round((matched / targetWords.length) * 100)
  }

  function check() {
    const score = scoreFor(sentence, transcript)
    const ok = score >= 70 // 70% des mots cibles → validé
    const r = { correct: ok, details: { score } }
    setFeedback({ correct: ok, score, expected: sentence, given: transcript })
    onResult(r)
    setResults([...results, r])
    setTimeout(() => {
      setFeedback(null)
      if (idx + 1 >= words.length) onComplete?.([...results, r])
      else { setTranscript(''); setIdx(idx + 1) }
    }, 2500)
  }

  if (!w) return null

  return (
    <div className="space-y-4">
      <div className="text-xs text-center text-gray-500">{idx + 1} / {words.length}</div>
      <div className="bg-white border border-rule rounded-2xl p-6 text-center space-y-2">
        <div className="text-sm text-gray-500">Dis cette phrase à voix haute</div>
        <div className="text-lg font-bold text-primary-900">{sentence}</div>
        <button onClick={() => speak(sentence, voiceName)} className="text-sm bg-primary-50 text-primary-700 px-3 py-1 rounded-full">🔊 Modèle</button>
      </div>
      <div className="flex justify-center">
        {!recording ? (
          <button onClick={start} disabled={!!feedback}
            className="w-20 h-20 rounded-full bg-primary-500 text-white text-3xl shadow-soft disabled:opacity-50">🎤</button>
        ) : (
          <button onClick={stop} className="w-20 h-20 rounded-full bg-warn text-white text-3xl animate-pulse">■</button>
        )}
      </div>

      {transcript && !feedback && (
        <div className="text-center text-sm text-gray-700 italic bg-gray-50 p-3 rounded-xl">
          <div className="text-xs text-gray-500 block mb-1">Tu as dit :</div>
          <div>{transcript}</div>
          {/* v1.3 — Bouton réécoute */}
          <button onClick={() => speak(transcript, voiceName)}
            className="mt-2 text-xs bg-primary-50 text-primary-700 px-3 py-1 rounded-full">
            🔊 Réécouter ma réponse
          </button>
        </div>
      )}

      {/* v1.3 — Bloc feedback avec score */}
      {feedback && (
        <div className={`border-l-4 p-3 rounded-r-lg space-y-1 ${
          feedback.correct ? 'border-ok bg-green-50' : 'border-warn bg-yellow-50'
        }`}>
          <div className="flex items-center justify-between">
            <div className={`text-[10px] uppercase font-bold ${feedback.correct ? 'text-ok' : 'text-warn'}`}>
              {feedback.correct ? '✓ Bien joué' : '💡 Encore un effort'}
            </div>
            <div className={`text-lg font-extrabold ${feedback.correct ? 'text-ok' : 'text-warn'}`}>
              {feedback.score}%
            </div>
          </div>
          <div className="text-xs text-gray-500">Attendu :</div>
          <div className="text-sm font-semibold text-primary-900">{feedback.expected}</div>
          {feedback.given && (
            <>
              <div className="text-xs text-gray-500 mt-1">Tu as dit :</div>
              <div className="text-sm italic text-gray-700">{feedback.given}</div>
              <button onClick={() => speak(feedback.given, voiceName)}
                className="text-xs bg-white border border-rule px-2 py-0.5 rounded-full mt-1">
                🔊 Réécouter
              </button>
            </>
          )}
        </div>
      )}

      <button onClick={check} disabled={!transcript || !!feedback}
        className="w-full p-3 bg-primary-700 text-white rounded-xl font-semibold disabled:opacity-50">
        Valider
      </button>
    </div>
  )
}
