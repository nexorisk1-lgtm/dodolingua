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

export function speak(text: string, voiceName?: string | null, rate = 1) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  if (voiceName) {
    const v = window.speechSynthesis.getVoices().find(v => v.name === voiceName)
    if (v) { u.voice = v; u.lang = v.lang }
  } else {
    u.lang = 'en-GB'
  }
  u.rate = rate
  window.speechSynthesis.speak(u)
}
