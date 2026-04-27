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

  useEffect(() => {
    (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: v } = await supabase.from('user_voice_pref')
        .select('voice_name').eq('user_id', user.id).eq('lang_code', 'en-GB').maybeSingle()
      if (v) setVoiceName(v.voice_name)

      // Auto greeting au chargement (une seule fois)
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
        if (voiceOn) speak(data.reply, voiceName)
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
      if (voiceOn) speak(data.reply, voiceName)
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
    rec.lang = 'en-GB'; rec.continuous = false; rec.interimResults = true
    rec.onstart = () => setRecording(true)
    rec.onerror = (e: any) => { setError('Erreur micro : ' + e.error); setRecording(false) }
    rec.onend = () => setRecording(false)
    rec.onresult = (e: any) => {
      let transcript = ''
      for (let i = e.resultIndex; i < e.results.length; i++) transcript += e.results[i][0].transcript
      if (e.results[e.results.length - 1].isFinal) send(transcript)
      else setVal(transcript)
    }
    try { rec.start(); recRef.current = rec } catch (err: any) { setError(err.message) }
  }

  function stopRecording() { try { recRef.current?.stop() } catch {} setRecording(false) }

  return (
    <Container className="max-w-2xl space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Mascot pose="listen" size={56} animation="breathe" />
          <div>
            <h1 className="text-xl font-display font-bold text-primary-900">Dodo, ton coach</h1>
            <div className="text-xs text-gray-500">Discute en anglais, je t'aide</div>
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
            <div className="text-center py-8">
              <Mascot pose="idle" size={100} animation="wave" />
              <div className="text-sm text-gray-400 italic mt-3">Dodo arrive dans une seconde…</div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`max-w-[85%] p-3 rounded-2xl text-sm animate-pop-in ${m.role === 'user' ? 'ml-auto bg-primary-700 text-white rounded-br-md' : 'mr-auto bg-primary-50 text-gray-800 rounded-bl-md'}`}>
              {m.text}
              {m.role === 'model' && (
                <button onClick={() => speak(m.text, voiceName)} className="block mt-1 text-[10px] opacity-60 hover:opacity-100">🔊 Réécouter</button>
              )}
            </div>
          ))}
          {loading && (
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
            disabled={loading || recording}
            placeholder={recording ? 'Parle… 🎤' : 'Tape ou parle…'}
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
