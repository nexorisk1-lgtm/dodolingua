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

  // v8.22 — Filtrer par langue AVANT de matcher par nom. Avant v8.22, une voix
  // française nommée "Daniel" (rare mais possible) ou un mauvais matching pouvait
  // faire choisir une voix non-EN. Maintenant, on impose lang.startsWith('en') sur
  // chaque voix candidate.
  for (const name of PREFERRED_VOICES) {
    const v = voices.find(v =>
      (v.name === name || v.name.includes(name)) &&
      v.lang.startsWith(langPrefix)
    )
    if (v) return v
  }
  // Fallback : voix de la bonne langue marquée "premium" ou "natural"
  const premium = voices.find(v =>
    v.lang.startsWith(langPrefix) &&
    /natural|premium|neural|enhanced/i.test(v.name)
  )
  if (premium) return premium
  // Dernier fallback : N'IMPORTE QUELLE voix de cette langue
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

// v8.4 — RENVERSEMENT : on passait par une BLACKLIST FR incomplète.
// Trop de mots FR sans accent étaient lus en EN ("personnages", "suis",
// "heureux", "parle"...). Au lieu de lister tous les mots FR possibles
// (infini), on liste la WHITELIST des mots EN A1 connus.
// Un token entre **xxx** est EN si TOUS ses mots sont dans cette liste.
// Sinon → FR par défaut.
// v8.20 — Whitelist EN A1 MASSIVEMENT étendue pour couvrir tous les mots des 48 cours
// (noms, verbes, adjectifs, adverbes courants). Avant v8.20, des mots simples comme
// "book", "car", "house", "apple" n'étaient pas reconnus → "a book" lu en voix FR.
const EN_A1_WORDS = new Set([
  // Pronoms
  'i', 'you', 'he', 'she', 'it', 'we', 'they',
  'me', 'him', 'her', 'us', 'them',
  // Possessifs
  'my', 'your', 'his', 'its', 'our', 'their',
  'mine', 'yours', 'hers', 'ours', 'theirs',
  // Verbe to be (présent + passé + base)
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  // Verbes auxiliaires courants
  'do', 'does', 'did', 'have', 'has', 'had',
  'can', 'could', 'will', 'would', 'should', 'may', 'might', 'must',
  'going',
  // Articles et déterminants
  'the', 'a', 'an', 'this', 'that', 'these', 'those',
  'some', 'any', 'no', 'every', 'all', 'each',
  // Conjonctions et prépositions
  'and', 'or', 'but', 'so', 'if', 'because',
  'to', 'of', 'in', 'on', 'at', 'with', 'for', 'from', 'by',
  'about', 'into', 'over', 'under', 'between', 'next', 'down', 'up',
  // Négation
  'not',
  // Mots-question
  'what', 'where', 'when', 'who', 'whose', 'why', 'how', 'which',
  // Politesse / interjections
  'yes', 'hello', 'hi', 'goodbye', 'bye', 'please', 'thank', 'thanks', 'sorry',
  // Adjectifs A1
  'happy', 'sad', 'tired', 'sick', 'busy', 'hungry', 'thirsty', 'cold',
  'good', 'bad', 'big', 'small', 'hot', 'warm', 'cool',
  'new', 'old', 'young', 'tall', 'short', 'long',
  'nice', 'kind', 'mean', 'funny', 'beautiful', 'strong', 'weak',
  'easy', 'hard', 'fast', 'slow', 'late', 'early',
  'ready', 'free', 'open', 'closed', 'full', 'empty',
  'french', 'english', 'spanish', 'german', 'italian', 'american',
  'red', 'blue', 'green', 'yellow', 'white', 'black', 'orange', 'pink', 'brown', 'gray', 'grey',
  // Adverbes A1
  'always', 'usually', 'often', 'sometimes', 'never',
  'now', 'today', 'yesterday', 'tomorrow', 'tonight', 'soon',
  'really', 'very', 'too', 'also',
  'here', 'there', 'everywhere', 'nowhere', 'somewhere',
  'fast', 'slowly', 'quickly', 'carefully', 'happily', 'easily', 'badly',
  'once', 'twice',
  'much', 'many', 'little', 'few', 'lot', 'lots',
  // Lieux A1
  'home', 'school', 'work', 'house', 'room', 'kitchen', 'bathroom', 'bedroom', 'garden',
  'park', 'store', 'shop', 'cafe', 'restaurant', 'office', 'street', 'city',
  'bank', 'library', 'hospital', 'hotel', 'beach', 'sea',
  'paris', 'london', 'rome',
  // Noms A1 - personnes
  'friend', 'friends', 'family', 'mother', 'father', 'mom', 'dad', 'parent', 'parents',
  'brother', 'sister', 'son', 'daughter', 'baby', 'babies',
  'boy', 'boys', 'girl', 'girls', 'man', 'men', 'woman', 'women', 'child', 'children',
  'people', 'person', 'student', 'students', 'teacher', 'teachers',
  // Noms A1 - objets
  'book', 'books', 'pen', 'pens', 'pencil', 'paper',
  'car', 'cars', 'bus', 'buses', 'bike', 'plane', 'train',
  'table', 'tables', 'chair', 'chairs', 'bed', 'door', 'doors', 'window', 'windows',
  'phone', 'computer', 'tv',
  'present', 'gift', 'ball', 'toy', 'game',
  'box', 'boxes', 'bag', 'bags',
  // Noms A1 - nourriture
  'food', 'apple', 'apples', 'egg', 'eggs', 'water', 'milk', 'coffee', 'tea',
  'bread', 'sandwich', 'pizza', 'cake', 'chocolate', 'candies', 'candy',
  'fruit', 'fruits', 'vegetable', 'vegetables', 'meat',
  // Noms A1 - corps
  'hand', 'hands', 'foot', 'feet', 'head', 'eye', 'eyes', 'mouth', 'hair',
  'nose', 'ear', 'ears', 'tooth', 'teeth',
  // Noms A1 - animaux
  'cat', 'cats', 'dog', 'dogs', 'bird', 'birds', 'fish', 'mouse', 'mice',
  'horse', 'cow', 'pig', 'animal', 'animals', 'elephant',
  // Noms A1 - temps
  'day', 'days', 'week', 'weeks', 'month', 'months', 'year', 'years', 'time',
  'morning', 'afternoon', 'evening', 'night', 'hour', 'minute',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
  'september', 'october', 'november', 'december',
  'saturday', 'spring', 'summer', 'autumn', 'fall', 'winter',
  // Noms A1 - autres
  'name', 'names', 'thing', 'things', 'place', 'places',
  'music', 'film', 'films', 'movie', 'movies', 'photo', 'photos', 'picture',
  'money', 'job', 'jobs', 'problem', 'idea', 'question', 'answer', 'story',
  'life', 'world', 'language', 'languages', 'word', 'words',
  'color', 'colour',
  'football', 'tennis', 'basketball', 'sport', 'sports',
  // Verbes A1 (base + 3e pers + -ing + passé réguliers)
  'go', 'goes', 'going', 'went',
  'come', 'comes', 'coming', 'came',
  'see', 'sees', 'seeing', 'saw',
  'know', 'knows', 'knowing', 'knew',
  'want', 'wants', 'wanting', 'wanted',
  'like', 'likes', 'liking', 'liked',
  'love', 'loves', 'loving', 'loved',
  'need', 'needs', 'needing', 'needed',
  'eat', 'eats', 'eating', 'ate',
  'drink', 'drinks', 'drinking', 'drank',
  'sleep', 'sleeps', 'sleeping', 'slept',
  'speak', 'speaks', 'speaking', 'spoke',
  'say', 'says', 'saying', 'said',
  'tell', 'tells', 'telling', 'told',
  'work', 'works', 'working', 'worked',
  'play', 'plays', 'playing', 'played',
  'read', 'reads', 'reading',
  'write', 'writes', 'writing', 'wrote',
  'study', 'studies', 'studying', 'studied',
  'watch', 'watches', 'watching', 'watched',
  'listen', 'listens', 'listening', 'listened',
  'talk', 'talks', 'talking', 'talked',
  'help', 'helps', 'helping', 'helped',
  'give', 'gives', 'giving', 'gave',
  'take', 'takes', 'taking', 'took',
  'make', 'makes', 'making', 'made',
  'run', 'runs', 'running', 'ran',
  'walk', 'walks', 'walking', 'walked',
  'swim', 'swims', 'swimming', 'swam',
  'sing', 'sings', 'singing', 'sang',
  'dance', 'dances', 'dancing', 'danced',
  'travel', 'travels', 'traveling', 'travelled', 'traveled',
  'think', 'thinks', 'thinking', 'thought',
  'feel', 'feels', 'feeling', 'felt',
  'look', 'looks', 'looking', 'looked',
  'find', 'finds', 'finding', 'found',
  'cook', 'cooks', 'cooking', 'cooked',
  'live', 'lives', 'living', 'lived',
  'open', 'opens', 'opening', 'opened',
  'close', 'closes', 'closing', 'closed',
  'shout', 'shouts', 'shouting', 'shouted',
  'worry', 'worries', 'worrying', 'worried',
  'smoke', 'smokes', 'smoking', 'smoked',
  'cry', 'cries', 'crying', 'cried',
  'spell', 'spells', 'spelling', 'spelled', 'spelt',
  'meet', 'meets', 'meeting', 'met',
  'put', 'puts', 'putting',
  'get', 'gets', 'getting', 'got',
  'sit', 'sits', 'sitting', 'sat',
  'stand', 'stands', 'standing', 'stood',
  'win', 'wins', 'winning', 'won',
  // Nombres
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
  'eighteen', 'nineteen', 'twenty', 'thirty', 'forty', 'fifty',
  'hundred', 'thousand', 'million',
  'first', 'second', 'third',
  // Contractions courantes
  "i'm", "you're", "he's", "she's", "it's", "we're", "they're",
  "isn't", "aren't", "wasn't", "weren't",
  "don't", "doesn't", "didn't", "won't", "can't", "couldn't",
  "i've", "you've", "he's", "she's", "we've", "they've",
  "i'd", "you'd", "he'd", "she'd", "we'd", "they'd",
  "i'll", "you'll", "he'll", "she'll", "we'll", "they'll",
  // Prénoms anglais courants en exemples
  'tom', "tom's", 'john', "john's", 'anna', "anna's", 'mary', 'paul', 'lucy',
  // Mots techniques cours (apostrophe s)
  "mother's", "father's", "sister's", "brother's", "dog's", "cat's", "friend's", "anna's", "john's", "tom's", "ben's",
])

export function isEnglishToken(token: string): boolean {
  const t = token.toLowerCase().trim().replace(/[.,!?;:]/g, '')
  if (!t) return false
  // Si le token contient des accents FR → FR direct
  if (/[éèêëàâäîïôöùûüçÿœæ]/i.test(t)) return false
  // Découper en mots et vérifier que TOUS sont dans la whitelist EN
  const words = t.split(/\s+/).filter(Boolean)
  if (words.length === 0) return false
  return words.every(w => EN_A1_WORDS.has(w))
}

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
  // v8.4 — primaryLang sert pour les segments de texte hors **xxx**.
  // La langue des tokens entre ** est désormais détectée via isEnglishToken().

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const part = text.slice(lastIndex, match.index).trim()
      if (part) segments.push({ text: part, lang: primaryLang })
    }
    const enWord = (match[1] || '').trim()
    // v5.7 — Pour une LISTE 'am / is / are' : on garde un SEUL segment EN avec virgules
    const cleaned = enWord.replace(/\s*\/\s*/g, ', ')

    // v8.4 — Détection inversée : WHITELIST EN au lieu de blacklist FR.
    // Un token est EN si TOUS ses mots sont des mots EN A1 connus.
    // Sinon → FR par défaut (indépendant du primaryLang).
    const isEN = isEnglishToken(cleaned)
    const segLang: 'fr-FR' | 'en-GB' = isEN ? 'en-GB' : 'fr-FR'

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
      // v8.4 — Remplacement de "=" par "veut dire" dans la lecture vocale.
      // Avant : TTS lisait "I am = je suis" comme "I am égal je suis" (bizarre).
      // Après : "I am veut dire je suis" (naturel).
      // S'applique côté FR uniquement (côté EN il faudrait "means", mais "=" est rare en contenu EN).
      if (seg.lang === 'fr-FR') {
        cleanText = cleanText.replace(/\s*=\s*/g, ' veut dire ')
      } else {
        cleanText = cleanText.replace(/\s*=\s*/g, ' means ')
      }
      // v6.1 — Fix "capital I" via homophone "eye"
      if (seg.lang === 'en-GB' && /^I[.,!?;:]?$/.test(cleanText)) {
        cleanText = 'eye'
      }

      // Lecture du segment
      await new Promise<void>((resolve) => {
        if (myId !== __sequenceId) { resolve(); return }
        let started = false
        let resolved = false
        const safeResolve = () => {
          if (resolved) return
          resolved = true
          resolve()
        }
        const u = new SpeechSynthesisUtterance(cleanText)
        let voice = seg.lang === 'en-GB' ? getBestVoice('en') : getBestFrVoice()
        const expectedPrefix = seg.lang === 'en-GB' ? 'en' : 'fr'
        // v8.23 — TRIPLE filet de sécurité pour garantir voix EN/FR :
        // 1. Si voice manquante ou mauvaise lang → chercher par lang dans toutes les voix
        if (!voice || !voice.lang.startsWith(expectedPrefix)) {
          const allVoices = window.speechSynthesis.getVoices()
          voice = allVoices.find(v => v.lang.startsWith(expectedPrefix)) || null
        }
        // 2. Si TOUJOURS pas de voix EN, forcer Daniel par nom explicite
        if (seg.lang === 'en-GB' && (!voice || !voice.lang.startsWith('en'))) {
          const allVoices = window.speechSynthesis.getVoices()
          voice = allVoices.find(v => /Daniel|Karen|Samantha|Aaron|Google.*English/i.test(v.name)) || null
        }
        // 3. Log debug pour identifier les cas pathologiques
        if (typeof console !== 'undefined') {
          const expected = seg.lang === 'en-GB' ? 'EN' : 'FR'
          const got = voice?.lang.startsWith('en') ? 'EN' : voice?.lang.startsWith('fr') ? 'FR' : '?'
          if (expected !== got) {
            console.warn(`[TTS] Voix MISMATCH pour "${cleanText}" — attendu ${expected}, obtenu ${got} (voice=${voice?.name || 'null'})`)
          }
        }
        if (voice) { u.voice = voice; u.lang = voice.lang }
        else u.lang = seg.lang
        u.rate = seg.rate ?? globalRate
        u.pitch = 1
        u.onstart = () => { started = true }
        u.onend = () => safeResolve()
        u.onerror = () => safeResolve()
        window.speechSynthesis.speak(u)
        // v8.3 — Workaround Chrome "stuck bug" (macOS) : si onstart n'est pas
        // déclenché dans 1.5s, l'utterance est probablement zombie. On cancel
        // et on resolve pour ne pas bloquer la séquence indéfiniment.
        setTimeout(() => {
          if (!started && !resolved) {
            try { window.speechSynthesis.cancel() } catch {}
            safeResolve()
          }
        }, 1500)
        // v8.3 — Max timeout absolu 30s par utterance (sécurité ultime).
        setTimeout(() => safeResolve(), 30000)
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

// v8.9 — Typage SpeechRecognition élargi pour exploiter toutes les alternatives
interface SRAlternative { transcript: string; confidence: number }
interface SRResult { length: number; isFinal?: boolean; [n: number]: SRAlternative }
interface SRResultList { length: number; [n: number]: SRResult }
interface SRResultEvent { results: SRResultList }

interface SpeechRecognitionInstance {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  continuous: boolean
  onresult: (event: SRResultEvent) => void
  onerror: () => void
  onend: () => void
  start(): void
  stop(): void
}
type SRConstructor = new () => SpeechRecognitionInstance

/** v8.9 — Normalisation pour comparaison tolérante : minuscules + expansion des
 *  contractions courantes + suppression de la ponctuation. */
function normalizeForCompare(s: string): string {
  return s.toLowerCase()
    .replace(/i'm/g, 'i am')
    .replace(/you're/g, 'you are')
    .replace(/he's/g, 'he is')
    .replace(/she's/g, 'she is')
    .replace(/it's/g, 'it is')
    .replace(/we're/g, 'we are')
    .replace(/they're/g, 'they are')
    .replace(/isn't/g, 'is not')
    .replace(/aren't/g, 'are not')
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * v8.9 — Démarre la reconnaissance vocale avec params optimisés pour francophones :
 * - lang 'en-US' (plus tolérant que 'en-GB' sur accent FR)
 * - maxAlternatives 3 (Chrome renvoie max 3 vraies alternatives)
 * - On compare l'attendu (normalisé) contre TOUTES les alternatives reçues
 *   et on retient le meilleur score. Si une alternative match exactement après
 *   normalisation (ex: "I'm" vs "I am"), on retourne 1.0.
 */
export function recognizeSpeech(expected: string, lang = 'en-US'): Promise<SpeechRecognitionResult> {
  return new Promise((resolve) => {
    const w = window as unknown as { SpeechRecognition?: SRConstructor; webkitSpeechRecognition?: SRConstructor }
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SR) return resolve({ transcript: '', similarity: 0, unsupported: true })
    const recognition = new SR()
    recognition.lang = lang
    recognition.interimResults = false
    recognition.maxAlternatives = 3
    recognition.continuous = false

    let resolved = false
    const safeResolve = (r: SpeechRecognitionResult) => {
      if (resolved) return
      resolved = true
      try { recognition.stop() } catch {}
      resolve(r)
    }

    const expectedNorm = normalizeForCompare(expected)

    recognition.onresult = (event) => {
      const result = event.results[0]
      let bestTranscript = result[0]?.transcript?.trim() || ''
      let bestSim = 0
      // v8.9 — On compare TOUTES les alternatives à l'attendu et on garde la meilleure
      for (let i = 0; i < result.length; i++) {
        const alt = result[i]
        if (!alt?.transcript) continue
        const altNorm = normalizeForCompare(alt.transcript)
        const sim = altNorm === expectedNorm ? 1.0 : computeSimilarity(altNorm, expectedNorm)
        if (sim > bestSim) {
          bestSim = sim
          bestTranscript = alt.transcript.trim()
        }
      }
      safeResolve({ transcript: bestTranscript, similarity: bestSim })
    }
    recognition.onerror = () => safeResolve({ transcript: '', similarity: 0 })
    recognition.onend = () => safeResolve({ transcript: '', similarity: 0 })

    try {
      recognition.start()
    } catch {
      safeResolve({ transcript: '', similarity: 0 })
    }
  })
}

/**
 * v8.9 — Similarité robuste pour reconnaissance vocale francophones.
 * Combine intersection de mots + similarité Levenshtein normalisée pour gérer
 * les variantes phonétiques courantes ("ay-em" pour "am", "wee" pour "we", etc.)
 */
function computeSimilarity(a: string, b: string): number {
  const normalize = (s: string) => s.replace(/[^a-zà-ÿ'\s]/gi, '').toLowerCase().trim()
  const sa = normalize(a)
  const sb = normalize(b)
  if (!sb) return 0
  if (sa === sb) return 1
  const wordsA = sa.split(/\s+/).filter(Boolean)
  const wordsB = sb.split(/\s+/).filter(Boolean)
  // Score 1 : intersection de mots
  const setB = new Set(wordsB)
  const wordMatches = wordsA.filter(w => setB.has(w)).length
  const wordScore = wordsB.length ? wordMatches / wordsB.length : 0
  // Score 2 : Levenshtein normalisé sur la chaîne complète (sans espaces)
  const charDist = levenshtein(sa.replace(/\s/g, ''), sb.replace(/\s/g, ''))
  const maxLen = Math.max(sa.length, sb.length) || 1
  const charScore = 1 - charDist / maxLen
  // On retourne le MAX des deux scores → tolérant à l'accent ET aux variantes phonétiques
  return Math.min(1, Math.max(wordScore, charScore))
}

/** Distance d'édition de Levenshtein (matrice classique) */
function levenshtein(a: string, b: string): number {
  if (!a.length) return b.length
  if (!b.length) return a.length
  const matrix: number[][] = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }
  return matrix[b.length][a.length]
}

/** v9.0.2 — Fix build : cast string sur current.phase ligne 112 de session/page.tsx
 *  pour passer le narrowing TS strict (les comparaisons à 'discovery'/'anchor'
 *  faisaient échouer le build Vercel sur v9.0 et v9.0.1). */
export const TTS_VERSION = 'v9.0.2'
