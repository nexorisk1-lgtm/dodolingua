'use client'
import { useState, useMemo, useEffect, useRef } from 'react'
import { speak, speakSequence, stopSpeaking, TTS_VERSION, recognizeSpeech, type SequenceSegment } from '@/components/games/utils'

/**
 * V6 — Composant unifié pour les 13 types d'étapes du nouveau format grammaire.
 *
 * Règles UX (cf. BRIEF_V6_REFONTE_GRAMMAIRE.md) :
 *  - Clic sur bouton = audio AUTO (pas besoin de bouton 🔊 séparé)
 *  - Code couleur consistant : sujet=bleu, verbe=rouge, complément=vert, contraction=violet
 *  - Pas de saisie texte (tap-to-build pour toute construction)
 *  - Auto-next 700ms après bonne réponse, pas d'auto-next sur erreur
 *  - Pauses 400-2000ms entre segments audio (via speakSequence)
 */

// ============================================================================
// TYPES
// ============================================================================

export type StepTypeV6 =
  | 'intro'             // v6.1 — mini-leçon contextuelle au début
  | 'role_explanation'  // v6.1 — "Comment lire cette phrase ?" avec icônes par rôle
  | 'repeat'            // v7.0 — 🔊 + 🎤 répétition orale (Phase 1)
  | 'dialog'            // v7.0 — Q/R "Are you French? → Yes, I am" (Phase 11)
  | 'validation_final'  // v7.0 — Écran 🎉 Bravo + résumé (Phase 13)
  | 'immersion' | 'discover_text' | 'recognition' | 'pattern' | 'match'
  | 'listen_target' | 'tap_build' | 'gap_fill' | 'variants'
  | 'contractions_intro' | 'contractions_recognition' | 'contractions_build'
  | 'recap_challenge'

export interface ColorToken {
  text: string
  role?: string
  color?: 'blue' | 'red' | 'green' | 'yellow' | 'purple'
  is_gap?: boolean
  emoji?: string       // v6.1 — Mini-icône sous le token (👤 ⚡ 📘)
  meaning_fr?: string  // v6.1 — Sens FR sous le token ("Moi", "être", "français")
}

export interface StepV6 {
  id: string
  position: number
  type: StepTypeV6
  content_json: Record<string, unknown>
}

interface Props {
  step: StepV6
  onContinue: (correct?: boolean) => void
  onBack?: () => void
  isLast: boolean
  canGoBack: boolean
  /** Mode speaking = vitesse 0.8, complet = 0.9 */
  mode?: 'speaking' | 'complete'
  /** v8.9 — Prénom utilisateur pour personnaliser le "Bravo, [prénom]" final */
  userName?: string
}

// ============================================================================
// PALETTE DE COULEURS
// ============================================================================

// v7.0 — Code couleur PASTEL uniquement (reco ChatGPT : doit aider, pas fatiguer A1)
// Bleu pastel = sujet/personne · Rouge pastel = verbe · Vert pastel = info · Violet = contraction · Jaune = auxiliaire
const COLOR_BG: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-900 border-blue-300',
  red: 'bg-red-100 text-red-900 border-red-300',
  green: 'bg-green-100 text-green-900 border-green-300',
  yellow: 'bg-yellow-100 text-yellow-900 border-yellow-300',
  purple: 'bg-purple-100 text-purple-900 border-purple-300',
}

function colorClass(c?: string): string {
  return COLOR_BG[c || ''] || 'bg-gray-100 text-gray-900 border-gray-300'
}

// ============================================================================
// HELPERS
// ============================================================================

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** v8.16 — Détecte si le texte d'une option MCQ est en FR ou EN pour utiliser la
 *  bonne voix TTS. Heuristique : accents FR OU mots FR courants → FR, sinon EN. */
function detectOptionLang(text: string): 'fr-FR' | 'en-GB' {
  if (/[éèêëàâäîïôöùûüçÿœæ]/i.test(text)) return 'fr-FR'
  const words = text.toLowerCase().replace(/[.,!?;:]/g, '').split(/\s+/)
  const frHints = new Set([
    'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles',
    'ca', 'ça', 'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de',
    'et', 'ou', 'mais', 'donc', 'au', 'aux',
    'pour', 'avec', 'sans', 'dans', 'sur', 'sous', 'par',
    'pluriel', 'singulier', 'masculin', 'feminin', 'féminin',
    'garçon', 'garcon', 'fille', 'homme', 'femme', 'objet',
    'qui', 'que', 'quoi', 'quand',
    'est', 'sont', 'suis', 'es', 'sommes', 'etes', 'êtes',
  ])
  if (words.some(w => frHints.has(w))) return 'fr-FR'
  return 'en-GB'
}

/** v8.0 — Rend un texte avec markdown **xxx** en gras (au lieu de l'afficher brut).
 *  Avant v8.0, "Tu viens d'entendre **She's happy**" s'affichait avec les astérisques. */
function MixedText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') && part.length > 4
          ? <strong key={i} className="font-extrabold text-primary-700">{part.slice(2, -2)}</strong>
          : <span key={i}>{part}</span>
      )}
    </span>
  )
}

/** Composant utilitaire : token coloré (chip code couleur) */
function TokenChip({ token, size = 'md' }: { token: ColorToken; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'sm' ? 'px-2 py-1 text-sm' : size === 'lg' ? 'px-4 py-2 text-xl' : 'px-3 py-1.5 text-base'
  if (token.is_gap) {
    return (
      <span className={`inline-block rounded-lg border-2 border-dashed ${sz} bg-white text-gray-400 font-bold tracking-wider`}>
        _____
      </span>
    )
  }
  return (
    <span className={`inline-block rounded-lg border-2 font-bold ${sz} ${colorClass(token.color)}`}>
      {token.text}
    </span>
  )
}

/** Joue automatiquement l'audio d'introduction d'une étape (au mount) */
function useAutoIntro(segments: SequenceSegment[], rate: number) {
  useEffect(() => {
    if (segments.length === 0) return
    const t = setTimeout(() => {
      void speakSequence(segments, rate)
    }, 300)
    return () => {
      clearTimeout(t)
      stopSpeaking()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

/** v7.2 — Joue l'audio puis auto-next 2s après la fin.
 *  Pour les étapes passives (intro, role_explanation, discover_text, pattern,
 *  dialog, contractions_intro) où l'utilisateur n'a pas de choix à faire.
 *  Accessibilité illettrés : pas besoin de comprendre le texte du bouton. */
function useAutoIntroWithAutoNext(segments: SequenceSegment[], rate: number, onContinue: () => void) {
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (segments.length > 0) await speakSequence(segments, rate)
      if (!cancelled) {
        setTimeout(() => { if (!cancelled) onContinue() }, 2000)
      }
    }
    const t = setTimeout(() => void run(), 300)
    return () => { cancelled = true; clearTimeout(t); stopSpeaking() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

// ============================================================================
// HEADER GÉNÉRIQUE (icône + label + bouton replay)
// ============================================================================

function StepHeader({ icon, label, onReplay }: { icon: string; label: string; onReplay?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="text-xs uppercase font-bold text-primary-500 tracking-wider flex items-center gap-2">
        <span className="text-base">{icon}</span> {label}
      </div>
      {onReplay && (
        <button onClick={onReplay} aria-label="Réécouter"
          className="w-9 h-9 rounded-full bg-primary-50 text-primary-700 hover:bg-primary-100 text-base">
          🔊
        </button>
      )}
    </div>
  )
}

// ============================================================================
// 0. INTRO — mini-leçon contextuelle (v6.1)
// "Pour dire qui on est, on utilise le verbe to be" + règle infinitif
// ============================================================================

function StepIntro({ step, onContinue, rate }: { step: StepV6; onContinue: () => void; rate: number }) {
  const c = step.content_json as {
    audio_intro?: string;
    title_fr?: string;
    rules?: { icon: string; text_fr: string; examples_en?: string[]; examples_fr?: string[] }[];
  }
  const rules = c.rules || []

  // v8.11 — Affichage progressif des rules : chaque ligne apparaît quand sa partie
  // audio commence à être lue. Estimation : ~80ms par caractère + pause après segment.
  const [visibleCount, setVisibleCount] = useState(0)

  const segments: SequenceSegment[] = useMemo(() => {
    const segs: SequenceSegment[] = []
    if (c.audio_intro) segs.push({ text: c.audio_intro, lang: 'fr-FR', pauseAfter: 1500 })
    rules.forEach((r) => {
      segs.push({ text: r.text_fr, lang: 'fr-FR', pauseAfter: 1000 })
    })
    return segs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useAutoIntroWithAutoNext(segments, rate, onContinue)

  // v8.11 — Timers d'affichage : chaque rule apparaît quand sa partie audio démarre
  useEffect(() => {
    setVisibleCount(0)
    let elapsed = 300 // délai initial avant le 1er speakSequence (voir useAutoIntro)
    // Durée approximative du audio_intro (pause incluse)
    const introDuration = c.audio_intro ? (c.audio_intro.length * 100) + 1500 : 0
    elapsed += introDuration
    const timers: ReturnType<typeof setTimeout>[] = []
    rules.forEach((r, idx) => {
      const showAt = elapsed
      timers.push(setTimeout(() => {
        setVisibleCount(prev => Math.max(prev, idx + 1))
      }, showAt))
      // Durée estimée du segment rule = nb caractères * 70ms + pause 1000ms
      elapsed += (r.text_fr.length * 100) + 1000
    })
    return () => timers.forEach(t => clearTimeout(t))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Bouton replay : reset l'affichage et relance audio + timers
  const replay = () => {
    setVisibleCount(0)
    void speakSequence(segments, rate)
    let elapsed = 100
    const introDuration = c.audio_intro ? (c.audio_intro.length * 100) + 1500 : 0
    elapsed += introDuration
    rules.forEach((r, idx) => {
      const showAt = elapsed
      setTimeout(() => setVisibleCount(prev => Math.max(prev, idx + 1)), showAt)
      elapsed += (r.text_fr.length * 100) + 1000
    })
  }

  return (
    <div className="space-y-5">
      <StepHeader icon="📚" label="Pour commencer" onReplay={replay} />
      {c.title_fr && (
        <h2 className="text-2xl font-extrabold text-primary-900 text-center">{c.title_fr}</h2>
      )}
      <div className="space-y-3">
        {rules.slice(0, visibleCount).map((r, i) => (
          <div key={i} className="bg-blue-50 border-l-4 border-primary-500 p-4 rounded-r-lg animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex items-start gap-3">
              <span className="text-3xl">{r.icon}</span>
              <div className="flex-1 space-y-2">
                <div className="text-lg font-semibold text-primary-900 leading-snug">
                  {r.text_fr.split(/(\*\*[^*]+\*\*)/).map((part, j) =>
                    part.startsWith('**') && part.endsWith('**')
                      ? <strong key={j} className="text-primary-700 font-extrabold">{part.slice(2, -2)}</strong>
                      : <span key={j}>{part}</span>
                  )}
                </div>
                {/* v6.1 — Si examples_fr est fourni, on appaire EN ↔ FR (ex: to be → être) */}
                {r.examples_en && r.examples_en.length > 0 && r.examples_fr && r.examples_fr.length === r.examples_en.length && (
                  <div className="grid grid-cols-1 gap-1.5 pt-1">
                    {r.examples_en.map((ex, k) => (
                      <button key={k} onClick={() => speak(ex)}
                        className="px-3 py-2 rounded-lg bg-white border-2 border-red-300 hover:bg-red-50 flex items-center gap-2 text-left">
                        <span className="text-red-500">🔊</span>
                        <span className="font-extrabold text-red-700">{ex}</span>
                        <span className="text-gray-400">→</span>
                        <span className="font-semibold text-gray-700">{r.examples_fr![k]}</span>
                      </button>
                    ))}
                  </div>
                )}
                {/* Sinon : juste les exemples EN en chips */}
                {r.examples_en && r.examples_en.length > 0 && !r.examples_fr && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {r.examples_en.map((ex, k) => (
                      <button key={k} onClick={() => speak(ex)}
                        className="px-3 py-1.5 rounded-lg bg-white border-2 border-red-300 text-red-700 font-bold hover:bg-red-50 flex items-center gap-1.5">
                        🔊 {ex}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <button onClick={onContinue}
        className="w-full p-4 bg-primary-700 text-white rounded-xl font-bold hover:bg-primary-900 text-xl flex items-center justify-center gap-2">
        Suivant <span className="text-2xl">→</span>
      </button>
    </div>
  )
}

// ============================================================================
// 0bis. ROLE_EXPLANATION — "Comment lire cette phrase ?" avec icônes par rôle
// ============================================================================

function StepRoleExplanation({ step, onContinue, rate }: { step: StepV6; onContinue: () => void; rate: number }) {
  const c = step.content_json as {
    audio_intro?: string;
    title_fr?: string;
    code_color_legend?: { color: string; label: string; emoji: string }[];
    tokens_with_role?: { text: string; color: string; role_fr: string; meaning_fr: string; emoji: string }[];
    audio_full?: string;
    audio_full_fr?: string;
  }
  const tokens = c.tokens_with_role || []
  const legend = c.code_color_legend || []

  const segments: SequenceSegment[] = useMemo(() => {
    const segs: SequenceSegment[] = []
    if (c.audio_intro) segs.push({ text: c.audio_intro, lang: 'fr-FR', pauseAfter: 1200 })
    tokens.forEach(t => {
      segs.push({ text: `${t.text}, ${t.role_fr}, ${t.meaning_fr}`, lang: 'fr-FR', pauseAfter: 800 })
    })
    if (c.audio_full) segs.push({ text: c.audio_full, lang: 'en-GB', pauseAfter: 600 })
    if (c.audio_full_fr) segs.push({ text: c.audio_full_fr, lang: 'fr-FR' })
    return segs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // v7.2 — Auto-next : étape passive
  useAutoIntroWithAutoNext(segments, rate, onContinue)
  const replay = () => void speakSequence(segments, rate)

  return (
    <div className="space-y-5">
      <StepHeader icon="🔍" label="Lecture guidée" onReplay={replay} />
      {c.title_fr && (
        <h2 className="text-xl font-extrabold text-primary-900 text-center">{c.title_fr}</h2>
      )}

      {/* Phrase complète tout en haut */}
      {c.audio_full && (
        <button onClick={() => speak(c.audio_full!)}
          className="w-full bg-gray-50 rounded-xl p-3 text-center hover:bg-gray-100">
          <div className="text-2xl font-extrabold text-primary-900">🔊 {c.audio_full}</div>
          {c.audio_full_fr && <div className="text-sm italic text-gray-600 mt-1">→ {c.audio_full_fr}</div>}
        </button>
      )}

      {/* Décomposition mot par mot avec rôle + sens FR */}
      <div className="space-y-2">
        {tokens.map((t, i) => (
          <button key={i} onClick={() => speak(t.text)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 hover:scale-[1.02] transition-transform ${colorClass(t.color as 'blue' | 'red' | 'green')}`}>
            <span className="text-2xl">{t.emoji}</span>
            <div className="flex-1 text-left">
              <div className="text-2xl font-extrabold">{t.text}</div>
              <div className="text-xs font-medium opacity-80">{t.role_fr} → <span className="font-bold">{t.meaning_fr}</span></div>
            </div>
            <span className="text-base">🔊</span>
          </button>
        ))}
      </div>

      {/* Légende code couleur */}
      {legend.length > 0 && (
        <div className="bg-gray-50 rounded-xl p-3">
          <div className="text-[11px] uppercase font-bold text-gray-500 tracking-wide mb-2 text-center">Le code couleur</div>
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
            {legend.map((l, i) => (
              <span key={i} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg font-bold ${colorClass(l.color)}`}>
                {l.emoji} {l.label}
              </span>
            ))}
          </div>
        </div>
      )}

      <button onClick={onContinue}
        className="w-full p-4 bg-primary-700 text-white rounded-xl font-bold hover:bg-primary-900 text-lg">
        Suivant →
      </button>
    </div>
  )
}

// ============================================================================
// 0ter. REPEAT — répétition orale (v7.0)
// 🔊 lit la phrase, l'utilisateur la répète après. Pas d'évaluation stricte.
// ============================================================================

function StepRepeat({ step, onContinue, rate }: { step: StepV6; onContinue: () => void; rate: number }) {
  const c = step.content_json as {
    audio_intro?: string;
    audio_full?: string;
    audio_fr?: string;
    media?: { emoji?: string };
  }

  // v7.5 — Refonte UX : gros bouton micro central + écouter séparé + guide vocal + feedback 3 essais
  const [recording, setRecording] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [lastResult, setLastResult] = useState<{ transcript: string; similarity: number; unsupported?: boolean } | null>(null)
  // v8.9 — Capture audio de la voix utilisateur pour permettre la réécoute
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const MAX_ATTEMPTS = 3
  const SUCCESS_THRESHOLD = 0.7  // v8.9 — abaissé de 0.75 à 0.7 (plus tolérant)

  // v8.5 — Intro vocale enrichie : intro + modèle EN + "veut dire" + traduction FR.
  // Avant v8.5, on entendait "I am" immédiatement suivi de "Je suis" sans transition,
  // ce qui était bizarre. Ajout d'un segment "veut dire" entre les deux pour
  // clarifier le lien sémantique (et la voix FR Thomas prend le relais naturellement).
  const segments: SequenceSegment[] = useMemo(() => {
    const segs: SequenceSegment[] = []
    if (c.audio_intro) segs.push({ text: c.audio_intro, lang: 'fr-FR', pauseAfter: 1200 })
    if (c.audio_full) segs.push({ text: c.audio_full, lang: 'en-GB', pauseAfter: 400 })
    if (c.audio_full && c.audio_fr) segs.push({ text: 'veut dire', lang: 'fr-FR', pauseAfter: 250 })
    if (c.audio_fr) segs.push({ text: c.audio_fr, lang: 'fr-FR', pauseAfter: 1000 })
    segs.push({ text: 'À toi de parler. Appuie sur le bouton pour parler.', lang: 'fr-FR', pauseAfter: 0 })
    return segs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useAutoIntro(segments, rate)
  const replayModel = () => c.audio_full && speak(c.audio_full)

  async function startRecording() {
    if (!c.audio_full || recording) return
    // v8.10 — Stop immédiat du TTS quand l'utilisateur clique sur le micro.
    // Avant, la voix continuait à parler ("À toi de parler...") et il fallait
    // attendre la fin avant que l'enregistrement démarre vraiment.
    stopSpeaking()
    setRecording(true)
    setLastResult(null)
    setRecordedBlob(null)
    // v8.9 — Capture audio en parallèle pour permettre la réécoute de sa voix
    audioChunksRef.current = []
    let stream: MediaStream | null = null
    try {
      // v8.10 — Contraintes audio Chrome : réduction de bruit + écho + AGC.
      // Filtre la TV, les parasites ambiants, réduit l'écho des haut-parleurs Mac.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true,
        }
      })
      const mr = new MediaRecorder(stream)
      mediaRecorderRef.current = mr
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.onstop = () => {
        if (audioChunksRef.current.length > 0) {
          const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || 'audio/webm' })
          setRecordedBlob(blob)
        }
        stream?.getTracks().forEach(t => t.stop())
      }
      mr.start()
    } catch {
      // Si on ne peut pas capturer (permission, navigateur), on continue sans replay
      stream?.getTracks().forEach(t => t.stop())
    }
    // v8.0 — Timeout de sécurité 8s : si le micro ne reçoit rien (silencieux,
    // pas de permission, etc.), on ne reste pas bloqué indéfiniment.
    let timedOut = false
    const safetyTimeout = setTimeout(() => {
      timedOut = true
      setRecording(false)
      try { mediaRecorderRef.current?.stop() } catch {}
      void speakSequence([{ text: 'Je n\'ai rien entendu. Appuie à nouveau ou continue.', lang: 'fr-FR' }], rate)
    }, 8000)
    try {
      const result = await recognizeSpeech(c.audio_full, 'en-US')
      // v8.9 — Stop le MediaRecorder à la fin de la reconnaissance pour finaliser le blob
      try { mediaRecorderRef.current?.stop() } catch {}
      clearTimeout(safetyTimeout)
      if (timedOut) return
      setLastResult(result)
      const nextAttempt = attempt + 1
      setAttempt(nextAttempt)
      if (result.unsupported) return
      const success = result.similarity >= SUCCESS_THRESHOLD
      // v8.12 — Feedback vocal : on AWAIT la fin du speakSequence avant onContinue
      // pour ne plus couper "Bravo, tu as bien dit !" en cours de phrase.
      if (success) {
        await speakSequence([{ text: 'Bravo, tu as bien dit !', lang: 'fr-FR' }], rate)
        setTimeout(() => onContinue(), 600)
      } else if (nextAttempt < MAX_ATTEMPTS) {
        const msg = nextAttempt === 1
          ? 'Essaye encore une fois.'
          : 'Dernière fois, écoute bien le modèle.'
        void speakSequence([
          { text: msg, lang: 'fr-FR', pauseAfter: 600 },
          ...(c.audio_full ? [{ text: c.audio_full, lang: 'en-GB' as const }] : []),
        ], rate)
      } else {
        // v8.12 — 3e échec : on AWAIT aussi pour que "On reverra ça plus tard" soit complet
        await speakSequence([{ text: 'On reverra ça plus tard. On continue.', lang: 'fr-FR' }], rate)
        setTimeout(() => onContinue(), 600)
      }
    } finally {
      clearTimeout(safetyTimeout)
      if (!timedOut) setRecording(false)
    }
  }

  const isSuccess = lastResult && !lastResult.unsupported && lastResult.similarity >= SUCCESS_THRESHOLD
  const isFail = lastResult && !lastResult.unsupported && lastResult.similarity < SUCCESS_THRESHOLD
  const exhausted = attempt >= MAX_ATTEMPTS
  const remaining = Math.max(0, MAX_ATTEMPTS - attempt)

  return (
    <div className="space-y-5">
      <StepHeader icon="🎤" label="Répète à voix haute" />

      {/* Emoji contextuel */}
      {c.media?.emoji && <div className="text-center text-5xl">{c.media.emoji}</div>}

      {/* Modèle à imiter — bouton dédié "Écouter le modèle" */}
      {c.audio_full && (
        <button onClick={replayModel}
          className="w-full bg-primary-50 hover:bg-primary-100 active:bg-primary-200 rounded-2xl p-5 transition-colors border-2 border-primary-200">
          <div className="flex items-center justify-center gap-3 mb-2">
            <span className="text-4xl">🔊</span>
            <span className="text-sm font-bold uppercase text-primary-700 tracking-wider">Écouter le modèle</span>
          </div>
          <div className="text-2xl font-extrabold text-primary-900 leading-tight">{c.audio_full}</div>
          {c.audio_fr && <div className="text-sm italic text-gray-600 mt-1">→ {c.audio_fr}</div>}
        </button>
      )}

      {/* Compteur d'essais */}
      {attempt > 0 && !isSuccess && !exhausted && (
        <div className="text-center text-sm font-semibold text-gray-600">
          Essai {attempt} sur {MAX_ATTEMPTS} · il te reste {remaining} essai{remaining > 1 ? 's' : ''}
        </div>
      )}

      {/* GROS BOUTON MICRO CENTRAL */}
      <div className="flex flex-col items-center gap-3 py-2">
        <button
          onClick={startRecording}
          disabled={recording || !!isSuccess || exhausted}
          aria-label="Appuie pour parler"
          className={`w-36 h-36 rounded-full flex items-center justify-center text-6xl shadow-lg transition-all ${
            recording ? 'bg-red-500 text-white animate-pulse scale-110' :
            isSuccess ? 'bg-green-500 text-white' :
            exhausted ? 'bg-gray-300 text-gray-500' :
            'bg-amber-400 hover:bg-amber-500 active:scale-95 text-amber-950'
          }`}>
          {recording ? '🎙️' : isSuccess ? '✓' : exhausted ? '⏭️' : '🎤'}
        </button>
        <div className={`text-lg font-bold ${
          recording ? 'text-red-600' :
          isSuccess ? 'text-green-700' :
          exhausted ? 'text-gray-500' :
          'text-amber-800'
        }`}>
          {recording ? 'Je t’écoute…' :
           isSuccess ? 'Bravo !' :
           exhausted ? 'On reverra ça plus tard' :
           attempt === 0 ? 'Appuie pour parler' : 'Réessaye'}
        </div>
      </div>

      {/* Feedback résultat */}
      {lastResult?.unsupported && (
        <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded-r-lg text-sm">
          🎧 Ton navigateur ne supporte pas l&apos;enregistrement. Sur Chrome ou Edge, tu pourras répéter et obtenir un score.
        </div>
      )}
      {lastResult && !lastResult.unsupported && (
        <div className={`border-l-4 p-3 rounded-r-lg ${isSuccess ? 'border-green-500 bg-green-50' : 'border-amber-400 bg-amber-50'}`}>
          <div className="text-xs uppercase font-bold text-gray-500 mb-1">Ce que j&apos;ai entendu :</div>
          <div className="text-lg font-bold text-gray-900">{lastResult.transcript || '(rien entendu)'}</div>
          <div className="text-sm mt-1">
            Score : <span className={`font-bold ${isSuccess ? 'text-green-700' : 'text-amber-700'}`}>{Math.round(lastResult.similarity * 100)}%</span>
          </div>
          {/* v8.9 — Bouton pour réécouter sa propre voix (si capture audio dispo) */}
          {recordedBlob && (
            <button onClick={() => {
              const url = URL.createObjectURL(recordedBlob)
              const audio = new Audio(url)
              audio.play().catch(() => {})
              audio.onended = () => URL.revokeObjectURL(url)
            }}
              className="mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border-2 border-primary-300 text-primary-700 font-bold hover:bg-primary-50 text-sm">
              🎧 Écouter ma voix
            </button>
          )}
          {isFail && !exhausted && (
            <div className="text-xs text-gray-600 mt-2">Réécoute le modèle, puis réessaye.</div>
          )}
        </div>
      )}

      {/* v8.4 — Bouton "Continuer" TOUJOURS visible quand pas en succès.
          Avant v8.4, il fallait avoir essayé au moins 1 fois pour le voir.
          Problème : si le micro ne capte rien (silence, bruit ambiant, micro défaillant),
          l'utilisateur restait bloqué sans pouvoir avancer. */}
      {!isSuccess && (
        <button onClick={onContinue}
          className="w-full p-3 bg-white border-2 border-primary-300 text-primary-700 rounded-xl font-bold hover:bg-primary-50">
          → Continuer sans répéter
        </button>
      )}
    </div>
  )
}

// ============================================================================
// 0quater. DIALOG — mini-dialogue Q/R (v7.0)
// 🔊 Q + 🟩 R + traduction. Pas d'exo, juste écoute du pattern conversationnel.
// ============================================================================

function StepDialog({ step, onContinue, rate }: { step: StepV6; onContinue: () => void; rate: number }) {
  const c = step.content_json as {
    audio_intro?: string;
    question_en?: string;
    answer_tokens?: ColorToken[];
    answer_fr?: string;
    answer_en_full?: string;
    // v8.5 — Réponse négative optionnelle
    answer_neg_en_full?: string;
    answer_neg_fr?: string;
    answer_neg_tokens?: ColorToken[];
  }
  const answerTokens = c.answer_tokens || []
  const answerFull = c.answer_en_full || answerTokens.map(t => t.text).join(' ')
  const answerNegTokens = c.answer_neg_tokens || []
  const answerNegFull = c.answer_neg_en_full || answerNegTokens.map(t => t.text).join(' ')

  const segments: SequenceSegment[] = useMemo(() => {
    const segs: SequenceSegment[] = []
    if (c.audio_intro) segs.push({ text: c.audio_intro, lang: 'fr-FR', pauseAfter: 1000 })
    if (c.question_en) segs.push({ text: c.question_en, lang: 'en-GB', pauseAfter: 1000 })
    if (answerFull) segs.push({ text: answerFull, lang: 'en-GB', pauseAfter: 400 })
    if (c.answer_fr) segs.push({ text: c.answer_fr, lang: 'fr-FR', pauseAfter: 800 })
    // v8.5 — Si réponse négative présente, on la joue aussi
    if (answerNegFull) {
      segs.push({ text: 'ou bien :', lang: 'fr-FR', pauseAfter: 300 })
      segs.push({ text: answerNegFull, lang: 'en-GB', pauseAfter: 400 })
      if (c.answer_neg_fr) segs.push({ text: c.answer_neg_fr, lang: 'fr-FR' })
    }
    return segs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // v7.2 — Auto-next : dialog est passif (juste écoute Q/R)
  useAutoIntroWithAutoNext(segments, rate, onContinue)
  const replay = () => void speakSequence(segments, rate)

  return (
    <div className="space-y-5">
      <StepHeader icon="💬" label="Mini-dialogue" onReplay={replay} />

      {/* Question */}
      {c.question_en && (
        <button onClick={() => speak(c.question_en!)}
          className="w-full bg-gray-50 hover:bg-gray-100 rounded-xl p-4 text-left transition-colors">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔊</span>
            <div className="flex-1">
              <div className="text-xs uppercase font-bold text-gray-500 tracking-wide">Question</div>
              <div className="text-xl font-bold text-primary-900 mt-1">{c.question_en}</div>
            </div>
          </div>
        </button>
      )}

      {/* Réponse positive avec tokens colorés */}
      {answerTokens.length > 0 && (
        <button onClick={() => speak(answerFull)}
          className="w-full bg-green-50 hover:bg-green-100 rounded-xl p-4 text-left transition-colors border-2 border-green-200">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔊</span>
            <div className="flex-1">
              <div className="text-xs uppercase font-bold text-green-700 tracking-wide">Réponse positive</div>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {answerTokens.map((t, i) => <TokenChip key={i} token={t} />)}
              </div>
              {c.answer_fr && <div className="text-sm italic text-gray-700 mt-2">→ {c.answer_fr}</div>}
            </div>
          </div>
        </button>
      )}

      {/* v8.5 — Réponse négative (optionnelle, affichée si présente en BDD) */}
      {(answerNegTokens.length > 0 || answerNegFull) && (
        <button onClick={() => speak(answerNegFull)}
          className="w-full bg-red-50 hover:bg-red-100 rounded-xl p-4 text-left transition-colors border-2 border-red-200">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔊</span>
            <div className="flex-1">
              <div className="text-xs uppercase font-bold text-red-700 tracking-wide">Ou bien (réponse négative)</div>
              {answerNegTokens.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {answerNegTokens.map((t, i) => <TokenChip key={i} token={t} />)}
                </div>
              ) : (
                <div className="text-xl font-bold text-red-900 mt-2">{answerNegFull}</div>
              )}
              {c.answer_neg_fr && <div className="text-sm italic text-gray-700 mt-2">→ {c.answer_neg_fr}</div>}
            </div>
          </div>
        </button>
      )}

      <button onClick={onContinue}
        className="w-full p-4 bg-primary-700 text-white rounded-xl font-bold hover:bg-primary-900 text-xl flex items-center justify-center gap-2">
        Suivant <span className="text-2xl">→</span>
      </button>
    </div>
  )
}

// ============================================================================
// 0quinquies. VALIDATION_FINAL — écran 🎉 Bravo + résumé (v7.0)
// ============================================================================

function StepValidationFinal({ step, onContinue, rate, userName }: { step: StepV6; onContinue: () => void; rate: number; userName?: string }) {
  const c = step.content_json as {
    audio_intro?: string;
    title_fr?: string;
    achievements?: string[];
    next_step_fr?: string;
  }
  const items = c.achievements || []
  // v8.9 — Personnalisation : "Bravo, [prénom] !" si userName fourni
  const firstName = userName?.trim().split(/\s+/)[0] || ''
  const bravoText = firstName ? `Bravo, ${firstName} !` : (c.title_fr || 'Bravo !')

  const segments: SequenceSegment[] = useMemo(() => {
    const segs: SequenceSegment[] = []
    // v8.9 — Si on a un prénom, on l'intègre à l'audio final
    if (firstName) {
      segs.push({ text: `Bravo ${firstName}, tu as terminé ta première leçon. Tu sais maintenant dire qui tu es en anglais.`, lang: 'fr-FR' })
    } else if (c.audio_intro) {
      segs.push({ text: c.audio_intro, lang: 'fr-FR' })
    }
    return segs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstName])
  useAutoIntro(segments, rate)

  return (
    <div className="space-y-5 text-center">
      {/* v8.1 — Mascotte Dodo champion (avec coupe d'or) pour fin de leçon */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/dodo-champion.png" alt="Dodo champion" className="w-48 h-48 mx-auto object-contain" />
      <h2 className="text-2xl font-extrabold text-primary-900">
        {bravoText}
      </h2>
      {!firstName && <div className="text-base text-gray-600">— Dodo</div>}
      {items.length > 0 && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg text-left">
          <div className="text-sm uppercase font-bold text-green-700 tracking-wide mb-2">Tu sais maintenant :</div>
          <ul className="space-y-2">
            {items.map((it, i) => (
              <li key={i} className="flex items-start gap-2 text-base font-semibold text-gray-900">
                <span className="text-green-600">✓</span>
                <span>{it}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {/* v8.4 — Retrait de next_step_fr du rendu : la grammaire fait partie d'un parcours
          (vocabulaire suit la grammaire), donc on ne sait pas quelle sera "la prochaine leçon".
          Le parcours est géré au niveau supérieur. */}
      <button onClick={onContinue}
        className="w-full p-4 bg-primary-700 text-white rounded-xl font-bold hover:bg-primary-900 text-lg">
        Terminer la leçon →
      </button>
    </div>
  )
}

// ============================================================================
// 1. IMMERSION — écoute simple
// ============================================================================

function StepImmersion({ step, onContinue, rate }: { step: StepV6; onContinue: () => void; rate: number }) {
  const c = step.content_json as { audio_intro?: string; audio_full?: string; audio_fr?: string; media?: { emoji?: string } }
  const segments: SequenceSegment[] = useMemo(() => [
    ...(c.audio_intro ? [{ text: c.audio_intro, lang: 'fr-FR' as const, pauseAfter: 1500 }] : []),
    ...(c.audio_full ? [{ text: c.audio_full, lang: 'en-GB' as const, pauseAfter: 1000 }] : []),
    ...(c.audio_fr ? [{ text: c.audio_fr, lang: 'fr-FR' as const }] : []),
  ], [c.audio_intro, c.audio_full, c.audio_fr])

  // v7.1 — Auto-next 2 secondes après la fin de l'audio (accessibilité illettrés)
  // L'utilisateur peut aussi cliquer le bouton pour passer plus vite.
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      await speakSequence(segments, rate)
      if (!cancelled) {
        setTimeout(() => { if (!cancelled) onContinue() }, 2000)
      }
    }
    const t = setTimeout(() => void run(), 300)
    return () => { cancelled = true; clearTimeout(t); stopSpeaking() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const replay = () => void speakSequence(segments, rate)

  return (
    <div className="space-y-6">
      <StepHeader icon="👂" label="Écoute" onReplay={replay} />
      <div className="text-center py-8 space-y-4">
        {c.media?.emoji && <div className="text-7xl">{c.media.emoji}</div>}
        {c.audio_full && (
          <div className="text-3xl font-extrabold text-primary-900">{c.audio_full}</div>
        )}
        {c.audio_fr && (
          <div className="text-base italic text-gray-600">→ {c.audio_fr}</div>
        )}
      </div>
      <button onClick={onContinue}
        className="w-full p-4 bg-primary-700 text-white rounded-xl font-semibold hover:bg-primary-900 text-lg">
        Suivant →
      </button>
    </div>
  )
}

// ============================================================================
// 2. DISCOVER_TEXT — phrase tokenisée avec code couleur
// ============================================================================

function StepDiscoverText({ step, onContinue, rate }: { step: StepV6; onContinue: () => void; rate: number }) {
  const c = step.content_json as { audio_intro?: string; tokens?: ColorToken[]; audio_fr?: string; media?: { emoji?: string } }
  const tokens = c.tokens || []

  const segments: SequenceSegment[] = useMemo(() => {
    const segs: SequenceSegment[] = []
    if (c.audio_intro) segs.push({ text: c.audio_intro, lang: 'fr-FR', pauseAfter: 1200 })
    tokens.forEach(t => segs.push({ text: t.text, lang: 'en-GB', pauseAfter: 600 }))
    if (c.audio_fr) segs.push({ text: c.audio_fr, lang: 'fr-FR' })
    return segs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // v7.2 — Auto-next : discover_text est passif (visualisation tokens)
  useAutoIntroWithAutoNext(segments, rate, onContinue)
  const replay = () => void speakSequence(segments, rate)

  return (
    <div className="space-y-6">
      <StepHeader icon="🎨" label="Découverte" onReplay={replay} />
      <div className="text-center space-y-4 py-4">
        {c.media?.emoji && <div className="text-5xl">{c.media.emoji}</div>}
        {/* v6.1 — Tokens avec emoji + meaning_fr en dessous (ancrage cognitif renforcé) */}
        <div className="flex flex-wrap items-end justify-center gap-2">
          {tokens.map((t, i) => (
            <button
              key={i}
              onClick={() => speak(t.text)}
              className={`flex flex-col items-center gap-1 rounded-lg border-2 font-bold px-3 py-2 hover:scale-105 transition-transform ${colorClass(t.color)}`}>
              <span className="text-2xl">{t.text}</span>
              {(t.emoji || t.meaning_fr) && (
                <span className="text-[11px] font-medium opacity-90 leading-none">
                  {t.emoji && <span className="text-base mr-1">{t.emoji}</span>}
                  {t.meaning_fr}
                </span>
              )}
            </button>
          ))}
        </div>
        {c.audio_fr && <div className="text-base italic text-gray-600">→ {c.audio_fr}</div>}
        <div className="text-xs text-gray-400">Tape sur un mot pour l&apos;écouter</div>
      </div>
      <button onClick={onContinue}
        className="w-full p-4 bg-primary-700 text-white rounded-xl font-semibold hover:bg-primary-900 text-lg">
        Suivant →
      </button>
    </div>
  )
}

// ============================================================================
// 3. RECOGNITION — MCQ avec clic = audio auto
// ============================================================================

function StepRecognition({
  step, onContinue, rate,
}: { step: StepV6; onContinue: (correct: boolean) => void; rate: number }) {
  const c = step.content_json as {
    audio_intro?: string; question_fr?: string; audio_full?: string;
    options?: { text: string; correct: boolean }[];
    media?: { emoji?: string };
  }
  const options = c.options || []
  const [picked, setPicked] = useState<number | null>(null)
  const [shown, setShown] = useState<'idle' | 'wrong'>('idle')

  // v6.1 — Audio auto au mount : intro + question FR + audio EN cible (la bonne phrase)
  // L'utilisateur entend la phrase EN avant de choisir → entraîne le lien audio↔structure↔sens
  const segments: SequenceSegment[] = useMemo(() => {
    const segs: SequenceSegment[] = []
    if (c.audio_intro) segs.push({ text: c.audio_intro, lang: 'fr-FR', pauseAfter: 1200 })
    if (c.question_fr) segs.push({ text: c.question_fr, lang: 'fr-FR', pauseAfter: 800 })
    if (c.audio_full) segs.push({ text: c.audio_full, lang: 'en-GB' })
    return segs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useAutoIntro(segments, rate)
  const replay = () => void speakSequence(segments, rate)

  function pick(idx: number) {
    if (picked !== null && options[picked].correct) return // déjà gagné, ignore
    setPicked(idx)
    // v8.16 — Détection auto de la langue de l'option pour utiliser la bonne voix.
    // Avant v8.16, speak() utilisait toujours la voix anglaise (défaut) → "Je",
    // "Tu", "Ils ou elles" étaient lus par Daniel avec un accent affreux.
    speak(options[idx].text, null, { lang: detectOptionLang(options[idx].text) })
    if (options[idx].correct) {
      setTimeout(() => onContinue(true), 900)
    } else {
      setShown('wrong')
      setTimeout(() => { setPicked(null); setShown('idle') }, 1200)
    }
  }

  return (
    <div className="space-y-5">
      <StepHeader icon="🎯" label="Reconnaissance" onReplay={replay} />
      <div className="text-center space-y-2 py-3">
        {c.media?.emoji && <div className="text-5xl">{c.media.emoji}</div>}
        {c.question_fr && (
          <MixedText text={c.question_fr} className="text-lg font-semibold text-primary-900 block" />
        )}
        {/* v6.1 — Bouton audio EN visible pour réécouter la phrase cible */}
        {c.audio_full && (
          <button onClick={() => speak(c.audio_full!)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-100 text-primary-800 rounded-full font-bold hover:bg-primary-200">
            🔊 Réécouter
          </button>
        )}
      </div>
      <div className="space-y-2">
        {options.map((opt, idx) => {
          const isPicked = picked === idx
          const isWrong = isPicked && shown === 'wrong'
          const isCorrect = isPicked && opt.correct
          return (
            <button key={idx}
              onClick={() => pick(idx)}
              disabled={isCorrect}
              className={`w-full p-4 rounded-xl border-2 font-bold text-lg transition-all ${
                isCorrect ? 'border-ok bg-green-50 text-ok' :
                isWrong ? 'border-warn bg-red-50 text-warn animate-shake' :
                'border-rule bg-white hover:bg-primary-50 hover:border-primary-300'
              }`}>
              {opt.text}
            </button>
          )
        })}
      </div>
      <div className="text-xs text-center text-gray-400">Tape une réponse — l&apos;audio se déclenche automatiquement</div>
    </div>
  )
}

// ============================================================================
// 4. PATTERN — tableau visuel sujet → verbe
// ============================================================================

function StepPattern({ step, onContinue, rate }: { step: StepV6; onContinue: () => void; rate: number }) {
  const c = step.content_json as {
    audio_intro?: string;
    pattern_rows?: { subject: string; verb: string; fr: string }[];
  }
  const rows = c.pattern_rows || []

  const segments: SequenceSegment[] = useMemo(() => {
    const segs: SequenceSegment[] = []
    if (c.audio_intro) segs.push({ text: c.audio_intro, lang: 'fr-FR', pauseAfter: 1500 })
    rows.forEach(r => {
      segs.push({ text: `${r.subject} ${r.verb}`, lang: 'en-GB', pauseAfter: 600 })
    })
    return segs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // v7.2 — Auto-next : pattern est passif (lecture du tableau)
  useAutoIntroWithAutoNext(segments, rate, onContinue)
  const replay = () => void speakSequence(segments, rate)

  return (
    <div className="space-y-5">
      <StepHeader icon="📐" label="Le pattern" onReplay={replay} />
      <div className="bg-gray-50 rounded-xl p-3 space-y-2">
        {rows.map((r, i) => (
          <button key={i}
            onClick={() => speak(`${r.subject} ${r.verb}`)}
            className="w-full flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors">
            <TokenChip token={{ text: r.subject, color: 'blue' }} />
            <span className="text-gray-400 text-xl">→</span>
            <TokenChip token={{ text: r.verb, color: 'red' }} />
            <span className="ml-auto text-sm italic text-gray-500">{r.fr}</span>
            <span className="text-primary-500">🔊</span>
          </button>
        ))}
      </div>
      <button onClick={onContinue}
        className="w-full p-4 bg-primary-700 text-white rounded-xl font-semibold hover:bg-primary-900 text-lg">
        Suivant →
      </button>
    </div>
  )
}

// ============================================================================
// 5. MATCH — tap-to-match 2 colonnes
// ============================================================================

function StepMatch({ step, onContinue, rate }: { step: StepV6; onContinue: (correct: boolean) => void; rate: number }) {
  const c = step.content_json as {
    audio_intro?: string;
    pairs?: { left: string; right: string }[];
    explanation_fr?: string;
  }
  const pairs = c.pairs || []
  const [matches, setMatches] = useState<Record<string, number>>({})
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null)
  // v8.6 — Permet de cliquer un right d'abord puis un left ensuite (UX tolérante).
  const [selectedRight, setSelectedRight] = useState<{ idx: number; val: string } | null>(null)
  // v8.14 — Mémorise le dernier left matché pour permettre la correction en 1 clic.
  // Quand un right libre est cliqué et qu'un dernier match existe encore, on
  // REMPLACE automatiquement le match du dernier left au lieu de simplement
  // sélectionner le right en jaune. Reset quand l'utilisateur prend la main
  // explicitement (clic sur un autre left, ou undoMatch, ou resetMatches).
  const [lastMatchedLeft, setLastMatchedLeft] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<boolean | null>(null)

  const rightShuffled = useMemo(
    () => shuffle(pairs.map((p, i) => ({ idx: i, val: p.right }))),
    [pairs]
  )

  const segments: SequenceSegment[] = useMemo(() =>
    c.audio_intro ? [{ text: c.audio_intro, lang: 'fr-FR' }] : []
    // eslint-disable-next-line react-hooks/exhaustive-deps
  , [])
  useAutoIntro(segments, rate)

  // v8.6 — Helper : exécute le match + déclenche auto-validation si toutes paires faites.
  function commitMatch(left: string, rightIdx: number) {
    const newMatches = { ...matches, [left]: rightIdx }
    setMatches(newMatches)
    setSelectedLeft(null)
    setSelectedRight(null)
    // v8.14 — Mémorise le left qu'on vient de matcher pour permettre une correction
    // en 1 clic au prochain clic right libre.
    setLastMatchedLeft(left)
    if (Object.keys(newMatches).length === pairs.length) {
      setTimeout(() => {
        const allOk = pairs.every(p => {
          const chosenIdx = newMatches[p.left]
          const chosenVal = rightShuffled.find(r => r.idx === chosenIdx)?.val
          return chosenVal === p.right
        })
        setFeedback(allOk)
      }, 600)
    }
  }

  function pickLeft(l: string) {
    if (feedback !== null) return
    speak(l)
    // v8.14 — Click sur left = prise de contrôle explicite → reset lastMatchedLeft.
    setLastMatchedLeft(null)
    // v8.11 — Logique enrichie pour permettre le REMPLACEMENT facile d'un match :
    if (selectedRight) {
      commitMatch(l, selectedRight.idx)
    } else if (matches[l] !== undefined) {
      undoMatch(l)
    } else {
      setSelectedLeft(l)
    }
  }

  function pickRight(idx: number, val: string) {
    if (feedback !== null) return
    // v8.12 — Si le right cliqué est déjà matché à un left, on défait le match.
    if (Object.values(matches).includes(idx)) {
      const leftToUndo = Object.keys(matches).find(k => matches[k] === idx)
      if (leftToUndo) {
        undoMatch(leftToUndo)
        speak(val)
      }
      return
    }
    speak(val)
    // v8.6 — Si un left est déjà sélectionné, on fait le match
    if (selectedLeft) {
      commitMatch(selectedLeft, idx)
      return
    }
    // v8.14 — Remplacement automatique en 1 clic : si un match récent existe
    // (lastMatchedLeft) et que ce left est encore matché, on REMPLACE
    // automatiquement son match par ce nouveau right. Plus besoin de re-cliquer
    // le sujet — l'apprenant peut juste tester un autre verbe directement.
    if (lastMatchedLeft && matches[lastMatchedLeft] !== undefined) {
      commitMatch(lastMatchedLeft, idx)
      return
    }
    // Sinon, on mémorise le right en attendant qu'un left soit cliqué
    setSelectedRight({ idx, val })
  }

  /** v6.0 — Permettre de défaire un match avant validation finale */
  function undoMatch(l: string) {
    if (feedback !== null) return
    const next = { ...matches }
    delete next[l]
    setMatches(next)
    // v7.1 — Auto-resélectionner le left démantelé pour faciliter la correction
    setSelectedLeft(l)
    setSelectedRight(null)
    // v8.14 — reset le tracker de dernier match (la prise de contrôle est explicite)
    setLastMatchedLeft(null)
  }

  /** v7.1 — Tout effacer pour recommencer */
  function resetMatches() {
    if (feedback === true) return
    setMatches({})
    setSelectedLeft(null)
    setSelectedRight(null)
    setLastMatchedLeft(null)
    setFeedback(null)
  }

  return (
    <div className="space-y-4">
      <StepHeader icon="🔗" label="Relie les paires" />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          {pairs.map(p => {
            const matchedIdx = matches[p.left]
            const matchedVal = matchedIdx !== undefined
              ? rightShuffled.find(r => r.idx === matchedIdx)?.val : undefined
            const isSelected = selectedLeft === p.left
            const isCorrect = feedback !== null && matchedVal === p.right
            const isWrong = feedback !== null && matchedVal !== undefined && matchedVal !== p.right
            return (
              <button key={p.left}
                // v8.11 — Toujours appeler pickLeft : la logique de remplacement/undo
                // est centralisée dans pickLeft (qui regarde selectedRight et matches).
                onClick={() => pickLeft(p.left)}
                disabled={feedback === true}
                className={`w-full p-3 rounded-xl border-2 font-bold text-lg transition-all ${
                  isCorrect ? 'border-ok bg-green-50 text-ok' :
                  isWrong ? 'border-warn bg-red-50 text-warn' :
                  // v8.13 — Si selectedRight est actif et que ce left est matché,
                  // on le rend visuellement plus prominent (ring jaune) pour montrer
                  // qu'il est actionnable pour REMPLACER son match.
                  matchedVal && selectedRight ? `${colorClass('blue')} ring-2 ring-amber-300` :
                  matchedVal ? `${colorClass('blue')} opacity-70` :
                  isSelected ? 'border-primary-500 bg-primary-100 text-primary-700' :
                  colorClass('blue')
                }`}>
                {p.left}
                {matchedVal && (
                  <span className="text-xs font-normal block mt-1">
                    {/* v8.13 — Texte contextuel : si un right est en attente, on indique
                        que cliquer ce left va le RELIER au nouveau verbe (remplacement). */}
                    → {matchedVal} {selectedRight
                      ? <span className="text-amber-700 font-bold">(toucher pour relier à {selectedRight.val})</span>
                      : '(toucher pour défaire)'}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <div className="space-y-2">
          {rightShuffled.map(r => {
            const used = Object.values(matches).includes(r.idx)
            // v8.6 — Highlight si ce right est sélectionné (en attente d'un left)
            const isSelectedRight = selectedRight?.idx === r.idx
            return (
              <button key={r.idx}
                onClick={() => pickRight(r.idx, r.val)}
                // v8.12 — disabled UNIQUEMENT en cas de feedback (validation finale).
                // Avant v8.12, les rights "used" étaient bloqués → bug remonté par
                // Raïssa : impossible de défaire en cliquant un right grisé.
                disabled={feedback !== null}
                className={`w-full p-3 rounded-xl border-2 font-bold text-lg transition-all ${
                  // v8.12 — Les rights matchés (used) restent cliquables mais visuellement
                  // grisés barrés. Le clic les défait (cf pickRight).
                  used ? 'bg-gray-100 text-gray-500 line-through border-rule hover:bg-gray-200 cursor-pointer' :
                  // v8.8 — selectedRight en jaune+pulse (clairement "en attente").
                  isSelectedRight ? 'border-amber-500 bg-amber-100 text-amber-900 ring-4 ring-amber-300 animate-pulse' :
                  selectedLeft ? `${colorClass('red')} hover:scale-105` :
                  colorClass('red')
                }`}>
                {r.val}
              </button>
            )
          })}
        </div>
      </div>
      {/* v8.5 — Plus de bouton manuel Valider. L'auto-validation se déclenche
          quand tous les matches sont faits (cf pickRight). L'utilisateur peut
          toujours cliquer sur une case déjà matchée pour la défaire avant la
          validation (~600ms de marge).
          Indication visuelle d'attente pendant le délai. */}
      {/* v8.11 — Message guide quand un mot de droite est sélectionné en attente
          d'un mot de gauche. Aide les apprenants à comprendre quoi faire ensuite. */}
      {feedback === null && selectedRight && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-3 text-center animate-pulse">
          <div className="text-base font-bold text-amber-900">
            👆 Touche un sujet à gauche pour le relier à <span className="text-amber-700">{selectedRight.val}</span>
          </div>
        </div>
      )}
      {/* v8.14 — Indicateur discret : montre qu'on peut corriger le dernier match
          en 1 clic sur un autre verbe. */}
      {feedback === null && !selectedRight && lastMatchedLeft && matches[lastMatchedLeft] !== undefined && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-center">
          <div className="text-xs text-blue-700">
            💡 Pour corriger <strong>{lastMatchedLeft}</strong>, touche directement un autre verbe à droite.
          </div>
        </div>
      )}
      {feedback === null && Object.keys(matches).length > 0 && Object.keys(matches).length < pairs.length && (
        <div className="space-y-2">
          <div className="text-center text-sm text-gray-500">
            {pairs.length - Object.keys(matches).length} paire{pairs.length - Object.keys(matches).length > 1 ? 's' : ''} restante{pairs.length - Object.keys(matches).length > 1 ? 's' : ''}
          </div>
          {/* v8.8 — Bouton "Tout effacer" discret : permet de repartir à zéro
              quand l'utilisateur sent qu'il a fait trop d'erreurs. */}
          <button onClick={resetMatches}
            className="w-full p-2 text-sm text-gray-500 hover:text-gray-700 underline">
            Tout effacer et recommencer
          </button>
        </div>
      )}

      {feedback !== null && (
        <div className={`border-l-4 p-4 rounded-r-lg space-y-3 ${feedback ? 'border-ok bg-green-50' : 'border-warn bg-yellow-50'}`}>
          <div className={`text-base font-bold ${feedback ? 'text-ok' : 'text-warn'}`}>
            {feedback ? '✓ Tout est juste !' : '✗ Quelques erreurs.'}
          </div>
          {!feedback && (
            <div className="text-sm space-y-1">
              {pairs.map(p => (
                <div key={p.left}>
                  <span className="font-bold text-blue-700">{p.left}</span> → <span className="font-bold text-red-700">{p.right}</span>
                </div>
              ))}
            </div>
          )}
          {c.explanation_fr && (
            <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg flex items-start gap-3 mt-2">
              <div className="flex-1">
                <div className="text-[11px] uppercase font-bold text-amber-700 tracking-wide mb-1">
                  💡 À retenir
                </div>
                <div className="text-base font-semibold text-gray-900 leading-snug">
                  {c.explanation_fr.replace(/\*\*/g, '')}
                </div>
              </div>
              <button onClick={() => void speakSequence([{ text: c.explanation_fr!, lang: 'fr-FR' }], rate)}
                aria-label="Écouter l'astuce"
                className="shrink-0 w-10 h-10 rounded-full bg-amber-200 text-amber-900 hover:bg-amber-300 text-base">
                🔊
              </button>
            </div>
          )}
          {/* v8.4 — Si erreurs : 2 options : Réessayer OU Continuer quand même.
              Avant v8.4 on était obligé de réessayer (bloquant pour illettrés). */}
          {!feedback && (
            <div className="flex gap-2">
              <button onClick={resetMatches}
                className="flex-1 p-3 border-2 border-primary-300 text-primary-700 rounded-xl font-bold hover:bg-primary-50">
                Réessayer
              </button>
              <button onClick={() => onContinue(false)}
                className="flex-1 p-3 bg-primary-700 text-white rounded-xl font-bold hover:bg-primary-900">
                Continuer →
              </button>
            </div>
          )}
          {feedback && (
            <button onClick={() => onContinue(true)}
              className="w-full p-3 bg-primary-700 text-white rounded-xl font-bold hover:bg-primary-900">
              Continuer →
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// 6. LISTEN_TARGET — écoute ciblée + MCQ
// ============================================================================

function StepListenTarget({ step, onContinue, rate }: { step: StepV6; onContinue: (correct: boolean) => void; rate: number }) {
  const c = step.content_json as {
    audio_intro?: string; audio_full?: string; question_fr?: string;
    options?: { text: string; correct: boolean }[];
  }
  const options = c.options || []
  const [picked, setPicked] = useState<number | null>(null)
  const [shown, setShown] = useState<'idle' | 'wrong'>('idle')

  const segments: SequenceSegment[] = useMemo(() => {
    const segs: SequenceSegment[] = []
    if (c.audio_intro) segs.push({ text: c.audio_intro, lang: 'fr-FR', pauseAfter: 1200 })
    if (c.audio_full) segs.push({ text: c.audio_full, lang: 'en-GB', pauseAfter: 600 })
    if (c.audio_full) segs.push({ text: c.audio_full, lang: 'en-GB' }) // Répète 2x
    return segs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useAutoIntro(segments, rate)
  const replay = () => c.audio_full && speak(c.audio_full)

  function pick(idx: number) {
    if (picked !== null && options[picked].correct) return
    setPicked(idx)
    // v8.16 — Détection auto FR/EN pour utiliser la bonne voix sur l'option cliquée
    speak(options[idx].text, null, { lang: detectOptionLang(options[idx].text) })
    if (options[idx].correct) {
      setTimeout(() => onContinue(true), 900)
    } else {
      setShown('wrong')
      setTimeout(() => { setPicked(null); setShown('idle') }, 1200)
    }
  }

  return (
    <div className="space-y-5">
      <StepHeader icon="👂" label="Écoute ciblée" />
      <div className="text-center py-4">
        <button onClick={replay}
          className="w-24 h-24 rounded-full bg-primary-700 text-white text-4xl hover:bg-primary-900 shadow-lg">
          🔊
        </button>
        <div className="text-xs mt-2 text-gray-500">Tape pour réécouter</div>
      </div>
      {c.question_fr && (
        <MixedText text={c.question_fr} className="text-center text-base font-semibold text-primary-900 block" />
      )}
      <div className="space-y-2">
        {options.map((opt, idx) => {
          const isPicked = picked === idx
          const isWrong = isPicked && shown === 'wrong'
          const isCorrect = isPicked && opt.correct
          return (
            <button key={idx}
              onClick={() => pick(idx)}
              disabled={isCorrect}
              className={`w-full p-4 rounded-xl border-2 font-bold text-lg ${
                isCorrect ? 'border-ok bg-green-50 text-ok' :
                isWrong ? 'border-warn bg-red-50 text-warn animate-shake' :
                colorClass('red')
              }`}>
              {opt.text}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================================
// 7. TAP_BUILD — construire la phrase en cliquant sur les mots
// ============================================================================

function StepTapBuild({ step, onContinue, rate }: { step: StepV6; onContinue: (correct: boolean) => void; rate: number }) {
  const c = step.content_json as {
    audio_intro?: string; audio_target?: string; audio_target_fr?: string;
    expected_tokens?: ColorToken[]; distractors?: ColorToken[];
  }
  const expected = c.expected_tokens || []
  const distractors = c.distractors || []
  const allTokens = useMemo(
    () => shuffle([...expected, ...distractors].map((t, i) => ({ ...t, _idx: i }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )
  const [picked, setPicked] = useState<typeof allTokens>([])
  const [feedback, setFeedback] = useState<boolean | null>(null)

  const segments: SequenceSegment[] = useMemo(() => {
    const segs: SequenceSegment[] = []
    if (c.audio_intro) segs.push({ text: c.audio_intro, lang: 'fr-FR', pauseAfter: 1200 })
    if (c.audio_target_fr) segs.push({ text: c.audio_target_fr, lang: 'fr-FR' })
    return segs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useAutoIntro(segments, rate)

  function pickToken(t: typeof allTokens[number]) {
    if (feedback !== null) return
    speak(t.text)
    setPicked([...picked, t])
  }
  function unpickToken(t: typeof allTokens[number]) {
    if (feedback !== null) return
    setPicked(picked.filter(p => p._idx !== t._idx))
  }
  function validate() {
    const userText = picked.map(p => p.text).join(' ').toLowerCase().replace(/[.,]/g, '').trim()
    const expectedText = expected.map(p => p.text).join(' ').toLowerCase().replace(/[.,]/g, '').trim()
    const ok = userText === expectedText
    setFeedback(ok)
    if (ok && c.audio_target) speak(c.audio_target)
  }
  function reset() {
    setPicked([])
    setFeedback(null)
  }

  return (
    <div className="space-y-4">
      <StepHeader icon="🧩" label="Construis la phrase" />
      {c.audio_target_fr && (
        <div className="text-center text-base font-semibold text-primary-900 bg-blue-50 p-3 rounded-lg">
          {c.audio_target_fr}
        </div>
      )}

      {/* Zone de construction */}
      <div className="min-h-[68px] p-3 border-2 border-dashed border-primary-300 rounded-xl flex flex-wrap gap-2 items-center justify-center">
        {picked.length === 0 && <span className="text-gray-400 text-sm">Tape les mots dans l&apos;ordre</span>}
        {picked.map(t => (
          <button key={t._idx} onClick={() => unpickToken(t)}
            className={`rounded-lg border-2 font-bold text-lg px-3 py-1.5 ${colorClass(t.color)}`}>
            {t.text}
          </button>
        ))}
      </div>

      {/* Pool de mots disponibles */}
      <div className="flex flex-wrap gap-2 justify-center">
        {allTokens.map(t => {
          const used = picked.find(p => p._idx === t._idx)
          return (
            <button key={t._idx} onClick={() => pickToken(t)}
              disabled={!!used || feedback !== null}
              className={`rounded-lg border-2 font-bold text-lg px-3 py-1.5 ${
                used ? 'bg-gray-100 text-gray-400 line-through border-gray-200' :
                colorClass(t.color)
              } hover:scale-105 transition-transform`}>
              {t.text}
            </button>
          )
        })}
      </div>

      {feedback === null && (
        <button onClick={validate} disabled={picked.length === 0}
          className="w-full p-4 bg-primary-700 text-white rounded-xl font-bold hover:bg-primary-900 text-lg disabled:opacity-50">
          Valider
        </button>
      )}

      {feedback !== null && (
        <div className={`border-l-4 p-4 rounded-r-lg space-y-3 ${feedback ? 'border-ok bg-green-50' : 'border-warn bg-yellow-50'}`}>
          <div className={`text-base font-bold ${feedback ? 'text-ok' : 'text-warn'}`}>
            {feedback ? '✓ Bravo !' : '✗ Pas tout à fait.'}
          </div>
          {!feedback && (
            <>
              <div className="text-sm">La bonne réponse :</div>
              <div className="flex flex-wrap gap-2">
                {expected.map((t, i) => <TokenChip key={i} token={t} />)}
              </div>
            </>
          )}
          <div className="flex gap-2">
            {!feedback && (
              <button onClick={reset}
                className="flex-1 p-3 border-2 border-primary-700 text-primary-700 rounded-xl font-bold">
                Recommencer
              </button>
            )}
            <button onClick={() => onContinue(feedback)}
              className="flex-1 p-3 bg-primary-700 text-white rounded-xl font-bold">
              Continuer →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// 8. GAP_FILL — phrase à trou + 3 options
// ============================================================================

function StepGapFill({
  step, onContinue, rate,
  data,  // si fourni, override step.content_json (pour variants/recap)
}: {
  step: StepV6
  onContinue: (correct: boolean) => void
  rate: number
  data?: Record<string, unknown>
}) {
  const c = (data || step.content_json) as {
    audio_intro?: string;
    audio_intro_fr?: string;  // v6.1 — FR auto au mount pour les illettrés
    sentence_tokens?: ColorToken[];
    sentence_fr_tokens?: ColorToken[];
    sentence_fr?: string;
    options?: { text: string; correct: boolean; color?: string }[];
    explanation_fr?: string;
  }
  const options = c.options || []
  const sentence = c.sentence_tokens || []
  const sentenceFr = c.sentence_fr_tokens
  const [picked, setPicked] = useState<number | null>(null)
  const [shown, setShown] = useState<'idle' | 'wrong'>('idle')
  const [filled, setFilled] = useState<string | null>(null)

  // v6.1 — Audio FR auto au mount : on lit la phrase en français
  // pour que les illettrés comprennent ce qu'on attend AVANT de choisir.
  const segments: SequenceSegment[] = useMemo(() => {
    const segs: SequenceSegment[] = []
    if (c.audio_intro_fr) segs.push({ text: c.audio_intro_fr, lang: 'fr-FR' })
    else if (c.sentence_fr) segs.push({ text: c.sentence_fr, lang: 'fr-FR' })
    if (c.audio_intro) segs.push({ text: c.audio_intro, lang: 'fr-FR' })
    return segs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id])
  useAutoIntro(segments, rate)

  function pick(idx: number) {
    if (picked !== null && options[picked].correct) return
    const opt = options[idx]
    setPicked(idx)
    speak(opt.text)
    setFilled(opt.text)
    if (opt.correct) {
      // Lit la phrase complète corrigée
      setTimeout(() => {
        const full = sentence.map(t => t.is_gap ? opt.text : t.text).join(' ')
        speak(full)
      }, 600)
      setTimeout(() => onContinue(true), 1800)
    } else {
      setShown('wrong')
      setTimeout(() => { setPicked(null); setShown('idle'); setFilled(null) }, 1300)
    }
  }

  function renderTokens(tokens: ColorToken[], filledOverride: string | null) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-2">
        {tokens.map((t, i) => {
          if (t.is_gap && filledOverride) {
            return <TokenChip key={i} token={{ text: filledOverride, color: t.color }} size="lg" />
          }
          return <TokenChip key={i} token={t} size="lg" />
        })}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <StepHeader icon="✏️" label="Complète la phrase" />
      <div className="bg-white border-2 border-rule rounded-xl p-4 space-y-3">
        {renderTokens(sentence, filled)}
        {sentenceFr && (
          <>
            <div className="border-t border-gray-200 my-2" />
            {renderTokens(sentenceFr, filled ? translateOption(filled) : null)}
          </>
        )}
        {!sentenceFr && c.sentence_fr && (
          <div className="text-center text-sm italic text-gray-600 border-t border-gray-200 pt-2">→ {c.sentence_fr}</div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {options.map((opt, idx) => {
          const isPicked = picked === idx
          const isWrong = isPicked && shown === 'wrong'
          const isCorrect = isPicked && opt.correct
          return (
            <button key={idx}
              onClick={() => pick(idx)}
              disabled={isCorrect}
              className={`p-4 rounded-xl border-2 font-bold text-xl ${
                isCorrect ? 'border-ok bg-green-50 text-ok' :
                isWrong ? 'border-warn bg-red-50 text-warn animate-shake' :
                colorClass(opt.color || 'red')
              } hover:scale-105 transition-transform`}>
              {opt.text}
            </button>
          )
        })}
      </div>
      {c.explanation_fr && picked !== null && options[picked].correct && (
        <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg flex items-start gap-3">
          <div className="flex-1">
            <div className="text-[11px] uppercase font-bold text-amber-700 tracking-wide mb-1">
              💡 À retenir
            </div>
            <div className="text-base font-semibold text-gray-900 leading-snug">
              {c.explanation_fr.replace(/\*\*/g, '')}
            </div>
          </div>
          {/* v7.3 — Bouton 🔊 mixed-aware (voix EN sur **xxx**) */}
          <button onClick={() => void speakSequence([{ text: c.explanation_fr!, lang: 'fr-FR' }], rate)}
            aria-label="Écouter l'astuce"
            className="shrink-0 w-10 h-10 rounded-full bg-amber-200 text-amber-900 hover:bg-amber-300 text-base">
            🔊
          </button>
        </div>
      )}
    </div>
  )
}

/** Helper : traduit am/is/are en français pour l'affichage du blanc rempli côté FR */
function translateOption(en: string): string {
  const map: Record<string, string> = {
    'am': 'suis', 'is': 'est', 'are': 'sommes',
    'I am': 'je suis', 'You are': 'tu es', 'He is': 'il est',
    'I’m': 'je suis', 'She’s': 'elle est', 'They’re': 'ils sont',
  }
  return map[en] || en
}

// ============================================================================
// 9. VARIANTS — 3 mini gap_fill enchaînés
// ============================================================================

function StepVariants({ step, onContinue, rate }: { step: StepV6; onContinue: (correct: boolean) => void; rate: number }) {
  const c = step.content_json as {
    audio_intro?: string;
    variants?: Record<string, unknown>[];
  }
  const variants = c.variants || []
  const [idx, setIdx] = useState(0)
  const [score, setScore] = useState(0)

  const segments: SequenceSegment[] = useMemo(() =>
    c.audio_intro ? [{ text: c.audio_intro, lang: 'fr-FR' }] : []
    // eslint-disable-next-line react-hooks/exhaustive-deps
  , [])
  useAutoIntro(segments, rate)

  function next(correct: boolean) {
    if (correct) setScore(s => s + 1)
    if (idx + 1 >= variants.length) {
      setTimeout(() => onContinue(score + (correct ? 1 : 0) >= variants.length / 2), 200)
    } else {
      setIdx(idx + 1)
    }
  }

  if (variants.length === 0) return null
  const v = variants[idx]

  // Pseudo-step pour réutiliser StepGapFill
  return (
    <div className="space-y-3">
      <div className="text-center text-xs text-gray-500">Question {idx + 1} / {variants.length}</div>
      <StepGapFill
        key={idx}
        step={step}
        rate={rate}
        data={v}
        onContinue={next}
      />
    </div>
  )
}

// ============================================================================
// 10. CONTRACTIONS_INTRO — animation full → contracté
// ============================================================================

function StepContractionsIntro({ step, onContinue, rate }: { step: StepV6; onContinue: () => void; rate: number }) {
  const c = step.content_json as {
    audio_intro?: string;
    transformations?: { full: string; short: string; fr: string }[];
    explanation_fr?: string;
  }
  const trans = c.transformations || []

  const segments: SequenceSegment[] = useMemo(() => {
    const segs: SequenceSegment[] = []
    if (c.audio_intro) segs.push({ text: c.audio_intro, lang: 'fr-FR', pauseAfter: 1200 })
    trans.forEach(t => {
      segs.push({ text: t.full, lang: 'en-GB', pauseAfter: 400 })
      segs.push({ text: t.short, lang: 'en-GB', pauseAfter: 700 })
    })
    return segs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // v7.2 — Auto-next : contractions_intro est passif (visualisation transformations)
  useAutoIntroWithAutoNext(segments, rate, onContinue)
  const replay = () => void speakSequence(segments, rate)

  return (
    <div className="space-y-5">
      <StepHeader icon="🔗" label="Les contractions" onReplay={replay} />
      <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4 space-y-3">
        {trans.map((t, i) => (
          <button key={i} onClick={() => { void speakSequence([
            { text: t.full, lang: 'en-GB', pauseAfter: 500 },
            { text: t.short, lang: 'en-GB' },
          ], rate) }}
            className="w-full flex items-center gap-2 p-2 hover:bg-white rounded-lg">
            <TokenChip token={{ text: t.full, color: 'blue' }} />
            <span className="text-purple-500 text-2xl font-bold">→</span>
            <TokenChip token={{ text: t.short, color: 'purple' }} />
            <span className="ml-auto text-sm italic text-gray-600">{t.fr}</span>
            <span className="text-primary-500">🔊</span>
          </button>
        ))}
      </div>
      {c.explanation_fr && (
        <div className="bg-amber-50 border-l-4 border-amber-400 p-3 rounded-r-lg text-sm">
          💡 {c.explanation_fr}
        </div>
      )}
      <button onClick={onContinue}
        className="w-full p-4 bg-primary-700 text-white rounded-xl font-bold hover:bg-primary-900 text-lg">
        Suivant →
      </button>
    </div>
  )
}

// ============================================================================
// 11. CONTRACTIONS_RECOGNITION — écoute contraction + MCQ
// ============================================================================

function StepContractionsRecognition({ step, onContinue, rate }: { step: StepV6; onContinue: (correct: boolean) => void; rate: number }) {
  // Réutilise la logique de StepListenTarget
  return <StepListenTarget step={step} onContinue={onContinue} rate={rate} />
}

// ============================================================================
// 12. CONTRACTIONS_BUILD — réutilise StepTapBuild
// ============================================================================

function StepContractionsBuild({ step, onContinue, rate }: { step: StepV6; onContinue: (correct: boolean) => void; rate: number }) {
  return <StepTapBuild step={step} onContinue={onContinue} rate={rate} />
}

// ============================================================================
// 13. RECAP_CHALLENGE — 5 questions enchaînées
// ============================================================================

function StepRecapChallenge({ step, onContinue, rate }: { step: StepV6; onContinue: (correct: boolean) => void; rate: number }) {
  const c = step.content_json as {
    audio_intro?: string;
    challenges?: Record<string, unknown>[];
  }
  const chs = c.challenges || []
  const [idx, setIdx] = useState(0)
  const [score, setScore] = useState(0)

  const segments: SequenceSegment[] = useMemo(() =>
    c.audio_intro ? [{ text: c.audio_intro, lang: 'fr-FR' }] : []
    // eslint-disable-next-line react-hooks/exhaustive-deps
  , [])
  useAutoIntro(segments, rate)

  function next(correct: boolean) {
    const newScore = score + (correct ? 1 : 0)
    setScore(newScore)
    if (idx + 1 >= chs.length) {
      setTimeout(() => onContinue(newScore >= chs.length * 0.6), 300)
    } else {
      setIdx(idx + 1)
    }
  }

  if (chs.length === 0) return null
  const ch = chs[idx]
  const chType = ch.type as string

  return (
    <div className="space-y-3">
      <div className="text-center text-xs text-gray-500">Challenge {idx + 1} / {chs.length} · Score {score}</div>
      {chType === 'recognition' && (
        <StepRecognition
          key={idx}
          step={{ ...step, content_json: ch }}
          rate={rate}
          onContinue={next}
        />
      )}
      {chType === 'gap_fill' && (
        <StepGapFill
          key={idx}
          step={step}
          rate={rate}
          data={ch}
          onContinue={next}
        />
      )}
    </div>
  )
}

// ============================================================================
// COMPOSANT PRINCIPAL — router selon le type
// ============================================================================

export function GrammarStepV6({ step, onContinue, onBack, isLast, canGoBack, mode = 'complete', userName }: Props) {
  const rate = mode === 'speaking' ? 0.8 : 0.9

  function handleContinue(correct?: boolean) {
    onContinue(correct)
  }

  return (
    <div className="space-y-4">
      {step.type === 'intro' && <StepIntro step={step} onContinue={() => handleContinue()} rate={rate} />}
      {step.type === 'role_explanation' && <StepRoleExplanation step={step} onContinue={() => handleContinue()} rate={rate} />}
      {step.type === 'repeat' && <StepRepeat step={step} onContinue={() => handleContinue()} rate={rate} />}
      {step.type === 'dialog' && <StepDialog step={step} onContinue={() => handleContinue()} rate={rate} />}
      {step.type === 'validation_final' && <StepValidationFinal step={step} onContinue={() => handleContinue()} rate={rate} userName={userName} />}
      {step.type === 'immersion' && <StepImmersion step={step} onContinue={() => handleContinue()} rate={rate} />}
      {step.type === 'discover_text' && <StepDiscoverText step={step} onContinue={() => handleContinue()} rate={rate} />}
      {step.type === 'recognition' && <StepRecognition step={step} onContinue={handleContinue} rate={rate} />}
      {step.type === 'pattern' && <StepPattern step={step} onContinue={() => handleContinue()} rate={rate} />}
      {step.type === 'match' && <StepMatch step={step} onContinue={handleContinue} rate={rate} />}
      {step.type === 'listen_target' && <StepListenTarget step={step} onContinue={handleContinue} rate={rate} />}
      {step.type === 'tap_build' && <StepTapBuild step={step} onContinue={handleContinue} rate={rate} />}
      {step.type === 'gap_fill' && <StepGapFill step={step} onContinue={handleContinue} rate={rate} />}
      {step.type === 'variants' && <StepVariants step={step} onContinue={handleContinue} rate={rate} />}
      {step.type === 'contractions_intro' && <StepContractionsIntro step={step} onContinue={() => handleContinue()} rate={rate} />}
      {step.type === 'contractions_recognition' && <StepContractionsRecognition step={step} onContinue={handleContinue} rate={rate} />}
      {step.type === 'contractions_build' && <StepContractionsBuild step={step} onContinue={handleContinue} rate={rate} />}
      {step.type === 'recap_challenge' && <StepRecapChallenge step={step} onContinue={handleContinue} rate={rate} />}

      {canGoBack && onBack && (
        <button onClick={onBack}
          className="w-full p-2 text-sm text-gray-500 hover:text-primary-700 hover:bg-gray-50 rounded-lg">
          ← Étape précédente
        </button>
      )}

      {isLast && step.type !== 'recap_challenge' && (
        <div className="text-xs text-center text-gray-400">Dernière étape</div>
      )}

      <div className="flex items-center justify-center gap-2 text-[10px] text-gray-400 select-none">
        <span data-tts-version={TTS_VERSION}>TTS {TTS_VERSION}</span>
        <span>·</span>
        <span>Parcours : {mode === 'speaking' ? '🎧 Speaking pur' : '📘 Complet'}</span>
      </div>
    </div>
  )
}
