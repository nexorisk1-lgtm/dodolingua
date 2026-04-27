'use client'

import { useEffect, useRef, useState } from 'react'

import { Container } from '@/components/ui/Container'

import { Card } from '@/components/ui/Card'

import { Button } from '@/components/ui/Button'

import { createClient } from '@/lib/supabase/client'

import { speak } from '@/components/games/utils'

import type { CoachMode } from '@/types/database'

interface Msg { role: 'user' | 'model'; text: string }

const MODE_LABELS: Record<CoachMode, string> = {

  conversationnel: '💬 Libre', hybride: '🎯 Hybride', professeur: '🎓 Prof',

  business: '💼 Business', guide: '✈️ Guide', expert_grc: '🛡️ GRC', culturel: '🎉 Culturel',

}

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

  const [activeModes, setActiveModes] = useState<CoachMode[]>([])

  const [override, setOverride] = useState<CoachMode | null>(null)

  const [voiceName, setVoiceName] = useState<string | null>(null)

  const [voiceOn, setVoiceOn] = useState(true)

  const [recording, setRecording] = useState(false)

  const [error, setError] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)

  const recRef = useRef<any>(null)

  useEffect(() => {

    (async () => {

      const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()

      if (!user) return

      const { data: p } = await supabase.from('user_preferences')

        .select('coach_modes_cached').eq('user_id', user.id).single()

      setActiveModes((p?.coach_modes_cached || ['hybride']) as CoachMode[])

      const { data: v } = await supabase.from('user_voice_pref')

        .select('voice_name').eq('user_id', user.id).eq('lang_code', 'en-GB').maybeSingle()

      if (v) setVoiceName(v.voice_name)

    })()

  }, [])

  useEffect(() => {

    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })

  }, [messages])

  async function send(text?: string) {

    const message = (text ?? val).trim()

    if (!message || loading) return

    setError(null)

    const next: Msg[] = [...messages, { role: 'user', text: message }]

    setMessages(next); setVal(''); setLoading(true)

    try {

      const res = await fetch('/api/coach', {

        method: 'POST', headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify({ messages: next, mode_override: override }),

      })

      const data = await res.json()

      if (!res.ok) { setError(data.error || 'Erreur'); setLoading(false); return }

      setMessages([...next, { role: 'model', text: data.reply }])

      if (voiceOn) speak(data.reply, voiceName)

    } catch (e: any) {

      setError(e.message || 'Erreur réseau')

    } finally {

      setLoading(false)

    }

  }

  function startRecording() {

    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

    if (!SR) {

      setError('Reconnaissance vocale non disponible sur ce navigateur. Utilise plutôt Chrome.')

      return

    }

    const rec = new SR()

    rec.lang = 'en-GB'

    rec.continuous = false

    rec.interimResults = true

    rec.onstart = () => setRecording(true)

    rec.onerror = (e: any) => { setError('Erreur micro : ' + e.error); setRecording(false) }

    rec.onend = () => setRecording(false)

    rec.onresult = (e: any) => {

      let transcript = ''

      for (let i = e.resultIndex; i < e.results.length; i++) transcript += e.results[i][0].transcript

      if (e.results[e.results.length - 1].isFinal) {

        send(transcript)

      } else {

        setVal(transcript)

      }

    }

    try { rec.start(); recRef.current = rec } catch (err: any) { setError(err.message) }

  }

  function stopRecording() { try { recRef.current?.stop() } catch {} setRecording(false) }

  return (

    <Container className="max-w-2xl space-y-3">

      <div className="flex items-center justify-between">

        <h1 className="text-xl font-bold text-primary-900">💬 Coach</h1>

        <button onClick={() => setVoiceOn(!voiceOn)}

          className={`text-xs px-3 py-1.5 rounded-full font-semibold ${voiceOn ? 'bg-primary-700 text-white' : 'bg-white border border-rule text-gray-600'}`}>

          {voiceOn ? '🔊 Voix ON' : '🔇 Voix OFF'}

        </button>

      </div>

      <Card className="!p-2">

        <div className="text-[10px] uppercase font-bold text-gray-500 px-2 py-1">Modes selon tes objectifs</div>

        <div className="flex flex-wrap gap-1 px-1">

          <button onClick={() => setOverride(null)}

            className={`text-[11px] px-2.5 py-1 rounded-full ${!override ? 'bg-primary-700 text-white' : 'bg-primary-50 text-primary-700'}`}>

            Auto ({activeModes.length})

          </button>

          {activeModes.map(m => (

            <button key={m} onClick={() => setOverride(m === override ? null : m)}

              className={`text-[11px] px-2.5 py-1 rounded-full ${override === m ? 'bg-primary-700 text-white' : 'bg-white border border-rule text-gray-700'}`}>

              {MODE_LABELS[m]}

            </button>

          ))}

        </div>

      </Card>

      <Card className="!p-3">

        <div ref={scrollRef} className="h-[55vh] overflow-y-auto space-y-2 px-1 py-2">

          {messages.length === 0 && (

            <div className="text-center text-sm text-gray-400 italic py-12">

              Démarre la conversation. Le coach s&apos;adapte à tes objectifs.<br />

              <span className="text-xs">💡 Tu peux aussi parler en cliquant sur 🎤</span>

            </div>

          )}

          {messages.map((m, i) => (

            <div key={i} className={`max-w-[85%] p-3 rounded-2xl text-sm ${m.role === 'user' ? 'ml-auto bg-primary-700 text-white rounded-br-md' : 'mr-auto bg-primary-50 text-gray-800 rounded-bl-md'}`}>

              {m.text}

              {m.role === 'model' && (

                <button onClick={() => speak(m.text, voiceName)} className="block mt-1 text-[10px] opacity-60">🔊</button>

              )}

            </div>

          ))}

          {loading && <div className="text-xs text-gray-400 italic">Le coach réfléchit…</div>}

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

              title="Parler au coach">

              🎤

            </button>

          ) : (

            <button onClick={stopRecording}

              className="w-10 h-10 rounded-full bg-warn text-white text-lg animate-pulse"

              title="Arrêter">

              ■

            </button>

          )}

          <Button size="sm" onClick={() => send()} disabled={loading || !val.trim()}>Envoyer</Button>

        </div>

      </Card>

    </Container>

  )

}
