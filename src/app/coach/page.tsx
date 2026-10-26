'use client'

import { useEffect, useRef, useState } from 'react'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'
import { speak } from '@/components/games/utils'
import { PronunciationBadge, extractWordScores, type WordScore } from '@/components/coach/PronunciationBadge'
import type { CoachMode } from '@/types/database'

/**
 * v3 — Refonte coach speaking
 *
 * Lot 1 (étanchéité) : un fil de messages PAR mode. Switcher de mode = changer
 *   d'onglet et de fil ; aucun mélange entre Libre / Tuteur / Ami.
 * Lot 2 (anti-boucle) : le micro est explicitement arrêté avant TTS et redémarre
 *   300 ms après la fin du TTS si la voix est ON. speak() expose maintenant
 *   onstart / onend pour cela.
 * Lot 3 (3 états) : machine d'état explicite — 'idle' | 'listening' | 'thinking'
 *   | 'speaking'. Bandeau visible en haut. Mic désactivé pendant 'thinking' et
 *   'speaking'.
 *
 * v3 — 6 axes benchmarkés (sources : ELSA, Praktika, Langua, Babbel, Loora) :
 *  - Axe 1 (ELSA) : surlignage prononciation vert/jaune/rouge → PronunciationBadge
 *      affiché sur les messages utilisateur en mode "speaking_pur".
 *  - Axe 2 (Praktika) : bouton 💡 "Voir correction" sur chaque message utilisateur
 *      en mode Tuteur. PAS de correction automatique. Appelle /api/coach/correct.
 *  - Axe 3 (déjà couvert par Lot 1) : isolation des fils par mode.
 *  - Axe 4 (Babbel) : "breathing cue" — animation pulse-soft sur le bouton micro
 *      à l'état idle (CSS .animate-breath).
 *  - Axe 5 : espace de discussion libre TOUJOURS disponible (onglet "Libre" en
 *      premier, jamais retiré).
 *  - Axe 9 (Pimsleur/ELSA) : mode Coach speaking pur + bouton 🔁 Refaire pour
 *      répéter et comparer le score.
 */

interface Msg {
  role: 'user' | 'model'
  text: string
  /** v3 axe 1 — scores de prononciation par mot (mode speaking_pur uniquement) */
  wordScores?: WordScore[]
  /** v3 axe 2 — correction à la demande pour les messages user en mode Tuteur */
  correction?: { state: 'loading' | 'ready' | 'error'; text?: string }
}

// 'auto' = pas d'override (le serveur choisit selon les goals de l'utilisateur)
type ModeKey = 'auto' | CoachMode
type CoachState = 'idle' | 'listening' | 'thinking' | 'speaking'

// Modes obligatoires v3 (validés avec Raïssa) — toujours présents quels que soient les goals
const MANDATORY_MODES: CoachMode[] = ['professeur', 'speaking_pur']

const MODE_LABELS: Record<CoachMode, string> = {
  conversationnel: '💬 Ami',
  hybride: '🎯 Hybride',
  professeur: '🎓 Tuteur',
  business: '💼 Business',
  guide: '✈️ Guide',
  expert_grc: '🛡️ GRC',
  culturel: '🎉 Culturel',
  speaking_pur: '🎙️ Speaking pur',
}

const STATE_BADGE: Record<CoachState, { label: string; cls: string }> = {
  idle:      { label: '○ Prêt',          cls: 'bg-gray-100 text-gray-600' },
  listening: { label: '🎤 Écoute',       cls: 'bg-blue-100 text-blue-700 animate-pulse' },
  thinking:  { label: '⏳ Réfléchit…',   cls: 'bg-amber-100 text-amber-700' },
  speaking:  { label: '🔊 Parle',         cls: 'bg-emerald-100 text-emerald-700' },
}

declare global {
  interface Window {
    webkitSpeechRecognition?: any
    SpeechRecognition?: any
  }
}

/** v1.3 — Ponctuation basique sur transcripts STT bruts. */
function addBasicPunctuation(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  let out = trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
  const startsWithQuestion = /^(who|what|when|where|why|how|do|does|did|can|could|is|are|am|will|would|should|may|might)\b/i.test(trimmed)
  if (!/[.!?]$/.test(out)) {
    out += startsWithQuestion ? '?' : '.'
  }
  return out
}

export default function CoachPage() {
  // Lot 1 — un fil par mode
  const [threads, setThreads] = useState<Partial<Record<ModeKey, Msg[]>>>({ auto: [] })
  const [activeKey, setActiveKey] = useState<ModeKey>('auto')

  const [val, setVal] = useState('')
  const [activeModes, setActiveModes] = useState<CoachMode[]>([])
  const [voiceName, setVoiceName] = useState<string | null>(null)
  const [voiceOn, setVoiceOn] = useState(true)

  const [state, setState] = useState<CoachState>('idle')
  const [error, setError] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const recRef = useRef<any>(null)
  const ttsActiveRef = useRef(false)
  // v3 axe 1 — pour capter le score de confidence du dernier résultat STT
  const lastConfidenceRef = useRef<number>(0)

  const messages = threads[activeKey] || []

  useEffect(() => {
    (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('user_preferences')
        .select('coach_modes_cached').eq('user_id', user.id).single()
      const userModes = (p?.coach_modes_cached || ['hybride']) as CoachMode[]
      // v3 axe 5 + contraintes Raïssa : on FORCE les 2 modes obligatoires en plus des modes utilisateur
      const merged = Array.from(new Set([...userModes, ...MANDATORY_MODES]))
      setActiveModes(merged)
      setThreads(prev => {
        const next: Partial<Record<ModeKey, Msg[]>> = { ...prev }
        if (!next.auto) next.auto = []
        for (const m of merged) if (!next[m]) next[m] = []
        return next
      })
      const { data: v } = await supabase.from('user_voice_pref')
        .select('voice_name').eq('user_id', user.id).eq('lang_code', 'en-GB').maybeSingle()
      if (v) setVoiceName(v.voice_name)
    })()
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  function stopMic() {
    try { recRef.current?.stop() } catch {}
    recRef.current = null
  }

  function speakSafely(text: string) {
    if (!voiceOn) return
    // v9.117 — Filtrer les réponses vides ou juste points de suspension
    // (le coach répond parfois "..." sur mobile → la voix lit "point de suspension")
    const clean = text.trim()
    if (!clean || /^[\s.…!?]+$/.test(clean)) return
    stopMic()
    ttsActiveRef.current = true
    setState('speaking')
    speak(clean, voiceName, {
      // v9.117 — Le coach parle TOUJOURS en anglais, forcer la voix EN.
      // Avant : si l'utilisateur avait une voix FR en préférence par défaut (iPhone),
      // le coach lisait avec un accent français lourd.
      lang: 'en-GB',
      onstart: () => { ttsActiveRef.current = true; setState('speaking') },
      onend: () => {
        ttsActiveRef.current = false
        window.setTimeout(() => {
          if (!ttsActiveRef.current) setState('idle')
        }, 300)
      },
    } as any)
  }

  /**
   * Envoi d'un message au coach.
   * @param text  contenu (sinon prend la valeur de l'input)
   * @param wordScores  (axe 1) scores de prononciation à attacher au message user
   *                    si on vient du STT en mode speaking_pur.
   */
  async function send(text?: string, wordScores?: WordScore[]) {
    const message = (text ?? val).trim()
    if (!message || state === 'thinking' || state === 'speaking') return
    setError(null)

    const currentKey = activeKey
    const currentThread = threads[currentKey] || []
    const userMsg: Msg = { role: 'user', text: message }
    if (wordScores && wordScores.length) userMsg.wordScores = wordScores
    const next: Msg[] = [...currentThread, userMsg]
    setThreads(prev => ({ ...prev, [currentKey]: next }))
    setVal('')
    stopMic()
    setState('thinking')

    try {
      const res = await fetch('/api/coach', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // L'API attend des objets {role, text} simples ; on retire wordScores et correction.
          messages: next.map(m => ({ role: m.role, text: m.text })),
          mode_override: currentKey === 'auto' ? null : currentKey,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Erreur')
        setState('idle')
        return
      }
      const updated: Msg[] = [...next, { role: 'model', text: data.reply }]
      setThreads(prev => ({ ...prev, [currentKey]: updated }))
      if (voiceOn) speakSafely(data.reply)
      else setState('idle')
    } catch (e: any) {
      setError(e.message || 'Erreur réseau')
      setState('idle')
    }
  }

  function startRecording() {
    if (state === 'thinking' || state === 'speaking') return
    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
    if (!SR) {
      setError('Reconnaissance vocale non disponible sur ce navigateur. Utilise plutôt Chrome.')
      return
    }
    const rec = new SR()
    rec.lang = 'en-GB'
    rec.continuous = false
    rec.interimResults = true
    lastConfidenceRef.current = 0
    rec.onstart = () => setState('listening')
    rec.onerror = (e: any) => {
      setError('Erreur micro : ' + e.error)
      setState('idle')
    }
    rec.onend = () => {
      setState(s => s === 'listening' ? 'idle' : s)
    }
    rec.onresult = (e: any) => {
      let transcript = ''
      let confidence = 0
      for (let i = e.resultIndex; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript
        // En mode non-continu, le dernier résultat porte la confiance globale
        if (typeof e.results[i][0].confidence === 'number') {
          confidence = e.results[i][0].confidence
        }
      }
      if (e.results[e.results.length - 1].isFinal) {
        const punctuated = addBasicPunctuation(transcript)
        // v3 axe 1 — n'attache les scores QU'EN mode speaking_pur (sinon bruit visuel)
        const scores = activeKey === 'speaking_pur'
          ? extractWordScores(punctuated, confidence)
          : undefined
        lastConfidenceRef.current = confidence
        send(punctuated, scores)
      } else {
        setVal(transcript)
      }
    }
    try { rec.start(); recRef.current = rec } catch (err: any) { setError(err.message) }
  }

  function stopRecording() {
    stopMic()
    setState(s => s === 'listening' ? 'idle' : s)
  }

  function switchTo(key: ModeKey) {
    if (key === activeKey) return
    if (state === 'listening') stopMic()
    setActiveKey(key)
    setVal('')
    setThreads(prev => prev[key] ? prev : { ...prev, [key]: [] })
  }

  function clearActiveThread() {
    if (!confirm('Effacer le fil de ce mode ?')) return
    setThreads(prev => ({ ...prev, [activeKey]: [] }))
  }

  /**
   * v3 axe 2 — Demande la correction d'un message user (à la demande, jamais auto).
   * Met à jour le message du fil avec la correction renvoyée.
   */
  async function requestCorrection(msgIndex: number) {
    const thread = threads[activeKey] || []
    const target = thread[msgIndex]
    if (!target || target.role !== 'user') return
    // Si déjà corrigé, on toggle l'affichage en effaçant
    if (target.correction?.state === 'ready') {
      const updated = [...thread]
      updated[msgIndex] = { ...target, correction: undefined }
      setThreads(prev => ({ ...prev, [activeKey]: updated }))
      return
    }
    // Marque "loading"
    {
      const updated = [...thread]
      updated[msgIndex] = { ...target, correction: { state: 'loading' } }
      setThreads(prev => ({ ...prev, [activeKey]: updated }))
    }
    try {
      const res = await fetch('/api/coach/correct', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ utterance: target.text }),
      })
      const data = await res.json()
      const fresh = threads[activeKey] || thread
      const updated = [...fresh]
      // Re-find index by reference (le fil peut avoir bougé entre temps)
      const idx = updated.indexOf(target) >= 0 ? updated.indexOf(target) : msgIndex
      if (!res.ok) {
        updated[idx] = { ...target, correction: { state: 'error', text: data.error || 'Erreur' } }
      } else {
        updated[idx] = { ...target, correction: { state: 'ready', text: data.correction } }
      }
      setThreads(prev => ({ ...prev, [activeKey]: updated }))
    } catch (e: any) {
      const fresh = threads[activeKey] || thread
      const updated = [...fresh]
      const idx = updated.indexOf(target) >= 0 ? updated.indexOf(target) : msgIndex
      updated[idx] = { ...target, correction: { state: 'error', text: 'Réseau indisponible' } }
      setThreads(prev => ({ ...prev, [activeKey]: updated }))
    }
  }

  /** v3 axe 9 — Drill : repropose la même phrase à dire (mode speaking_pur). */
  function redoUtterance(text: string) {
    if (state === 'thinking' || state === 'speaking') return
    setVal(text)
    // L'utilisateur lit la phrase à nouveau au micro pour comparer son score
  }

  const badge = STATE_BADGE[state]
  const micDisabled = state === 'thinking' || state === 'speaking'

  // v3 axe 5 + contraintes : "Libre" toujours en premier, puis modes (avec les 2 obligatoires garantis)
  const tabs: ModeKey[] = ['auto', ...activeModes]

  // Détermine si le mode actif est Tuteur ou Speaking pur (pour boutons spécifiques)
  const isTuteurMode = activeKey === 'professeur'
  const isSpeakingPurMode = activeKey === 'speaking_pur'

  return (
    <Container className="max-w-2xl space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-primary-900">💬 Coach</h1>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] px-2.5 py-1 rounded-full font-semibold ${badge.cls}`}>
            {badge.label}
          </span>
          <button onClick={() => setVoiceOn(!voiceOn)}
            className={`text-xs px-3 py-1.5 rounded-full font-semibold ${voiceOn ? 'bg-primary-700 text-white' : 'bg-white border border-rule text-gray-600'}`}>
            {voiceOn ? '🔊 Voix ON' : '🔇 Voix OFF'}
          </button>
        </div>
      </div>

      <Card className="!p-2">
        <div className="text-[10px] uppercase font-bold text-gray-500 px-2 py-1">
          Modes — chaque onglet a son propre fil de conversation
        </div>
        <div className="flex flex-wrap gap-1 px-1">
          {tabs.map(k => {
            const label = k === 'auto' ? '💬 Libre' : MODE_LABELS[k]
            const count = (threads[k] || []).length
            const isActive = activeKey === k
            const isMandatory = k !== 'auto' && MANDATORY_MODES.includes(k)
            return (
              <button key={k} onClick={() => switchTo(k)}
                className={`text-[11px] px-2.5 py-1 rounded-full ${isActive ? 'bg-primary-700 text-white' : 'bg-white border border-rule text-gray-700'}`}
                title={isMandatory ? 'Mode obligatoire (Tuteur ou Speaking pur)' : undefined}>
                {label}{count > 0 && <span className="ml-1 opacity-70">· {count}</span>}
              </button>
            )
          })}
        </div>
      </Card>

      {/* Sous-titre contextuel selon le mode */}
      {isSpeakingPurMode && (
        <div className="text-[11px] text-emerald-700 bg-emerald-50 px-3 py-2 rounded-md">
          🎙️ <b>Mode Speaking pur</b> — Focus prononciation et fluidité. Pas de correction de grammaire ici. Parle au micro pour voir ton score par mot.
        </div>
      )}
      {isTuteurMode && (
        <div className="text-[11px] text-amber-700 bg-amber-50 px-3 py-2 rounded-md">
          🎓 <b>Mode Tuteur</b> — Révisions, grammaire, contexte pro. Clique sur 💡 sur tes propres messages pour voir une correction ciblée.
        </div>
      )}

      <Card className="!p-3">
        <div ref={scrollRef} className="h-[55vh] overflow-y-auto space-y-2 px-1 py-2">
          {messages.length === 0 && (
            <>
              {/* v9.117 — Vraie bulle d'accueil du coach, lisible en anglais */}
              <div className="max-w-[85%] mr-auto">
                <div className="p-3 rounded-2xl text-sm bg-primary-50 text-gray-800 rounded-bl-md">
                  Hi! 👋 What would you like to practice today?
                  <button onClick={() => speakSafely('Hi! What would you like to practice today?')}
                    className="block mt-1 text-[10px] opacity-60">🔊</button>
                </div>
              </div>
              <div className="text-center text-[11px] text-gray-400 italic pt-4">
                💡 Tape ou clique sur 🎤 pour parler
              </div>
            </>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`max-w-[85%] ${m.role === 'user' ? 'ml-auto' : 'mr-auto'}`}>
              <div className={`p-3 rounded-2xl text-sm ${m.role === 'user' ? 'bg-primary-700 text-white rounded-br-md' : 'bg-primary-50 text-gray-800 rounded-bl-md'}`}>
                {/* Axe 1 — Surlignage prononciation pour les messages user en mode speaking_pur */}
                {m.role === 'user' && m.wordScores
                  ? <PronunciationBadge words={m.wordScores} />
                  : m.text}
                {/* Boutons sous le message coach */}
                {m.role === 'model' && (
                  <button onClick={() => speakSafely(m.text)} className="block mt-1 text-[10px] opacity-60">🔊</button>
                )}
              </div>

              {/* Axe 2 — Bouton 💡 sur messages user en mode Tuteur (à la demande) */}
              {m.role === 'user' && isTuteurMode && (
                <div className="mt-1 text-right">
                  <button
                    onClick={() => requestCorrection(i)}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 hover:bg-amber-200"
                    disabled={m.correction?.state === 'loading'}>
                    {m.correction?.state === 'loading'  ? '⏳ Correction…'
                     : m.correction?.state === 'ready'  ? '✕ Masquer la correction'
                     : '💡 Voir correction'}
                  </button>
                </div>
              )}
              {/* Affichage de la correction en mode Tuteur */}
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

              {/* Axe 9 — Bouton Refaire sur messages user en mode speaking_pur */}
              {m.role === 'user' && isSpeakingPurMode && m.wordScores && (
                <div className="mt-1 text-right">
                  <button
                    onClick={() => redoUtterance(m.text)}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200">
                    🔁 Refaire cette phrase
                  </button>
                </div>
              )}
            </div>
          ))}
          {state === 'thinking' && <div className="text-xs text-gray-400 italic">Le coach réfléchit…</div>}
          {error && <div className="text-xs text-warn p-2 bg-red-50 rounded">{error}</div>}
        </div>

        <div className="flex gap-2 pt-2 border-t border-rule">
          <input value={val} onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            disabled={micDisabled || state === 'listening'}
            placeholder={
              state === 'listening' ? 'Parle… 🎤'
              : state === 'speaking' ? 'Le coach parle…'
              : state === 'thinking' ? 'Le coach réfléchit…'
              : 'Tape ou parle…'
            }
            className="flex-1 px-3 py-2 border border-rule rounded-full text-sm disabled:bg-gray-50" />
          {state !== 'listening' ? (
            <button onClick={startRecording} disabled={micDisabled}
              className={`w-10 h-10 rounded-full bg-primary-50 text-primary-700 text-lg hover:bg-primary-100 disabled:opacity-40 disabled:cursor-not-allowed ${state === 'idle' && !micDisabled ? 'animate-breath' : ''}`}
              title={micDisabled ? 'Indisponible pendant que le coach parle/réfléchit' : 'Parler au coach'}>
              🎤
            </button>
          ) : (
            <button onClick={stopRecording}
              className="w-10 h-10 rounded-full bg-warn text-white text-lg animate-pulse"
              title="Arrêter">
              ■
            </button>
          )}
          <Button size="sm" onClick={() => send()} disabled={micDisabled || !val.trim()}>Envoyer</Button>
        </div>

        {messages.length > 0 && (
          <div className="pt-2 text-right">
            <button onClick={clearActiveThread}
              className="text-xs px-3 py-1.5 rounded-full bg-red-50 text-red-700 hover:bg-red-100 font-semibold">
              🗑️ Nouvelle conversation
            </button>
          </div>
        )}
      </Card>
    </Container>
  )
}
