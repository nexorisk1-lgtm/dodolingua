import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const groqKey = process.env.GROQ_API_KEY
  const geminiKey = process.env.GEMINI_API_KEY

  const result: any = {
    env: {
      GROQ_API_KEY_present: !!groqKey,
      GROQ_API_KEY_length: groqKey?.length || 0,
      GEMINI_API_KEY_present: !!geminiKey,
      GEMINI_API_KEY_length: geminiKey?.length || 0,
    },
    tests: {},
  }

  if (groqKey) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: 'Say hello in 3 words' }],
          max_tokens: 10,
        }),
      })
      const txt = await res.text()
      result.tests.groq = { status: res.status, ok: res.ok, body: txt.slice(0, 400) }
    } catch (e: any) {
      result.tests.groq = { error: e.message }
    }
  } else {
    result.tests.groq = { error: 'No key in env' }
  }

  if (geminiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Say hello in 3 words' }] }],
            generationConfig: { maxOutputTokens: 10 },
          }),
        }
      )
      const txt = await res.text()
      result.tests.gemini = { status: res.status, ok: res.ok, body: txt.slice(0, 400) }
    } catch (e: any) {
      result.tests.gemini = { error: e.message }
    }
  } else {
    result.tests.gemini = { error: 'No key in env' }
  }

  return NextResponse.json(result)
}
