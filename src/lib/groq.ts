/**
 * Client Groq — OpenAI GPT-OSS 20B (rapide, pas cher) avec fallback 120B (qualité).
 * Les modèles Llama ont été reclassés Enterprise par Groq en 2026 ; GPT-OSS
 * reste accessible aux comptes standards. Pricing extrêmement bas (<1 $/mois
 * pour usage perso raisonnable). Compte Groq avec crédit free initial ou
 * payment method.
 * API compatible OpenAI.
 */

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
// v9.118 — Primaire = 120B (meilleur sur C1/C2/business), fallback = 20B (rapide, moins cher)
const PRIMARY_MODEL = 'openai/gpt-oss-120b'     // 500 t/s, intelligent (C1/C2/pro)
const FALLBACK_MODEL = 'openai/gpt-oss-20b'     // 1000 t/s, rapide (fallback)

export interface GroqMessage {
  role: 'user' | 'model'
  text: string
}

export interface GroqOptions {
  systemPrompt?: string
  temperature?: number
  maxOutputTokens?: number
}

export async function askGroq(messages: GroqMessage[], opts: GroqOptions = {}): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY non défini')

  const oaiMessages: { role: string; content: string }[] = []
  if (opts.systemPrompt) {
    oaiMessages.push({ role: 'system', content: opts.systemPrompt })
  }
  for (const m of messages) {
    oaiMessages.push({
      role: m.role === 'model' ? 'assistant' : 'user',
      content: m.text,
    })
  }

  async function tryModel(model: string): Promise<string> {
    const res = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: oaiMessages,
        max_tokens: opts.maxOutputTokens ?? 300,
        temperature: opts.temperature ?? 0.7,
      }),
    })
    if (!res.ok) {
      const txt = await res.text()
      throw new Error(`Groq ${model} ${res.status}: ${txt.slice(0, 200)}`)
    }
    const data = await res.json()
    return data?.choices?.[0]?.message?.content || '…'
  }

  try {
    return await tryModel(PRIMARY_MODEL)
  } catch (e1) {
    // Fallback sur 8B Instant si 70B rate-limite ou tombe
    return await tryModel(FALLBACK_MODEL)
  }
}
