import { NextRequest, NextResponse } from 'next/server'
import { askGemini } from '@/lib/gemini'

// v1.5 — Ponctuation des transcripts STT (multi-phrases) via Gemini.
// Renvoie un texte ponctué, capitalisé, segmenté en phrases si nécessaire.
// Garde le sens et les mots — n'ajoute QUE de la ponctuation et capitalisation.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const raw = String(body.text || '').trim()
    if (!raw) return NextResponse.json({ text: '' })
    if (raw.length > 1000) return NextResponse.json({ text: raw }) // safety: skip huge

    const lang = body.lang || 'en-GB'
    const prompt = `Add proper punctuation and capitalization to the following speech-to-text transcript. Rules:
- Keep ALL words exactly as they are. Do NOT add or remove words.
- Add commas, periods, question marks, exclamation marks where natural.
- Capitalize the first letter of each sentence.
- Add apostrophes where missing (e.g., "dont" -> "don't").
- Output ONLY the punctuated text, nothing else. No quotes, no preamble, no explanation.

Language: ${lang}
Transcript: ${raw}

Punctuated:`

    const punctuated = await askGemini(
      [{ role: 'user', text: prompt }],
      { temperature: 0.1, maxOutputTokens: 200 }
    )
    // Garde-fous : si Gemini renvoie quelque chose d'aberrant (très différent en taille), fallback
    const cleaned = punctuated.trim().replace(/^["']|["']$/g, '')
    if (cleaned.length === 0 || cleaned.length > raw.length * 2) {
      return NextResponse.json({ text: raw, fallback: true })
    }
    return NextResponse.json({ text: cleaned })
  } catch (e: any) {
    // En cas d'erreur Gemini, on renvoie le texte brut sans casser l'UX
    return NextResponse.json({ text: '', error: e?.message?.slice(0, 200) }, { status: 200 })
  }
}
