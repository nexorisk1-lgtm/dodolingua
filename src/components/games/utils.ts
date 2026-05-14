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
  // v5.16 — Rollback du fix v5.14 "I → I am" : ça créait des bugs visibles
  // ("le sujet est I am" au lieu de "le sujet est I"). À retraiter dans V6
  // via reformulation BDD pour ne plus jamais isoler "I".
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

/** v5.7 — Trouve la meilleure voix française dispo */
function getBestFrVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null
  const voices = window.speechSynthesis.getVoices()
  // Voix françaises premium macOS / Windows en priorité
  const PREFERRED_FR = ['Thomas', 'Amélie', 'Audrey', 'Aurélie',
    'Microsoft Henri Online (Natural) - French (France)',
    'Microsoft Denise Online (Natural) - French (France)',
    'Microsoft Julie - French (France)']
  for (const name of PREFERRED_FR) {
    const v = voices.find(x => x.name === name || x.name.includes(name))
    if (v) return v
  }
  return voices.find(x => x.lang === 'fr-FR') || voices.find(x => x.lang.startsWith('fr')) || null
}

// v5.14 — Mots FR courants qui peuvent apparaître entre ** sans être de l'anglais
// (ex: dans la leçon pronoms : "**je**, **tu**, **il**" sont du français mis en valeur)
// Avant v5.14, parseMixedText les lisait avec la voix anglaise → Daniel disait "Tu" en anglais.
const FR_WORDS = new Set([
  'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles',
  'ce', 'cela', 'ça', 'cet', 'cette', 'ces',
  'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses',
  'notre', 'nos', 'votre', 'vos', 'leur', 'leurs',
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de',
  'et', 'ou', 'mais', 'donc', 'car', 'si', 'que', 'qui',
  'oui', 'non',
  'pronoms', 'sujets', 'sujet', 'verbe', 'phrase',
])

/** Parse un texte mixte FR/EN : tokens entre **xxx** = EN par défaut,
 *  sauf si tous les mots du token sont FR (blacklist ou présence d'accents). */
function parseMixedText(text: string, primaryLang: 'fr-FR' | 'en-GB' = 'fr-FR'): MixedSegment[] {
  const segments: MixedSegment[] = []
  // v5.8 — Uniquement **xxx** pour marquer les mots EN.
  // Le pattern 'xxx' a été retiré car il matchait aussi les apostrophes
  // françaises dans "l'infinitif" → "l" était lu comme un mot anglais.
  const pattern = /\*\*([^*]+)\*\*/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  const otherLang = primaryLang === 'fr-FR' ? 'en-GB' : 'fr-FR'

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const part = text.slice(lastIndex, match.index).trim()
      if (part) segments.push({ text: part, lang: primaryLang })
    }
    const enWord = (match[1] || '').trim()
    // v5.7 — Pour une LISTE 'am / is / are' : on garde un SEUL segment EN avec virgules
    // (les virgules créent des pauses naturelles dans la voix EN, plus clair que 3 utterances séparées)
    const cleaned = enWord.replace(/\s*\/\s*/g, ', ')

    // v5.14 — Détection FR : si tous les mots sont dans la blacklist FR
    // ou contiennent des accents FR → on garde la voix primaire (FR)
    const words = cleaned.split(/[\s,]+/).filter(Boolean)
    const isFrToken = words.length > 0 && words.every(w =>
      FR_WORDS.has(w.toLowerCase().replace(/[^a-zà-ÿ-]/gi, '')) ||
      /[éèêëàâäîïôöùûüçÿœæ]/i.test(w)
    )
    const segLang = isFrToken ? primaryLang : otherLang

    if (cleaned) segments.push({ text: cleaned, lang: segLang })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    const part = text.slice(lastIndex).trim()
    if (part) segments.push({ text: part, lang: primaryLang })
  }
  if (segments.length === 0 && text.trim()) {
    segments.push({ text: text.trim(), lang: primaryLang })
  }
  return segments
}

// v5.9 — Lock global anti-double-call (StrictMode React déclenche 2x les events)
let __speakingLock = false

/** v5.9 — Lit un texte mixte FR/EN en alternant les voix.
 *  - Async : attend que les voix soient chargées avant de commencer
 *  - Sélection robuste de voix EN/FR (force une voix de la bonne langue)
 *  - Strip systématique des ** dans tous les segments (sécurité)
 *  - Anti-double-call avec lock 200ms */
export async function speakMixed(text: string, primaryLang: 'fr-FR' | 'en-GB' = 'fr-FR'): Promise<void> {
  if (typeof window === 'undefined' || !window.speechSynthesis) return

  // v5.9 — Anti-double-call : ignore si une lecture est déjà en cours
  if (__speakingLock) return
  __speakingLock = true
  setTimeout(() => { __speakingLock = false }, 200)

  // Attendre que les voix soient chargées (sinon getVoices() retourne [] au 1er appel)
  await waitForVoices()

  window.speechSynthesis.cancel()
  // Petit délai pour laisser cancel() se terminer (évite annulation des nouvelles utterances)
  await new Promise(r => setTimeout(r, 30))

  const segments = parseMixedText(text, primaryLang)

  for (const seg of segments) {
    // v5.11 — Nettoyage robuste avant TTS :
    //  - Strip les ** Markdown
    //  - Strip les ponctuations finales seules (sinon "." est lu "point")
    //  - Convertit les mots TOUT EN MAJUSCULES en minuscules pour la lecture
    //    (sinon "TO" → "tout" en FR, "I" → "capital I" en EN)
    let cleanText = seg.text.replace(/\*\*/g, '').trim()
    // v5.13 — Nettoyage exhaustif pour TTS naturel :
    // 1. Mots tout-majuscules → minuscules (sauf "I" pronom anglais)
    cleanText = cleanText.replace(/\b[A-Z]{1,6}\b/g, (m) => m === 'I' ? 'I' : m.toLowerCase())
    // 2. Symboles parlés littéralement par les voix → remplacer ou supprimer
    cleanText = cleanText
      .replace(/\s*\+\s*/g, ' et ')             // "+" → "et" (était lu "plus")
      .replace(/\s*[→←↔]\s*/g, ', ')             // flèches → virgule (étaient lues "flèche...")
      .replace(/[()]/g, '')                       // parenthèses (étaient lues "parenthèse ouverte")
      .replace(/\s*\/\s*/g, ', ')                 // slash → virgule (pour les listes)
    // 3. Doubles points et points orphelins
    cleanText = cleanText.replace(/\.{2,}/g, '.').replace(/\s*\.\s*\./g, '.')
    cleanText = cleanText.replace(/^\s*\.\s*/, '').replace(/\s+\./g, '.')
    // 4. Multi-espaces → 1 seul
    cleanText = cleanText.replace(/\s{2,}/g, ' ').trim()
    // 5. Skip ponctuation isolée
    if (/^[.,!?;:\-]+$/.test(cleanText)) continue
    if (!cleanText) continue
    // v5.16 — Rollback du fix v5.14 "I → I am" : créait "le sujet est I am".
    // Le problème "capital I" sera traité en V6 par reformulation BDD systématique.
    const u = new SpeechSynthesisUtterance(cleanText)
    let v: SpeechSynthesisVoice | null = null
    if (seg.lang === 'en-GB') {
      v = getBestVoice('en')
    } else {
      v = getBestFrVoice()
    }
    if (v) { u.voice = v; u.lang = v.lang }
    else u.lang = seg.lang
    u.rate = 0.9
    u.pitch = 1
    window.speechSynthesis.speak(u)
  }
}

/** v5.16 — Rollback "I → I am" + préparation V6 (refonte complète à venir) */
export const TTS_VERSION = 'v5.16'
