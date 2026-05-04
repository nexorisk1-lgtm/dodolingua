/**
 * v3.9 — Abstraction TTS qui peut basculer entre :
 * - Web Speech API (gratuit, par défaut, voix navigateur)
 * - OpenAI TTS (premium, voix unifiée et naturelle, ~0.015$/1k chars)
 *
 * Pour activer OpenAI TTS :
 * 1. Ajouter OPENAI_API_KEY dans Vercel env vars
 * 2. Optionnel : OPENAI_TTS_VOICE (alloy, echo, fable, onyx, nova, shimmer)
 *    → voir https://platform.openai.com/docs/guides/text-to-speech
 *
 * Le code client appelle /api/tts qui retourne soit :
 * - { provider: 'web_speech' } → le client utilise window.speechSynthesis
 * - { provider: 'openai', audio_base64: '...' } → le client joue un Blob
 */

export interface TtsServerConfig {
  provider: 'web_speech' | 'openai'
  voice?: string
}

export function getTtsConfig(): TtsServerConfig {
  if (process.env.OPENAI_API_KEY) {
    return {
      provider: 'openai',
      voice: process.env.OPENAI_TTS_VOICE || 'alloy',
    }
  }
  return { provider: 'web_speech' }
}

/**
 * Synthétise du texte via OpenAI TTS et renvoie le buffer mp3.
 * À appeler depuis une route API serveur uniquement.
 */
export async function synthesizeOpenAI(text: string, voice = 'alloy'): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY non configurée')

  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',  // 'tts-1-hd' pour qualité supérieure
      voice,           // alloy, echo, fable, onyx, nova, shimmer
      input: text.slice(0, 4096),  // limit OpenAI : 4096 chars
      response_format: 'mp3',
    }),
  })

  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`OpenAI TTS ${res.status}: ${txt.slice(0, 200)}`)
  }
  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
