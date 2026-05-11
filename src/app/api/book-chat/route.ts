/**
 * v3.30.0 — Endpoint /api/book-chat
 * Mini conversation IA après lecture d'un livre.
 * - GET : génère 3 questions ouvertes sur l'histoire (en français, niveau adapté)
 * - POST : continue la conversation
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { askGroq } from '@/lib/groq'

const SYSTEM_PROMPT_QUESTIONS = `
You are Dodo, a friendly French-speaking language coach who just finished reading a short English story with the learner.
You will receive the story title and content. Generate exactly 3 short, open-ended discussion questions in FRENCH about the story:
- 1 about the character's feelings or situation
- 1 about what the learner would do in the same situation
- 1 about a personal experience related to the theme

Output ONLY a JSON array of 3 strings, nothing else. Example:
["Comment Tom se sent-il au début ?", "Que ferais-tu à sa place ?", "Tu as déjà eu une journée comme celle-ci ?"]
`.trim()

const SYSTEM_PROMPT_CHAT = `
You are Dodo, a warm, encouraging French-speaking language coach. The learner just finished reading a short English story.
- Reply in FRENCH (their native language) — short, friendly, 1-2 sentences max.
- React positively to their answer, then ask ONE short follow-up question to keep the conversation going.
- Use simple, warm language. No correction of their English unless asked.
- Stay focused on the story or their feelings — don't get off-topic.
`.trim()

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const mode = body.mode || 'chat'
  const bookId = body.book_id
  if (!bookId) return NextResponse.json({ error: 'book_id required' }, { status: 400 })

  // Charger le livre pour avoir le contexte
  const { data: book } = await supabase.from('books')
    .select('title, content, level').eq('id', bookId).maybeSingle()
  if (!book) return NextResponse.json({ error: 'book not found' }, { status: 404 })

  const storyContext = `Story title: "${book.title}"\nStory (level ${book.level}):\n${(book.content as string[]).join('\n\n').slice(0, 1500)}`

  try {
    if (mode === 'questions') {
      // Générer 3 questions
      const raw = await askGroq(
        [{ role: 'user', text: storyContext }],
        { systemPrompt: SYSTEM_PROMPT_QUESTIONS, temperature: 0.6, maxOutputTokens: 250 },
      )
      // Tenter de parser le JSON
      let questions: string[] = []
      try {
        const match = raw.match(/\[[^\]]*\]/s)
        if (match) questions = JSON.parse(match[0])
      } catch {}
      if (questions.length === 0) {
        questions = [
          `Comment ${book.title.split(' ')[0]} se sent-il dans cette histoire ?`,
          'Que ferais-tu à sa place ?',
          'Tu as déjà vécu une situation similaire ?',
        ]
      }
      return NextResponse.json({ questions: questions.slice(0, 3) })
    }

    // mode = chat : répondre à un message
    const userMessage = (body.message || '').toString().slice(0, 500)
    const history = (Array.isArray(body.history) ? body.history : []).slice(-6)
    const messages = [
      { role: 'user' as const, text: storyContext },
      ...history.map((h: any) => ({ role: h.role === 'assistant' ? ('assistant' as const) : ('user' as const), text: String(h.text || '').slice(0, 400) })),
      { role: 'user' as const, text: userMessage },
    ]
    const reply = await askGroq(messages, {
      systemPrompt: SYSTEM_PROMPT_CHAT,
      temperature: 0.5,
      maxOutputTokens: 150,
    })
    return NextResponse.json({ reply: reply.trim() })
  } catch (e: any) {
    return NextResponse.json({ error: 'chat failed', details: e.message?.slice(0, 100) }, { status: 503 })
  }
}
