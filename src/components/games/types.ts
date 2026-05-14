export interface GameWord {
  id: string
  lemma: string
  ipa?: string | null
  audio_url?: string | null
  image_url?: string | null
  image_alt?: string | null
  translation?: string | null
  example?: string | null
  /** v5 — Traduction française de la phrase exemple (utilisée par SentenceBuilder "Mise en contexte"). */
  example_fr?: string | null
}

export interface GameResult {
  correct: boolean
  hesitated?: boolean
  time_seconds?: number
  details?: unknown
}

export interface GameProps {
  words: GameWord[]
  voiceName?: string | null
  onResult: (result: GameResult) => void
  onComplete?: (results: GameResult[]) => void
  /** v5 — Callback pour mise en pause de la session ("Continuer plus tard"). */
  onPause?: (results: GameResult[]) => void
}

export const GAME_LIST = [
  { id: 'flashcards',     emoji: '🎴', name: 'Flashcards',         needsImage: false },
  { id: 'quiz',           emoji: '❓', name: 'Quiz',                needsImage: false },
  { id: 'dictation',      emoji: '📝', name: 'Dictée',              needsImage: false },
  { id: 'audio_recog',    emoji: '👂', name: 'Reconnaissance audio', needsImage: false },
  { id: 'association',    emoji: '🖼️', name: 'Association mot/image', needsImage: true  },
  { id: 'sentence',       emoji: '🧩', name: 'Sentence builder',    needsImage: false },
  { id: 'listening_cloze', emoji: '🎧', name: 'Listening cloze',     needsImage: false },
  { id: 'speaking_cloze', emoji: '🗣️', name: 'Speaking cloze',      needsImage: false },
  { id: 'memory',         emoji: '🧠', name: 'Memory pairs',        needsImage: false },
  { id: 'story',          emoji: '📖', name: 'Story choice',         needsImage: false },
  { id: 'phonetic',       emoji: '🔤', name: 'Phonetic challenge',   needsImage: false },
  { id: 'speed',          emoji: '⚡', name: 'Speed round',          needsImage: false },
] as const

export type GameId = typeof GAME_LIST[number]['id']
