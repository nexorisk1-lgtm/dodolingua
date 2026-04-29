'use client'

import { useEffect, useRef, useState } from 'react'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Mascot } from '@/components/Mascot'
import { createClient } from '@/lib/supabase/client'
import { speak } from '@/components/games/utils'

interface Msg { role: 'user' | 'model'; text: string }

declare global {
  interface Window {
    webkitSpeechRecognition?: any
    SpeechRecognition?: any
  }
}

function cleanForVoice(text: string): string {
  return text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}\u{FE00}-\u{FE0F}\u{1F100}-\u{1F1FF}]/gu, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/->/g, ' ')
    .replace(/→/g, ' ')
    .replace(/Correction:/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// v1.3 — Ajoute une ponctuation basique à un transcript STT brut.
// Capitalise la première lettre, ajoute "." ou "?" en fin si manquant.
function addBasicPunctuation(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  let out = trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
  const isQuestion = /^(who|what|when|where|why|how|do|does|did|can|could|is|are|am|will|would|should|may|might)\b/i.test(trimmed)
  if (!/[.!?]$/.test(out)) out += isQuestion ? '?' : '.'
  return out
}

// Parse une ligne "Correction: X -> Y. (Z)" ou "Correction: X → Y. (Z)"
function parseCorrection(line: string): { wrong: string; correct: string; reason?: string } | null {
  const m = line.match(/^Correction:\s*(.+?)\s*(?:->|→)\s*(.+?)(?:\s*\((.+?)\))?\.?\s*$/i)
  if (!m) return null
  return { wrong: m[1].trim(), correct: m[2].trim(), reason: m[3]?.trim() }
}

function MessageContent({ text }: { text: string }) {
  const lines = text.split('\n').filter(l => l.trim() !== '')
  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        const corr = parseCorrection(line)
        if (corr) {
          return (
            <div key={i} className="bg-amber-50 border-l-4 border-accent-500 rounded p-2 my-1">
              <div className="text-[11px] font-bold text-accent-700 uppercase tracking-wide">💡 Correction</div>
              <div className="mt-1 text-sm">
                <span className="line-through text-warn">{corr.wrong}</span>
                <span className="mx-2 text-gray-400">→</span>
                <span className="font-bold text-ok">{corr.correct}</span>
              </div>
              {corr.reason && (
                <div className="text-xs italic text-gray-600 mt-1">📖 {corr.reason}</div>
              )}
            </div>
          )
        }
        return <div key={i} style={{ whiteSpace: 'pre-wrap' }}>{line}</div>
      })}
    </div>
  )
}

function hasCorrection(text: string): boolean {
  return /correction\s*:/i.test(text)
}

export default function CoachPage() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [val, setVal] = useState('')
  const [loading, setLoading] = useState(false)
  const [voiceName, setVoiceName] = useState<string | null>(null)
  const [voiceOn, setVoiceOn] = useState(true)
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const recRef = useRef<any>(null)
  const greetedRef = useRef(false)

  function speakClean(text: string) {
    if (voiceOn) speak(cleanForVoice(text), voiceName, 0.85)
  }

  useEffect(() => {
    (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: v } = await supabase.from('user_voice_pref')
        .select('voice_name').eq('user_id', user.id).eq('lang_code', 'en-GB').maybeSingle()
      if (v) setVoiceName(v.voice_name)
      if (!greetedRef.current) {
        greetedRef.current = true
        sendInitialGreeting()
      }
    })()
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  async function sendInitialGreeting() {
    setLoading(true)
    try {
      const res = await fetch('/api/coach', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', text: '__START__' }] }),
      })
      const data = await res.json()
      if (res.ok && data.reply) {
        setMessages([{ role: 'model', text: data.reply }])
        speakClean(data.reply)
      }
    } catch {} finally { setLoading(false) }
  }

  async function send(text?: string) {
    const message = (text ?? val).trim()
    if (!message || loading) return
    setError(null)
    const next: Msg[] = [...messages, { role: 'user', text: message }]
    setMessages(next); setVal(''); setLoading(true)
    try {
      const res = await fetch('/api/coach', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erreur'); setLoading(false); return }
      setMessages([...next, { role: 'model', text: data.reply }])
      speakClean(data.reply)
    } catch (e: any) {
      setError(e.message || 'Erreur réseau')
    } finally { setLoading(false) }
  }

  function startRecording() {
    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
    if (!SR) {
      setError('Reconnaissance vocale non disponible. Utilise Chrome.')
      return
    }
    const rec = new SR()
    rec.lang = 'en-GB'
    rec.continuous = true
    rec.interimResults = true
    rec.onstart = () => setRecording(true)
    rec.onerror = (e: any) => { setError('Erreur micro : ' + e.error); setRecording(false) }
    rec.onend = () => setRecording(false)
    rec.onresult = (e: any) => {
      let transcript = ''
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript
      }
      setVal(transcript.trim())
    }
    try { rec.start(); recRef.current = rec } catch (err: any) { setError(err.message) }
  }

  function stopRecording() {
    try { recRef.current?.stop() } catch {}
    setRecording(false)
    // v1.3 — Ponctuation auto sur le transcript final
    setVal(prev => prev ? addBasicPunctuation(prev) : prev)
  }

  // Choisir la pose du Dodo selon le dernier message du coach
  const lastModelMsg = [...messages].reverse().find(m => m.role === 'model')
  const dodoPose = lastModelMsg
    ? (hasCorrection(lastModelMsg.text) ? 'study' : 'happy')
    : 'idle'

  return (
    <Container className="max-w-2xl space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Mascot pose={dodoPose} size={80} animation="breathe" />
          <div>
            <h1 className="text-2xl font-bold text-primary-900">Dodo, ton coach</h1>
            <div className="text-xs text-gray-500">Discute en anglais, je te corrige en douceur</div>
          </div>
        </div>
        <button onClick={() => setVoiceOn(!voiceOn)}
          className={`text-xs px-3 py-1.5 rounded-full font-semibold ${voiceOn ? 'bg-primary-700 text-white' : 'bg-white border border-rule text-gray-600'}`}>
          {voiceOn ? '🔊 Voix ON' : '🔇 Voix OFF'}
        </button>
      </div>

      <Card className="!p-3">
        <div ref={scrollRef} className="h-[60vh] overflow-y-auto space-y-2 px-1 py-2">
          {messages.length === 0 && !loading && (
            <div className="text-center py-12">
              <Mascot pose="idle" size={140} animation="wave" />
              <div className="text-sm text-gray-400 italic mt-4">Dodo arrive…</div>
            </div>
          )}
          {messages.length === 0 && loading && (
            <div className="text-center py-12">
              <Mascot pose="study" size={140} animation="breathe" />
              <div className="text-sm text-gray-400 italic mt-4">Dodo prépare ton accueil…</div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`max-w-[85%] p-3 rounded-2xl text-sm ${m.role === 'user' ? 'ml-auto bg-primary-700 text-white rounded-br-md' : 'mr-auto bg-primary-50 text-gray-800 rounded-bl-md'}`}>
              {m.role === 'model' ? (
                <>
                  <MessageContent text={m.text} />
                  <button onClick={() => speakClean(m.text)} className="block mt-2 text-[10px] opacity-60 hover:opacity-100">🔊 Réécouter</button>
                </>
              ) : (
                <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
              )}
            </div>
          ))}
          {loading && messages.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-gray-400 italic">
              <Mascot pose="study" size={32} animation="breathe" />
              Dodo réfléchit…
            </div>
          )}
          {error && <div className="text-xs text-warn p-2 bg-red-50 rounded">{error}</div>}
        </div>

        <div className="flex gap-2 pt-2 border-t border-rule">
          <input value={val} onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            disabled={loading}
            placeholder={recording ? 'Parle… clique stop quand fini' : 'Tape ou parle…'}
            className="flex-1 px-3 py-2 border border-rule rounded-full text-sm" />
          {!recording ? (
            <button onClick={startRecording} disabled={loading}
              className="w-10 h-10 rounded-full bg-primary-50 text-primary-700 text-lg hover:bg-primary-100 disabled:opacity-50"
              title="Parler à Dodo">🎤</button>
          ) : (
            <button onClick={stopRecording} className="w-10 h-10 rounded-full bg-warn text-white text-lg animate-pulse" title="Arrêter">■</button>
          )}
          <Button size="sm" onClick={() => send()} disabled={loading || !val.trim()}>Envoyer</Button>
        </div>
      </Card>
    </Container>
  )
}
