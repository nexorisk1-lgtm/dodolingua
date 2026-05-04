/**
 * v3.10 — Abstraction STT (Speech-to-Text). Bascule entre :
 * - Web Speech API (gratuit, navigateur, mot-level confidence)
 * - Deepgram API (premium, phonème-level + IPA, ~$0.005/min)
 *
 * Pour activer Deepgram :
 * 1. Souscrire à Deepgram (https://deepgram.com)
 * 2. Ajouter DEEPGRAM_API_KEY dans Vercel env vars
 *
 * Quand activé, le client peut envoyer un audio Blob à /api/stt et recevoir
 * une transcription enrichie : phonèmes IPA + scoring par phonème.
 *
 * Pour l'instant, le client utilise toujours Web Speech API. Cette abstraction
 * est prête pour bascule future.
 */

export interface SttServerConfig {
  provider: 'web_speech' | 'deepgram'
}

export function getSttConfig(): SttServerConfig {
  if (process.env.DEEPGRAM_API_KEY) return { provider: 'deepgram' }
  return { provider: 'web_speech' }
}

export interface PhonemeScore {
  word: string
  phonemes: { ipa: string; score: number; start: number; end: number }[]
  confidence: number
}

/**
 * Transcrit un audio buffer via Deepgram avec phonèmes IPA.
 * À appeler depuis une route API serveur uniquement.
 */
export async function transcribeDeepgram(audioBuffer: Buffer, mime = 'audio/webm'): Promise<PhonemeScore[]> {
  const apiKey = process.env.DEEPGRAM_API_KEY
  if (!apiKey) throw new Error('DEEPGRAM_API_KEY non configurée')

  // Doc : https://developers.deepgram.com/docs/pre-recorded-audio
  // Note : phonemes nécessite Deepgram model 'whisper' ou 'nova-3' avec features avancées
  const url = 'https://api.deepgram.com/v1/listen?model=nova-3&language=en&punctuate=true&utterances=true'

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${apiKey}`,
      'Content-Type': mime,
    },
    body: audioBuffer,
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Deepgram ${res.status}: ${txt.slice(0, 200)}`)
  }
  const data = await res.json()
  // Parse vers PhonemeScore[]
  // Note : la réponse Deepgram a une structure {results.channels[0].alternatives[0].words[]}
  // Pour les phonèmes, il faudrait l'option phonetic_alphabet=ipa (quand dispo)
  // Pour le MVP, on retourne juste les words avec leur confidence
  const words = data?.results?.channels?.[0]?.alternatives?.[0]?.words || []
  return words.map((w: any) => ({
    word: w.punctuated_word || w.word,
    phonemes: [],  // TODO : récupérer phonèmes IPA quand Deepgram le supporte sur ce model
    confidence: w.confidence || 0,
  }))
}
