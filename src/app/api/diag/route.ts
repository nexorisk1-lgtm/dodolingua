import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const allKeys = Object.keys(process.env).sort()

  const relevantKeys = allKeys.filter(k =>
    /groq|gemini|api|key|supabase/i.test(k)
  )

  const filteredKeys = allKeys.filter(k =>
    !k.startsWith('AWS_') &&
    !k.startsWith('LAMBDA_') &&
    !k.startsWith('_') &&
    !['HOME', 'USER', 'PWD', 'PATH', 'LANG', 'TZ', 'NODE_ENV'].includes(k)
  )

  const groqKey = process.env.GROQ_API_KEY
  const geminiKey = process.env.GEMINI_API_KEY

  return NextResponse.json({
    direct_reads: {
      GROQ_API_KEY_present: !!groqKey,
      GROQ_API_KEY_length: groqKey?.length || 0,
      GEMINI_API_KEY_present: !!geminiKey,
      GEMINI_API_KEY_length: geminiKey?.length || 0,
    },
    relevant_env_keys: relevantKeys,
    all_user_env_keys: filteredKeys,
    total_env_count: allKeys.length,
  })
}
