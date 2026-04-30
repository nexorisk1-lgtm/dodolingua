'use client'

import { useEffect, useRef, useState } from 'react'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Mascot } from '@/components/Mascot'
import { createClient } from '@/lib/supabase/client'
import { speak, getBestVoice, waitForVoices } from '@/components/games/utils'
import {
  PronunciationBadge,
  extractWordScores,
  scoreAgainstTarget,
  extractTargetPhrase,
  type WordScore,
} from '@/components/coach/PronunciationBadge'

/**
 * v3.1 — Coach Speaking refondu.
 *
 * Patterns benchmarkés (sources : ELSA, Praktika, Langua, Babbel, Loora) :
 *  - Axe 1 (ELSA) : surlignage prononciation vert/rouge en mode speaking_pur,
 *    BASÉ SUR LA PHRASE CIBLE (pas la confidence brute).
 *  - Axe 2 (Praktika) : bouton 💡 corrections à la demande sur messages user
 *    en mode tuteur (PAS de correction automatique).
 *  - Axe 3 : isolation stricte des fils de conversation par mode (étanchéité).
 *  - Axe 4 (Babbel) : "breathing cue" sur le bouton micro à l'état idle.
 *  - Axe 5 : espace libre toujours disponible.
 *  - Axe 9 (Pimsleur/ELSA) : mode speaking_pur avec drill (bouton 🔁 Refaire).
 *
 * Bugs corrigés :
 *  - Bug 1 (v3) : threads par mode → switcher de mode ne mélange plus les conversations
 *  - Bug 2 (v3) : speakClean stoppe le micro AVANT TTS, redémarre après onend
 *
 * Nouveautés v3.1 :
 *  - Score Speaking pur fiable : extrait la phrase cible du dernier message
 *    du coach et compare la transcription. Vert si match, rouge sinon.
 *  - Enregistrement audio en parallèle du STT en mode speaking_pur. Bouton
 *    "▶️ Réécouter ma voix" pour s'auto-évaluer.
 *  - Hauteur de conversation augmentée (60 → 70vh) + scroll moins agressif :
 *    si l'utilisateur a scrollé manuellement, on n'auto-scroll plus tant qu'il
 *    n'est pas revenu en bas.
 *
 * TODO v3.2 :
 *  - Capter les corrections du Tuteur (endpoint /api/coach/correct) pour les
 *    injecter dans le module Révisions de l'app (idée Raïssa du 30/04/2026).
 *  - Persistance des threads en BDD (Supabase) pour retrouver l'historique
 *    entre sessions.
 */

type Mode = 'tuteur' | 'ami' | 'auto' | 'speaking_pur'
type CoachState = 'idle' | 'listening' | 'thinking' | 'speaking'

interface Msg {
  role: 'user' | 'model'
  text: string
  /** v3.1 — scores de prononciation par mot (mode speaking_pur uniquement) */
  wordScores?: WordScore[]
  /** v3.1 — true si scoring basé sur match phrase cible */
  hasTarget?: boolean
  /** v3.1 — Blob URL de l'enregistrement audio de l'utilisateur (mode speaking_pur) */
  audioUrl?: string
  /** v3 — correction à la demande (mode tuteur) */
  correction?: { state: 'loading' | 'ready' | 'error'; text?: string }
}

declare global {
  interface Window {
    webkitSpeechRecognition?: any
    SpeechRecognition?: any
  }
}

const MODE_TABS: { key: Mode; emoji: string; label: string; sub: string }[] = [
  { key: 'ami',          emoji: '💬', label: 'Ami',           sub: 'Discute librement' },
  { key: 'auto',         emoji: '🎯', label: 'Auto',          sub: 'Équilibré' },
  { key: 'tuteur',       emoji: '🎓', label: 'Tuteur',        sub: '💡 à la demande' },
  { key: 'speaking_pur', emoji: '🎙️', label: 'Speaking pur',  sub: 'Prononciation' },
]

const STATE_BADGE: Record<CoachState, { label: string; cls: string }> = {
  idle:      { label: '○ Prêt',          cls: 'bg-gray-100 text-gray-600' },
  listening: { label: '🎤 Écoute',       cls: 'bg-blue-100 text-blue-700 animate-pulse' },
  thinking:  { label: '⏳ Réfléchit…',   cls: 'bg-amber-100 text-amber-700' },
  speaking:  { label: '🔊 Parle',         cls: 'bg-emerald-100 text-emerald-700' },
}

function cleanForVoice(text: string): string {
  const conversationalLines = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .filter(l => !/^Correction\s*:/i.test(l))
    .filter(l => !/^Better\s*:/i.test(l))
    .join('. ')

  return conversationalLines
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}\u{FE00}-\u{FE0F}\u{1F100}-\u{1F1FF}]/gu, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/->/g, ' ')
    .replace(/→/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function addBasicPunctuation(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  let out = trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
  const isQuestion = /^(who|what|when|where|why|how|do|does|did|can|could|is|are|am|will|would|should|may|might)\b/i.test(trimmed)
  if (!/[.!?]$/.test(out)) out += isQuestion ? '?' : '.'
  return out
}

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
  // v3 — un fil par mode
  const [threads, setThreads] = useState<Record<Mode, Msg[]>>({
    ami: [], auto: [], tuteur: [], speaking_pur: [],
  })
  const [activeMode, setActiveMode] = useState<Mode>('auto')
  const messages = threads[activeMode]

  const [val, setVal] = useState('')
  const [voiceName, setVoiceName] = useState<string | null>(null)
  const [voiceOn, setVoiceOn] = useState(true)
  const [voiceConvMode, setVoiceConvMode] = useState(false)
  const [state, setState] = useState<CoachState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [voiceReady, setVoiceReady] = useState(false)

  const voiceConvModeRef = useRef(false)
  const ttsActiveRef = useRef(false)
  const silenceTimerRef = useRef<any>(null)
  const lastTranscriptRef = useRef('')
  const lastConfidenceRef = useRef<number>(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  // v3.1 — Track si l'user a scrollé manuellement vers le haut
  const userHasScrolledUpRef = useRef(false)
  const recRef = useRef<any>(null)
  const greetedRef = useRef<Record<Mode, boolean>>({ ami: false, auto: false, tuteur: false, speaking_pur: false })

  // v3.1 — Audio recording (parallèle au SpeechRecognition)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const lastAudioUrlRef = useRef<string | null>(null)

  useEffect(() => { voiceConvModeRef.current = voiceConvMode }, [voiceConvMode])

  const loading = state === 'thinking'
  const recording = state === 'listening'
  const micDisabled = state === 'thinking' || state === 'speaking'

  useEffect(() => {
    (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: v } = await supabase.from('user_voice_pref')
        .select('voice_name').eq('user_id', user.id).eq('lang_code', 'en-GB').maybeSingle()
      await waitForVoices(2000)
      if (v?.voice_name) {
        setVoiceName(v.voice_name)
      } else {
        const best = getBestVoice('en')
        if (best?.name) setVoiceName(best.name)
      }
      setVoiceReady(true)
    })()
  }, [])

  // Greeting initial (UNE FOIS PAR MODE)
  useEffect(() => {
    if (!voiceReady) return
    if (greetedRef.current[activeMode]) return
    greetedRef.current[activeMode] = true
    sendInitialGreeting(activeMode)
  }, [voiceReady, activeMode])

  // v3.1 — Scroll moins agressif : seulement si user n'a PAS scrollé manuellement
  useEffect(() => {
    if (userHasScrolledUpRef.current) return
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  // Détecter le scroll manuel de l'utilisateur
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      if (!el) return
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      // Si on est à plus de 50px du bas, l'user veut lire l'historique
      userHasScrolledUpRef.current = distFromBottom > 50
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  function stopMic() {
    try { recRef.current?.stop() } catch {}
    recRef.current = null
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null }
    // Arrêter aussi l'enregistrement audio s'il tourne
    stopAudioRecording()
  }

  // v3.1 — Audio recording lifecycle
  async function startAudioRecording() {
    if (typeof window === 'undefined' || !navigator.mediaDevices) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioStreamRef.current = stream
      audioChunksRef.current = []
      const mr = new MediaRecorder(stream)
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data)
      }
      mr.onstop = () => {
        if (audioChunksRef.current.length === 0) return
        const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || 'audio/webm' })
        const url = URL.createObjectURL(blob)
        lastAudioUrlRef.current = url
        // Cleanup stream
        try { audioStreamRef.current?.getTracks().forEach(t => t.stop()) } catch {}
        audioStreamRef.current = null
      }
      mr.start()
      mediaRecorderRef.current = mr
    } catch (e) {
      // Microphone refusé ou indisponible — on ne bloque pas le STT pour autant
      mediaRecorderRef.current = null
    }
  }

  function stopAudioRecording() {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
    } catch {}
    mediaRecorderRef.current = null
  }

  function speakClean(text: string, onEnd?: () => void) {
    if (!voiceOn) { onEnd?.(); return }
    const cleanText = cleanForVoice(text)
    if (!cleanText) { onEnd?.(); return }
    if (typeof window === 'undefined' || !window.speechSynthesis) { onEnd?.(); return }

    stopMic()
    ttsActiveRef.current = true
    setState('speaking')

    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(cleanText)
    if (voiceName) {
      const v = window.speechSynthesis.getVoices().find((vc: SpeechSynthesisVoice) => vc.name === voiceName)
      if (v) { u.voice = v; u.lang = v.lang }
    } else {
      u.lang = 'en-GB'
    }
    u.rate = 0.85
    u.pitch = 1

    let ended = false
    const fire = () => {
      if (ended) return
      ended = true
      ttsActiveRef.current = false
      window.setTimeout(() => {
        if (!ttsActiveRef.current) setState('idle')
        onEnd?.()
      }, 300)
    }
    u.onend = fire
    u.onerror = fire
    const safetyMs = Math.min(30_000, cleanText.length * 60 + 500)
    window.setTimeout(fire, safetyMs)

    window.speechSynthesis.speak(u)
  }

  async function sendInitialGreeting(mode: Mode) {
    setState('thinking')
    try {
      const res = await fetch('/api/coach', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', text: '__START__' }], mode }),
      })
      const data = await res.json()
      if (res.ok && data.reply) {
        setThreads(prev => ({ ...prev, [mode]: [{ role: 'model', text: data.reply }] }))
        speakClean(data.reply, () => {
          if (voiceConvModeRef.current && state !== 'listening') {
            setTimeout(() => startContinuousRecording(), 400)
          }
        })
      } else {
        setState('idle')
      }
    } catch {
      setState('idle')
    }
  }

  /**
   * v3.1 — Récupère la phrase cible à comparer pour le scoring speaking_pur.
   * On la cherche dans le DERNIER message du coach.
   */
  function getCurrentTargetPhrase(): string | null {
    const lastModel = [...threads.speaking_pur].reverse().find(m => m.role === 'model')
    if (!lastModel) return null
    return extractTargetPhrase(lastModel.text)
  }

  async function send(text?: string, wordScores?: WordScore[], audioUrl?: string, hasTarget?: boolean) {
    const message = (text ?? val).trim()
    if (!message || loading || state === 'speaking') return
    setError(null)

    const currentMode = activeMode
    const userMsg: Msg = { role: 'user', text: message }
    if (wordScores && wordScores.length) userMsg.wordScores = wordScores
    if (hasTarget) userMsg.hasTarget = true
    if (audioUrl) userMsg.audioUrl = audioUrl
    const next: Msg[] = [...threads[currentMode], userMsg]
    setThreads(prev => ({ ...prev, [currentMode]: next }))
    setVal('')
    stopMic()
    setState('thinking')
    // L'user vient d'envoyer, on revient en bas du fil
    userHasScrolledUpRef.current = false

    try {
      const res = await fetch('/api/coach', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map(m => ({ role: m.role, text: m.text })),
          mode: currentMode,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Erreur')
        setState('idle')
        return
      }
      const updated: Msg[] = [...next, { role: 'model', text: data.reply }]
      setThreads(prev => ({ ...prev, [currentMode]: updated }))
      speakClean(data.reply, () => {
        if (voiceConvModeRef.current && state !== 'listening') {
          setTimeout(() => startContinuousRecording(), 400)
        }
      })
    } catch (e: any) {
      setError(e.message || 'Erreur réseau')
      setState('idle')
    }
  }

  function startRecording() {
    if (state === 'thinking' || state === 'speaking') return
    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
    if (!SR) {
      setError('Reconnaissance vocale non disponible. Utilise Chrome.')
      return
    }
    const rec = new SR()
    rec.lang = 'en-GB'
    rec.continuous = true
    rec.interimResults = true
    lastConfidenceRef.current = 0

    // v3.1 — Démarre l'enregistrement audio en parallèle (mode speaking_pur uniquement)
    if (activeMode === 'speaking_pur') {
      startAudioRecording()
    }

    rec.onstart = () => setState('listening')
    rec.onerror = (e: any) => { setError('Erreur micro : ' + e.error); setState('idle'); stopAudioRecording() }
    rec.onend = () => setState(s => s === 'listening' ? 'idle' : s)
    rec.onresult = (e: any) => {
      let transcript = ''
      let confidence = 0
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript
        if (typeof e.results[i][0].confidence === 'number') confidence = e.results[i][0].confidence
      }
      lastConfidenceRef.current = confidence
      setVal(transcript.trim())
    }
    try { rec.start(); recRef.current = rec } catch (err: any) { setError(err.message) }
  }

  function startContinuousRecording() {
    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
    if (!SR) {
      setError('Reconnaissance vocale non disponible. Utilise Chrome.')
      setVoiceConvMode(false)
      return
    }
    if (recRef.current) return
    const rec = new SR()
    rec.lang = 'en-GB'
    rec.continuous = true
    rec.interimResults = true
    lastConfidenceRef.current = 0

    if (activeMode === 'speaking_pur') {
      startAudioRecording()
    }

    rec.onstart = () => { setState('listening'); lastTranscriptRef.current = '' }
    rec.onerror = (e: any) => {
      if (e.error === 'no-speech' && voiceConvModeRef.current) {
        setState('idle')
        stopAudioRecording()
        setTimeout(() => { if (voiceConvModeRef.current) startContinuousRecording() }, 300)
        return
      }
      setError('Erreur micro : ' + e.error)
      setState('idle')
      stopAudioRecording()
    }
    rec.onend = () => {
      setState(s => s === 'listening' ? 'idle' : s)
      if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null }
    }
    rec.onresult = (e: any) => {
      let transcript = ''
      let confidence = 0
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript
        if (typeof e.results[i][0].confidence === 'number') confidence = e.results[i][0].confidence
      }
      transcript = transcript.trim()
      lastTranscriptRef.current = transcript
      lastConfidenceRef.current = confidence
      setVal(transcript)
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = setTimeout(() => {
        const finalText = lastTranscriptRef.current.trim()
        try { rec.stop() } catch {}
        // Stop audio recording → laisse onstop générer le blob URL
        stopAudioRecording()
        // Délai court pour que le blob URL soit disponible
        setTimeout(() => {
          if (finalText.length > 0) {
            const punct = addBasicPunctuation(finalText)
            let scores: WordScore[] | undefined
            let hasTarget = false
            if (activeMode === 'speaking_pur') {
              const target = getCurrentTargetPhrase()
              if (target) {
                scores = scoreAgainstTarget(punct, target, lastConfidenceRef.current)
                hasTarget = true
              } else {
                scores = extractWordScores(punct, lastConfidenceRef.current)
              }
            }
            const audioUrl = lastAudioUrlRef.current || undefined
            lastAudioUrlRef.current = null
            send(punct, scores, audioUrl, hasTarget)
          }
        }, 250)
      }, 1500)
    }
    try { rec.start(); recRef.current = rec } catch (err: any) { setError(err.message) }
  }

  function toggleVoiceConvMode() {
    const next = !voiceConvMode
    setVoiceConvMode(next)
    if (next) {
      if (state !== 'thinking' && state !== 'listening') {
        setTimeout(() => startContinuousRecording(), 200)
      }
    } else {
      stopMic()
      try { window.speechSynthesis.cancel() } catch {}
      setState('idle')
    }
  }

  async function stopRecording() {
    stopMic()
    setState('idle')
    // Bouton stop manuel — si on était en speaking_pur, attache aussi les wordScores et l'audio
    setVal(prev => {
      if (!prev) return prev
      const punct = prev
      let scores: WordScore[] | undefined
      let hasTarget = false
      let audioUrl: string | undefined
      if (activeMode === 'speaking_pur') {
        const target = getCurrentTargetPhrase()
        if (target) {
          scores = scoreAgainstTarget(punct, target, lastConfidenceRef.current)
          hasTarget = true
        } else {
          scores = extractWordScores(punct, lastConfidenceRef.current)
        }
        audioUrl = lastAudioUrlRef.current || undefined
        lastAudioUrlRef.current = null
      }
      // En mode speaking_pur on auto-envoie ; sinon on garde dans l'input
      if (activeMode === 'speaking_pur' && punct.trim()) {
        // Délai pour laisser le blob arriver
        setTimeout(() => send(punct, scores, audioUrl, hasTarget), 250)
        return ''
      }
      // Sinon, ponctuation Gemini en background
      ;(async () => {
        try {
          const res = await fetch('/api/punctuate', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: prev, lang: 'en-GB' }),
          })
          const data = await res.json()
          if (data?.text && data.text.trim().length > 0) {
            setVal(data.text)
          } else {
            setVal(addBasicPunctuation(prev))
          }
        } catch {
          setVal(addBasicPunctuation(prev))
        }
      })()
      return prev
    })
  }

  function switchMode(m: Mode) {
    if (m === activeMode) return
    if (state === 'listening') stopMic()
    try { window.speechSynthesis.cancel() } catch {}
    ttsActiveRef.current = false
    setActiveMode(m)
    setVal('')
    setError(null)
    setState('idle')
    userHasScrolledUpRef.current = false
  }

  async function requestCorrection(msgIndex: number) {
    const thread = threads[activeMode]
    const target = thread[msgIndex]
    if (!target || target.role !== 'user') return
    if (target.correction?.state === 'ready') {
      const updated = [...thread]
      updated[msgIndex] = { ...target, correction: undefined }
      setThreads(prev => ({ ...prev, [activeMode]: updated }))
      return
    }
    {
      const updated = [...thread]
      updated[msgIndex] = { ...target, correction: { state: 'loading' } }
      setThreads(prev => ({ ...prev, [activeMode]: updated }))
    }
    try {
      const res = await fetch('/api/coach/correct', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ utterance: target.text }),
      })
      const data = await res.json()
      const fresh = threads[activeMode]
      const updated = [...fresh]
      const idx = updated.findIndex(m => m === target)
      const useIdx = idx >= 0 ? idx : msgIndex
      if (!res.ok) {
        updated[useIdx] = { ...target, correction: { state: 'error', text: data.error || 'Erreur' } }
      } else {
        updated[useIdx] = { ...target, correction: { state: 'ready', text: data.correction } }
      }
      setThreads(prev => ({ ...prev, [activeMode]: updated }))
    } catch {
      const fresh = threads[activeMode]
      const updated = [...fresh]
      const useIdx = updated.findIndex(m => m === target)
      const idx = useIdx >= 0 ? useIdx : msgIndex
      updated[idx] = { ...target, correction: { state: 'error', text: 'Réseau indisponible' } }
      setThreads(prev => ({ ...prev, [activeMode]: updated }))
    }
  }

  function redoUtterance(text: string) {
    if (state === 'thinking' || state === 'speaking') return
    setVal(text)
  }

  /** v3.1 — Réécouter l'enregistrement audio d'un message user. */
  function playUserAudio(audioUrl: string) {
    try {
      // Stoppe TTS pour ne pas se chevaucher
      window.speechSynthesis.cancel()
    } catch {}
    const audio = new Audio(audioUrl)
    audio.play().catch(() => {})
  }

  function clearActiveThread() {
    if (!confirm('Effacer le fil de ce mode ?')) return
    setThreads(prev => ({ ...prev, [activeMode]: [] }))
    greetedRef.current[activeMode] = false
  }

  const lastModelMsg = [...messages].reverse().find(m => m.role === 'model')
  const dodoPose = lastModelMsg
    ? (hasCorrection(lastModelMsg.text) ? 'study' : 'happy')
    : 'idle'

  const badge = STATE_BADGE[state]
  const isTuteurMode = activeMode === 'tuteur'
  const isSpeakingPurMode = activeMode === 'speaking_pur'

  return (
    <Container className="max-w-2xl space-y-3 pb-20">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Mascot pose={dodoPose} size={56} animation="breathe" className="shrink-0" />
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold text-primary-900 truncate">Dodo, ton coach</h1>
            <div className="text-[11px] sm:text-xs text-gray-500 truncate">Discute en anglais — chaque mode a son fil</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[11px] px-2.5 py-1 rounded-full font-semibold ${badge.cls}`}>{badge.label}</span>
          <button onClick={() => setVoiceOn(!voiceOn)}
            className={`text-xs px-3 py-1.5 rounded-full font-semibold whitespace-nowrap ${voiceOn ? 'bg-primary-700 text-white' : 'bg-white border border-rule text-gray-600'}`}>
            {voiceOn ? '🔊 Voix' : '🔇 Voix'}
          </button>
        </div>
      </div>

      <Card className="!p-3">
        <div className="text-xs font-bold text-gray-700 mb-2">Comment veux-tu apprendre aujourd&apos;hui ?</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {MODE_TABS.map(t => {
            const isActive = activeMode === t.key
            const count = threads[t.key].length
            return (
              <button key={t.key} onClick={() => switchMode(t.key)}
                className={`relative flex flex-col items-center gap-0.5 p-2 rounded-xl text-center transition ${isActive ? 'bg-primary-700 text-white shadow-sm' : 'bg-white border border-rule hover:border-primary-300'}`}>
                <span className="text-xl leading-none">{t.emoji}</span>
                <span className="text-xs font-bold">{t.label}</span>
                <span className={`text-[10px] leading-tight ${isActive ? 'text-white/80' : 'text-gray-500'}`}>{t.sub}</span>
                {count > 0 && (
                  <span className={`absolute top-1 right-1 text-[9px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/30 text-white' : 'bg-primary-100 text-primary-700'}`}>{count}</span>
                )}
              </button>
            )
          })}
        </div>
        <div className="text-[11px] text-gray-600 px-1 pt-2 italic">
          {activeMode === 'ami' && '💬 Comme avec un pote anglophone : on parle, on rigole, je corrige rarement.'}
          {activeMode === 'auto' && '🎯 Mix idéal : conversation fluide + 1-2 corrections quand c&apos;est utile.'}
          {activeMode === 'tuteur' && '🎓 Mode tuteur : conversation pédagogique. Pas de correction automatique — clique sur 💡 sur tes messages pour en demander une.'}
          {activeMode === 'speaking_pur' && '🎙️ Mode speaking pur : focus prononciation. Parle au micro, ta phrase est comparée à la phrase cible. Réécoute-toi avec ▶️.'}
        </div>
      </Card>

      <button onClick={toggleVoiceConvMode}
        className={`w-full p-3 rounded-2xl border-2 transition-all ${
          voiceConvMode
            ? 'bg-gradient-to-r from-primary-700 to-primary-500 text-white border-primary-700 shadow-lg'
            : 'bg-white border-rule hover:border-primary-300 text-gray-700'
        }`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`text-2xl ${voiceConvMode ? 'animate-pulse' : ''}`}>
              {voiceConvMode ? '🎙️' : '🎤'}
            </div>
            <div className="text-left">
              <div className="font-bold text-sm">
                {voiceConvMode ? 'Conversation vocale ACTIVE' : 'Mode Conversation Vocale'}
              </div>
              <div className={`text-[11px] ${voiceConvMode ? 'text-white/80' : 'text-gray-500'}`}>
                {voiceConvMode
                  ? recording ? '🟢 Je t’écoute… parle' : loading ? '⏳ Dodo réfléchit…' : '🔊 Dodo parle'
                  : 'Active pour parler en continu, mains libres'}
              </div>
            </div>
          </div>
          <div className={`w-11 h-6 rounded-full p-0.5 transition ${voiceConvMode ? 'bg-white/30' : 'bg-gray-200'}`}>
            <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${voiceConvMode ? 'translate-x-5' : ''}`} />
          </div>
        </div>
      </button>

      <Card className="!p-3">
        {/* v3.1 — Hauteur augmentée 60vh → 70vh */}
        <div ref={scrollRef} className="h-[70vh] overflow-y-auto space-y-2 px-1 py-2">
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
            <div key={i} className={`max-w-[85%] ${m.role === 'user' ? 'ml-auto' : 'mr-auto'}`}>
              <div className={`p-3 rounded-2xl text-sm ${m.role === 'user' ? 'bg-primary-700 text-white rounded-br-md' : 'bg-primary-50 text-gray-800 rounded-bl-md'}`}>
                {m.role === 'model' ? (
                  <>
                    <MessageContent text={m.text} />
                    <button onClick={() => speakClean(m.text)} className="block mt-2 text-[10px] opacity-60 hover:opacity-100">🔊 Réécouter</button>
                  </>
                ) : (
                  m.wordScores
                    ? <PronunciationBadge words={m.wordScores} hasTarget={!!m.hasTarget} />
                    : <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
                )}
              </div>

              {/* v3 axe 2 — Bouton 💡 sur messages user en mode tuteur */}
              {m.role === 'user' && isTuteurMode && (
                <div className="mt-1 text-right">
                  <button
                    onClick={() => requestCorrection(i)}
                    disabled={m.correction?.state === 'loading'}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 hover:bg-amber-200">
                    {m.correction?.state === 'loading'  ? '⏳ Correction…'
                     : m.correction?.state === 'ready'  ? '✕ Masquer la correction'
                     : '💡 Voir correction'}
                  </button>
                </div>
              )}
              {m.role === 'user' && m.correction?.state === 'ready' && m.correction.text && (
                <div className="mt-1 text-[12px] bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-2 whitespace-pre-line">
                  {m.correction.text}
                </div>
              )}
              {m.role === 'user' && m.correction?.state === 'error' && (
                <div className="mt-1 text-[11px] text-warn">
                  Correction indisponible — {m.correction.text}
                </div>
              )}

              {/* v3.1 — Boutons spécifiques speaking_pur (Refaire + Réécouter ma voix) */}
              {m.role === 'user' && isSpeakingPurMode && (
                <div className="mt-1 text-right space-x-2">
                  {m.audioUrl && (
                    <button
                      onClick={() => playUserAudio(m.audioUrl!)}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200">
                      ▶️ Réécouter ma voix
                    </button>
                  )}
                  {m.wordScores && (
                    <button
                      onClick={() => redoUtterance(m.text)}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200">
                      🔁 Refaire cette phrase
                    </button>
                  )}
                </div>
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
            disabled={micDisabled || recording}
            placeholder={
              recording ? 'Parle… clique stop quand fini'
              : state === 'speaking' ? 'Le coach parle…'
              : state === 'thinking' ? 'Le coach réfléchit…'
              : 'Tape ou parle…'
            }
            className="flex-1 px-3 py-2 border border-rule rounded-full text-sm disabled:bg-gray-50" />
          {!recording ? (
            <button onClick={startRecording} disabled={micDisabled}
              className={`w-10 h-10 rounded-full bg-primary-50 text-primary-700 text-lg hover:bg-primary-100 disabled:opacity-40 disabled:cursor-not-allowed ${state === 'idle' && !micDisabled ? 'animate-breath' : ''}`}
              title={micDisabled ? 'Indisponible pendant que le coach parle/réfléchit' : 'Parler à Dodo'}>🎤</button>
          ) : (
            <button onClick={stopRecording} className="w-10 h-10 rounded-full bg-warn text-white text-lg animate-pulse" title="Arrêter">■</button>
          )}
          <Button size="sm" onClick={() => send()} disabled={micDisabled || !val.trim()}>Envoyer</Button>
        </div>

        {messages.length > 0 && (
          <div className="pt-2 text-right">
            <button onClick={clearActiveThread} className="text-[10px] text-gray-400 hover:text-warn underline">
              Effacer ce fil
            </button>
          </div>
        )}
      </Card>
    </Container>
  )
}
