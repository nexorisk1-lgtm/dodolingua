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

export function SpeakingClozeGame({ words, voiceName, onResult, onComplete }: GameProps) {
  const [idx, setIdx] = useState(0)
  const [recording, setRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [shown, setShown] = useState(false)
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

  function check() {
    const ok = transcript.toLowerCase().includes((w?.lemma || '').toLowerCase())
    const r = { correct: ok }
    setShown(true); onResult(r); setResults([...results, r])
    setTimeout(() => {
      if (idx + 1 >= words.length) onComplete?.([...results, r])
      else { setTranscript(''); setShown(false); setIdx(idx + 1) }
    }, 1200)
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
          <button onClick={start} className="w-20 h-20 rounded-full bg-primary-500 text-white text-3xl shadow-soft">🎤</button>
        ) : (
          <button onClick={stop} className="w-20 h-20 rounded-full bg-warn text-white text-3xl animate-pulse">■</button>
        )}
      </div>
      {transcript && (
        <div className="text-center text-sm text-gray-700 italic bg-gray-50 p-3 rounded-xl">
          <span className="text-xs text-gray-500 block">Tu as dit :</span>
          {transcript}
        </div>
      )}
      <button onClick={check} disabled={!transcript || shown} className="w-full p-3 bg-primary-700 text-white rounded-xl font-semibold disabled:opacity-50">
        Valider
      </button>
    </div>
  )
}
