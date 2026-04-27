const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'

const PRIMARY_MODEL = 'llama-3.3-70b-versatile'

const FALLBACK_MODEL = 'llama-3.1-8b-instant'

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
    return await tryModel(FALLBACK_MODEL)
  }
}
