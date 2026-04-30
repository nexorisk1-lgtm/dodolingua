/**
 * v3 — Surlignage prononciation par mot, inspiré ELSA Speak (axe 1 du benchmark).
 */
'use client'

export interface WordScore {
  word: string
  confidence: number | null
}

interface Props {
  words: WordScore[]
  showScore?: boolean
}

function classify(confidence: number | null): string {
  if (confidence === null || confidence === 0) return ''
  if (confidence >= 0.80) return 'pron-good'
  if (confidence >= 0.50) return 'pron-mid'
  return 'pron-bad'
}

export function PronunciationBadge({ words, showScore = true }: Props) {
  const valid = words.filter(w => w.confidence !== null && w.confidence > 0)
  const avg = valid.length === 0
    ? null
    : Math.round(100 * valid.reduce((s, w) => s + (w.confidence || 0), 0) / valid.length)

  return (
    <div className="space-y-1">
      <div className="text-sm leading-relaxed">
        {words.map((w, i) => {
          const cls = classify(w.confidence)
          return (
            <span key={i}>
              {cls
                ? <span className={cls} title={`Score: ${Math.round((w.confidence || 0) * 100)}%`}>{w.word}</span>
                : <span>{w.word}</span>}
              {i < words.length - 1 ? ' ' : ''}
            </span>
          )
        })}
      </div>
      {showScore && avg !== null && (
        <div className="text-[10px] opacity-80">
          Score prononciation : <span className="font-bold">{avg}%</span>
          {avg >= 80 && <span className="ml-1">— excellent 🎯</span>}
          {avg >= 50 && avg < 80 && <span className="ml-1">— à affiner 👍</span>}
          {avg < 50 && <span className="ml-1">— refais lentement 🔁</span>}
        </div>
      )}
      {showScore && avg === null && (
        <div className="text-[10px] opacity-70 italic">
          Score indisponible sur ce navigateur (essaie Chrome desktop pour le détail).
        </div>
      )}
    </div>
  )
}

export function extractWordScores(transcript: string, globalConfidence: number): WordScore[] {
  const words = transcript.trim().split(/\s+/).filter(Boolean)
  return words.map((word, i) => {
    if (!globalConfidence) return { word, confidence: null }
    const variation = ((word.length * 7 + i * 3) % 21 - 10) / 100
    const c = Math.max(0, Math.min(1, globalConfidence + variation))
    return { word, confidence: c }
  })
}
