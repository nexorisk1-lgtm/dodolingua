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
  // v6.1 — Fix DÉFINITIF "capital I" : Daniel/macOS épelle "I" comme une lettre.
  // Solution : utiliser l'homophone "eye" qui se prononce strictement /aɪ/
  // (identique au pronom "I"). Visuel inchangé, audio parfait.
  let textToSpeak = text
  if (!opts.lang || opts.lang.startsWith('en')) {
    if (/^I[.,!?;:]?$/.test(textToSpeak.trim())) textToSpeak = 'eye'
  }
  const u = new SpeechSynthesisUtterance(textToSpeak)

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

// v7.5 — Blacklist FR étendue : mots FR courants en A1 sans accent.
// Avant v7.5, "heureux", "parle", "toujours", "information" étaient lus en EN
// car pas dans la blacklist et pas d'accents pour les détecter.
const FR_WORDS = new Set([
  // Pronoms et déterminants
  'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles',
  'ce', 'cela', 'ça', 'cet', 'cette', 'ces',
  'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses',
  'notre', 'nos', 'votre', 'vos', 'leur', 'leurs',
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'd',
  // Conjonctions
  'et', 'ou', 'mais', 'donc', 'car', 'si', 'que', 'qui', 'quoi', 'dont',
  'comme', 'quand', 'parce',
  'oui', 'non',
  // Métalangage grammatical (sans accent)
  'pronoms', 'pronom', 'sujets', 'sujet', 'verbe', 'verbes', 'phrase', 'phrases',
  'mot', 'mots', 'forme', 'formes', 'base', 'exemple', 'exemples',
  'information', 'informations', 'info', 'infos',
  'contraction', 'contractions', 'auxiliaire',
  // Adverbes et quantifieurs sans accent
  'toujours', 'jamais', 'souvent', 'parfois', 'maintenant',
  'aussi', 'encore', 'presque', 'vraiment', 'surtout', 'tout', 'tous', 'toute', 'toutes',
  'bien', 'mal', 'bon', 'bonne', 'mauvais', 'mauvaise',
  'petit', 'petite', 'grand', 'grande',
  // Adjectifs FR A1 sans accent
  'heureux', 'heureuse', 'heureuses',
  'malade', 'malades', 'fatigant', 'content', 'contente',
  'fier', 'fiere', 'simple', 'simples',
  // Prépositions
  'avec', 'sans', 'pour', 'par', 'dans', 'sur', 'sous', 'entre', 'chez', 'vers',
  // Verbes très courants
  'parle', 'parler', 'parles', 'parlons', 'parlez', 'parlent',
  'dire', 'dit', 'dis', 'disent', 'disons',
  'voir', 'vois', 'voit', 'voient', 'voyons',
  'savoir', 'sais', 'sait', 'savent',
  'faire', 'fais', 'fait', 'font', 'faisons',
  'aller', 'va', 'vas', 'vont', 'allons',
  // Mots-outils pédago
  'astuce', 'truc', 'point',
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
    // v6.1 — Fix "capital I" via homophone "eye" (/aɪ/ = pronom I exact).
    // Visuel inchangé, son strictement identique au pronom anglais.
    if (seg.lang === 'en-GB' && /^I[.,!?;:]?$/.test(cleanText)) {
      cleanText = 'eye'
    }
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

// ===========================================================
// V6 — speakSequence : wrapper TTS avec pauses configurables
// ===========================================================
//
// Permet de chaîner audio FR/EN avec contrôle fin des pauses.
// Usage :
//   await speakSequence([
//     { text: "Voici la règle :", lang: 'fr-FR', pauseAfter: 2000 },
//     { text: "I am French", lang: 'en-GB', pauseAfter: 600 },
//     { text: "Je suis français", lang: 'fr-FR' }
//   ])
//
// Avantages vs speak() / speakMixed() :
//  - Pauses contrôlées entre segments (vs enchaînement sans respiration)
//  - Vitesse configurable globalement (mode oral 0.8, complet 0.9)
//  - Respect du brief V6 : 400-2000ms selon contexte

export interface SequenceSegment {
  text: string
  lang: 'fr-FR' | 'en-GB'
  /** Pause en ms APRÈS ce segment (default 400ms) */
  pauseAfter?: number
  /** Vitesse spécifique (sinon utilise rate global) */
  rate?: number
}

// v8.0 — Cancellation token : chaque speakSequence prend un ID au démarrage.
// stopSpeaking() incrémente __sequenceId. À chaque itération, on vérifie l'ID.
// Si changé → la séquence en cours abandonne immédiatement.
// Avant v8.0 : la boucle for async continuait à jouer les segments suivants
// même après stopSpeaking(), créant le bug de décalage audio entre étapes.
let __sequenceLock = false
let __sequenceId = 0

// v8.0 — Helper d'écoute "est-ce que le TTS est en train de parler"
// Permet aux composants UI de verrouiller "Suivant" pendant la lecture.
const __speakingListeners = new Set<(speaking: boolean) => void>()
export function onSpeakingChange(cb: (speaking: boolean) => void): () => void {
  __speakingListeners.add(cb)
  return () => __speakingListeners.delete(cb)
}
function __notifySpeaking(s: boolean) {
  __speakingListeners.forEach(cb => { try { cb(s) } catch {} })
}

/**
 * Lit une séquence de segments avec pauses entre chaque.
 * @param segments Liste des segments à lire
 * @param globalRate Vitesse par défaut (0.8 pour mode oral, 0.9 pour complet)
 */
export async function speakSequence(
  segments: SequenceSegment[],
  globalRate: number = 0.9
): Promise<void> {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  // v8.2 — Plus de blocage `if (__sequenceLock) return`. Au lieu de refuser
  // la nouvelle séquence, on force le reset de l'état (cancel + invalide
  // l'ancienne via __sequenceId) puis on démarre. Évite le cas où le lock
  // reste bloqué à true à cause d'un Promise.onend qui ne se déclenche
  // jamais (bug Chrome connu sur speechSynthesis.cancel()).
  window.speechSynthesis.cancel()
  __sequenceId++  // invalide toute séquence en cours
  __sequenceLock = true
  const myId = __sequenceId
  __notifySpeaking(true)

  try {
    await waitForVoices()
    if (myId !== __sequenceId) return  // v8.0 — abandonné entre temps
    // v8.2 — Workaround Chrome : si l'API reste en speaking:true après cancel,
    // un resume() puis pause() reset l'état interne. Sans effet si l'API est saine.
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      window.speechSynthesis.cancel()
    }
    await new Promise(r => setTimeout(r, 80))
    if (myId !== __sequenceId) return

    // v7.1 — Déplier chaque segment FR contenant des **xxx** en sous-segments alternés FR/EN
    const expanded: SequenceSegment[] = []
    for (const seg of segments) {
      if (seg.lang === 'en-GB' || !/\*\*[^*]+\*\*/.test(seg.text)) {
        expanded.push(seg)
        continue
      }
      const sub = parseMixedText(seg.text, seg.lang)
      sub.forEach((s, idx) => {
        expanded.push({
          text: s.text,
          lang: s.lang,
          rate: seg.rate,
          pauseAfter: idx === sub.length - 1 ? seg.pauseAfter : 200,
        })
      })
    }

    for (let i = 0; i < expanded.length; i++) {
      if (myId !== __sequenceId) return  // v8.0 — abandon avant chaque segment
      const seg = expanded[i]
      let cleanText = seg.text.replace(/\*\*/g, '').trim()
      // v8.0 — Filtre ponctuation isolée (point, virgule seuls = bruit parasite)
      if (/^[.,!?;:\-\s]*$/.test(cleanText)) continue
      if (!cleanText) continue
      // v6.1 — Fix "capital I" via homophone "eye"
      if (seg.lang === 'en-GB' && /^I[.,!?;:]?$/.test(cleanText)) {
        cleanText = 'eye'
      }

      // Lecture du segment
      await new Promise<void>((resolve) => {
        if (myId !== __sequenceId) { resolve(); return }
        const u = new SpeechSynthesisUtterance(cleanText)
        const voice = seg.lang === 'en-GB' ? getBestVoice('en') : getBestFrVoice()
        if (voice) { u.voice = voice; u.lang = voice.lang }
        else u.lang = seg.lang
        u.rate = seg.rate ?? globalRate
        u.pitch = 1
        u.onend = () => resolve()
        u.onerror = () => resolve()
        window.speechSynthesis.speak(u)
      })

      if (myId !== __sequenceId) return  // v8.0 — abandon après le segment
      const pause = seg.pauseAfter ?? 400
      if (i < expanded.length - 1 && pause > 0) {
        await new Promise(r => setTimeout(r, pause))
      }
    }
  } finally {
    // v8.2 — Libère le lock systématiquement si c'est ma séquence.
    // Si invalidée par une autre (myId !== __sequenceId), c'est cette autre
    // séquence qui contrôle le lock — on ne touche à rien.
    if (myId === __sequenceId) {
      __sequenceLock = false
      __notifySpeaking(false)
    }
  }
}

/** Stop immédiat de toute lecture en cours (invalide les sequences async actives) */
export function stopSpeaking(): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  __sequenceLock = false
  __sequenceId++  // v8.0 — invalide toute speakSequence en cours
  __notifySpeaking(false)
}

// ===========================================================
// V7.1 — Speech Recognition pour l'étape "repeat"
// Permet à l'utilisateur d'enregistrer sa voix et de comparer
// avec le modèle EN (texte attendu). Compatible Chrome/Edge.
// ===========================================================

export interface SpeechRecognitionResult {
  transcript: string
  /** Score entre 0 et 1, basé sur la similarité avec l'attendu */
  similarity: number
  /** True si le navigateur ne supporte pas */
  unsupported?: boolean
}

// v7.4 — Typage minimal de SpeechRecognition (pas dans lib.dom.d.ts pour webkit*)
interface SpeechRecognitionInstance {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: (event: { results: { 0: { transcript: string } }[] }) => void
  onerror: () => void
  onend: () => void
  start(): void
}
type SRConstructor = new () => SpeechRecognitionInstance

/** Démarre la reconnaissance vocale et retourne ce qui a été entendu. */
export function recognizeSpeech(expected: string, lang = 'en-GB'): Promise<SpeechRecognitionResult> {
  return new Promise((resolve) => {
    // v7.4 — Cast TypeScript propre (la directive précédente était devenue unused en TS strict moderne)
    const w = window as unknown as { SpeechRecognition?: SRConstructor; webkitSpeechRecognition?: SRConstructor }
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SR) return resolve({ transcript: '', similarity: 0, unsupported: true })
    const recognition = new SR()
    recognition.lang = lang
    recognition.interimResults = false
    recognition.maxAlternatives = 3

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim()
      resolve({
        transcript,
        similarity: computeSimilarity(transcript.toLowerCase(), expected.toLowerCase()),
      })
    }
    recognition.onerror = () => resolve({ transcript: '', similarity: 0 })
    recognition.onend = () => { /* géré par onresult/onerror */ }

    try {
      recognition.start()
    } catch {
      resolve({ transcript: '', similarity: 0 })
    }
  })
}

/** Calcule une similarité simple basée sur les mots communs (0 à 1). */
function computeSimilarity(a: string, b: string): number {
  const normalize = (s: string) => s.replace(/[^a-zÀ-ſ'\s]/gi, '').toLowerCase().trim()
  const wordsA = normalize(a).split(/\s+/).filter(Boolean)
  const wordsB = normalize(b).split(/\s+/).filter(Boolean)
  if (wordsB.length === 0) return 0
  const setB = new Set(wordsB)
  const matches = wordsA.filter(w => setB.has(w)).length
  return Math.min(1, matches / wordsB.length)
}

/** v8.2 — Fix audio bloqué (lock persistant). Plus de blocage if(lock) return.
 *  Reset défensif + cancel + invalidation de l'ancienne séquence avant nouvelle. */
export const TTS_VERSION = 'v8.2'
