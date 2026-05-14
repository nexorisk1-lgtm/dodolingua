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

// v1.6 — Voix par ordre de préférence : voix natives OS d'abord (plus naturelles),
// puis voix online Microsoft, puis Google en dernier (les Google sont plus robotiques).
const PREFERRED_VOICES = [
  'Daniel',         // macOS UK premium (la plus naturelle)
  'Karen',          // macOS AU/UK premium
  'Serena',         // macOS UK premium
  'Samantha',       // macOS US neural
  'Moira',          // macOS Irish-English
  'Tessa',          // macOS South African UK
  'Microsoft Sonia Online (Natural) - English (United Kingdom)',
  'Microsoft Libby Online (Natural) - English (United Kingdom)',
  'Microsoft Ryan Online (Natural) - English (United Kingdom)',
  'Microsoft Hazel - English (Great Britain)',
  'Microsoft Susan - English (Great Britain)',
  'Google UK English Female',
  'Google UK English Male',
]

// v1.6 — Attente que les voix soient chargées (Web Speech API les charge async)
export function waitForVoices(timeoutMs = 2000): Promise<SpeechSynthesisVoice[]> {
  return new Promise(resolve => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return resolve([])
    const existing = window.speechSynthesis.getVoices()
    if (existing.length > 0) return resolve(existing)
    const handler = () => {
      const v = window.speechSynthesis.getVoices()
      window.speechSynthesis.removeEventListener('voiceschanged', handler)
      resolve(v)
    }
    window.speechSynthesis.addEventListener('voiceschanged', handler)
    setTimeout(() => {
      window.speechSynthesis.removeEventListener('voiceschanged', handler)
      resolve(window.speechSynthesis.getVoices())
    }, timeoutMs)
  })
}

export function getBestVoice(langPrefix = 'en'): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return null

  for (const name of PREFERRED_VOICES) {
    const v = voices.find(v => v.name === name || v.name.includes(name))
    if (v) return v
  }
  // Fallback : voix anglaise marquée "premium" ou "natural"
  const premium = voices.find(v =>
    v.lang.startsWith(langPrefix) &&
    /natural|premium|neural|enhanced/i.test(v.name)
  )
  if (premium) return premium
  // Dernier fallback : n'importe quelle voix UK puis US
  return voices.find(v => v.lang === 'en-GB') ||
         voices.find(v => v.lang === 'en-US') ||
         voices.find(v => v.lang.startsWith(langPrefix)) ||
         null
}

// v5.5 — Options pour speak() (compat ascendante avec ancien `rate: number`)
export interface SpeakOptions {
  rate?: number
  /** v5.5 — Force la langue (ex: 'fr-FR' pour lire un texte français).
   *  Si non fourni : voix utilisateur (en général EN). */
  lang?: string
}

export function speak(text: string, voiceName?: string | null, optsOrRate: SpeakOptions | number = 1) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  // v5.5 — Compat ascendante : si optsOrRate est un nombre, c'est l'ancien `rate`
  const opts: SpeakOptions = typeof optsOrRate === 'number'
    ? { rate: optsOrRate }
    : optsOrRate

  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)

  // v5.5 — Si opts.lang est fourni (ex: 'fr-FR'), on prend une voix de cette langue
  // au lieu de la voix utilisateur par défaut. Permet de lire les textes français
  // pour les utilisateurs en parcours oral pur.
  if (opts.lang) {
    const voices = window.speechSynthesis.getVoices()
    const langPrefix = opts.lang.split('-')[0]
    const v = voices.find(x => x.lang === opts.lang)
          || voices.find(x => x.lang.startsWith(langPrefix))
    if (v) { u.voice = v; u.lang = v.lang }
    else u.lang = opts.lang
  } else if (voiceName) {
    const v = window.speechSynthesis.getVoices().find(v => v.name === voiceName)
    if (v) { u.voice = v; u.lang = v.lang }
  } else {
    // Auto-selection de la meilleure voix dispo
    const best = getBestVoice('en')
    if (best) { u.voice = best; u.lang = best.lang }
    else u.lang = 'en-GB'
  }

  u.rate = opts.rate ?? 1
  u.pitch = 1
  window.speechSynthesis.speak(u)
}

// ===========================================================
// v5.6 — TTS MULTILINGUE : speakMixed()
// ===========================================================
//
// Quand un texte français contient des mots anglais (ex: "Avec **I**,
// le verbe **to be** devient **am**"), on doit alterner les voix :
// - Texte FR → voix française
// - Mots EN (entre **...** ou '...') → voix anglaise
//
// Le Web Speech API met en queue les utterances → on peut chaîner les
// segments avec différentes voix.

interface MixedSegment { text: string; lang: 'en-GB' | 'fr-FR' }

/** Parse un texte mixte FR/EN : tokens entre **xxx** ou 'xxx' = EN, reste = FR */
function parseMixedText(text: string, primaryLang: 'fr-FR' | 'en-GB' = 'fr-FR'): MixedSegment[] {
  const segments: MixedSegment[] = []
  // Pattern : capture **xxx** ou 'xxx' (mots EN dans texte FR)
  const pattern = /\*\*([^*]+)\*\*|'([^']+)'/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  const otherLang = primaryLang === 'fr-FR' ? 'en-GB' : 'fr-FR'

  while ((match = pattern.exec(text)) !== null) {
    // Texte avant le match (langue principale)
    if (match.index > lastIndex) {
      const part = text.slice(lastIndex, match.index).trim()
      if (part) segments.push({ text: part, lang: primaryLang })
    }
    // Le mot anglais (sans les délimiteurs)
    const enWord = (match[1] || match[2] || '').trim()
    // Si plusieurs mots séparés par "/" ou "," : on les sépare pour pauses
    if (enWord.includes('/') || enWord.includes(',')) {
      enWord.split(/[\/,]/).forEach(w => {
        const t = w.trim()
        if (t) segments.push({ text: t, lang: otherLang })
      })
    } else {
      segments.push({ text: enWord, lang: otherLang })
    }
    lastIndex = match.index + match[0].length
  }
  // Reste après le dernier match
  if (lastIndex < text.length) {
    const part = text.slice(lastIndex).trim()
    if (part) segments.push({ text: part, lang: primaryLang })
  }
  // Si rien n'a matché : tout en langue principale
  if (segments.length === 0 && text.trim()) {
    segments.push({ text: text.trim(), lang: primaryLang })
  }
  return segments
}

/** v5.6 — Lit un texte mixte FR/EN en alternant les voix. */
export function speakMixed(text: string, primaryLang: 'fr-FR' | 'en-GB' = 'fr-FR') {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const segments = parseMixedText(text, primaryLang)
  const voices = window.speechSynthesis.getVoices()

  for (const seg of segments) {
    const u = new SpeechSynthesisUtterance(seg.text)
    const langPrefix = seg.lang.split('-')[0]
    // Trouver la meilleure voix pour cette langue
    let v: SpeechSynthesisVoice | undefined
    if (seg.lang === 'en-GB') {
      // Pour l'anglais : utiliser getBestVoice qui privilégie les voix premium
      v = getBestVoice('en') || undefined
    } else {
      v = voices.find(x => x.lang === seg.lang)
          || voices.find(x => x.lang.startsWith(langPrefix))
    }
    if (v) { u.voice = v; u.lang = v.lang }
    else u.lang = seg.lang
    // Rate un peu plus lent pour clarté multi-langues
    u.rate = 0.9
    u.pitch = 1
    window.speechSynthesis.speak(u)
  }
}
