import type { GameWord } from './types'

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function pickDistractors(words: GameWord[], correct: GameWord, n = 3): GameWord[] {
  return shuffle(words.filter(w => w.id !== correct.id)).slice(0, n)
}

export interface SpeakOptions {
  rate?: number
  /** Appelé quand le TTS commence réellement à parler. */
  onstart?: () => void
  /** Appelé quand le TTS finit OU est annulé OU si timeout de sécurité expire. Garanti d'être appelé une seule fois. */
  onend?: () => void
  /** v5.5 — Force la langue (ex: 'fr-FR' pour lire un texte français). Par défaut : voix utilisateur (en-GB). */
  lang?: string
}

/**
 * v3 — speak() instrumentée pour permettre la coupure du micro pendant le TTS.
 *
 * Pourquoi ces callbacks ? Sur certains navigateurs (iOS Safari notamment),
 * SpeechSynthesisUtterance.onend n'est PAS toujours déclenché. On ajoute donc
 * un timeout de sécurité (estimation : ~60 ms par caractère + 500 ms buffer)
 * pour garantir que onend soit appelé au plus tard.
 */
export function speak(
  text: string,
  voiceName?: string | null,
  optsOrRate: SpeakOptions | number = {}
) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  // Compat ascendante : ancien appel speak(text, voiceName, rate)
  const opts: SpeakOptions = typeof optsOrRate === 'number'
    ? { rate: optsOrRate }
    : optsOrRate

  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  // v5.5 — si opts.lang est fourni, on prend une voix de cette langue (ex: 'fr-FR')
  // au lieu de la voix utilisateur par défaut (anglaise).
  if (opts.lang) {
    const voices = window.speechSynthesis.getVoices()
    const langPrefix = opts.lang.split('-')[0]
    const v = voices.find(x => x.lang === opts.lang) || voices.find(x => x.lang.startsWith(langPrefix))
    if (v) { u.voice = v; u.lang = v.lang }
    else u.lang = opts.lang
  } else if (voiceName) {
    const v = window.speechSynthesis.getVoices().find(v => v.name === voiceName)
    if (v) { u.voice = v; u.lang = v.lang }
  } else {
    u.lang = 'en-GB'
  }
  u.rate = opts.rate ?? 1

  // onend "one-shot" : le premier déclencheur (onend natif, onerror, ou timeout) gagne.
  let ended = false
  const fireEnd = () => {
    if (ended) return
    ended = true
    try { opts.onend?.() } catch {}
  }
  u.onstart = () => { try { opts.onstart?.() } catch {} }
  u.onend = fireEnd
  u.onerror = fireEnd

  // Timeout de sécurité : ~60 ms / caractère + 500 ms buffer, plafonné à 30 s.
  const safetyMs = Math.min(30_000, text.length * 60 + 500)
  const safetyTimer = window.setTimeout(fireEnd, safetyMs)
  // Si onend natif est déclenché, on annule le timeout.
  const origFireEnd = fireEnd
  u.onend = () => { window.clearTimeout(safetyTimer); origFireEnd() }
  u.onerror = () => { window.clearTimeout(safetyTimer); origFireEnd() }

  window.speechSynthesis.speak(u)
}
