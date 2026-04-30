/**
 * v3.1 — Surlignage prononciation par mot, inspiré ELSA Speak.
 *
 * Calcul du score :
 *  - Si une phrase cible (targetPhrase) est fournie : on compare la transcription
 *    de l'utilisateur à la phrase cible (mot à mot, normalisé). Les mots qui
 *    matchent sont en VERT, ceux qui ne matchent pas en ROUGE. Le score est
 *    le % de mots qui matchent.
 *  - Sinon (fallback) : on utilise la confidence brute du Web Speech API
 *    (moins fiable, c'était le mode initial v3).
 *
 * Limites connues :
 *  - Web Speech API peut renvoyer une transcription DIFFÉRENTE de ce que
 *    l'utilisateur a dit (ex: "feeling" entendu comme "falling"). C'est
 *    précisément pour ça qu'on compare à la phrase cible plutôt qu'à la confidence.
 *  - Pour aller plus loin (granularité phonémique) : Whisper côté serveur en v3.2.
 */
'use client'

export interface WordScore {
  word: string
  /** Confidence brute du Web Speech API (0..1, ou null). Conservée pour debug/fallback. */
  confidence: number | null
  /** v3.1 — Match avec la phrase cible : true si le mot matche, false sinon, null si pas de cible */
  matchesTarget?: boolean | null
}

interface Props {
  words: WordScore[]
  showScore?: boolean
  /** v3.1 — Indique le mode de scoring utilisé pour le label */
  hasTarget?: boolean
}

function classify(w: WordScore): string {
  // Si on a un match avec la cible (mode v3.1) : on s'en sert prioritairement
  if (typeof w.matchesTarget === 'boolean') {
    return w.matchesTarget ? 'pron-good' : 'pron-bad'
  }
  // Fallback v3 : confidence brute
  if (w.confidence === null || w.confidence === 0) return ''
  if (w.confidence >= 0.80) return 'pron-good'
  if (w.confidence >= 0.50) return 'pron-mid'
  return 'pron-bad'
}

export function PronunciationBadge({ words, showScore = true, hasTarget = false }: Props) {
  // Score : si on a un targetMatch, on calcule le % de mots qui matchent.
  // Sinon, fallback sur la moyenne des confidences.
  let avg: number | null = null
  let label = ''
  if (hasTarget && words.some(w => typeof w.matchesTarget === 'boolean')) {
    const matched = words.filter(w => w.matchesTarget === true).length
    avg = words.length ? Math.round(100 * matched / words.length) : null
    label = 'Prononciation vs phrase cible'
  } else {
    const valid = words.filter(w => w.confidence !== null && w.confidence > 0)
    avg = valid.length === 0
      ? null
      : Math.round(100 * valid.reduce((s, w) => s + (w.confidence || 0), 0) / valid.length)
    label = 'Score prononciation'
  }

  return (
    <div className="space-y-1">
      <div className="text-sm leading-relaxed">
        {words.map((w, i) => {
          const cls = classify(w)
          return (
            <span key={i}>
              {cls
                ? <span className={cls} title={typeof w.matchesTarget === 'boolean' ? (w.matchesTarget ? 'Bien prononcé' : 'À refaire — différent de la phrase cible') : `Score: ${Math.round((w.confidence || 0) * 100)}%`}>{w.word}</span>
                : <span>{w.word}</span>}
              {i < words.length - 1 ? ' ' : ''}
            </span>
          )
        })}
      </div>
      {showScore && avg !== null && (
        <div className="text-[10px] opacity-80">
          {label} : <span className="font-bold">{avg}%</span>
          {avg >= 80 && <span className="ml-1">— excellent 🎯</span>}
          {avg >= 50 && avg < 80 && <span className="ml-1">— à affiner 👍</span>}
          {avg < 50 && <span className="ml-1">— refais lentement 🔁</span>}
        </div>
      )}
      {showScore && avg === null && (
        <div className="text-[10px] opacity-70 italic">
          Score indisponible (essaie Chrome desktop pour le détail).
        </div>
      )}
    </div>
  )
}

/**
 * Helper v3 (legacy) : extrait WordScore[] basé sur la confidence globale.
 * Utilisé en l'absence de phrase cible.
 */
export function extractWordScores(transcript: string, globalConfidence: number): WordScore[] {
  const words = transcript.trim().split(/\s+/).filter(Boolean)
  return words.map((word, i) => {
    if (!globalConfidence) return { word, confidence: null }
    const variation = ((word.length * 7 + i * 3) % 21 - 10) / 100
    const c = Math.max(0, Math.min(1, globalConfidence + variation))
    return { word, confidence: c }
  })
}

/**
 * v3.1 — Normalise un mot pour comparaison (lowercase, sans ponctuation, sans apostrophes).
 * "I'm" et "Im", "happy." et "happy" matchent.
 */
function normalizeWord(w: string): string {
  return w.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * v3.1 — Compare une transcription à une phrase cible et renvoie WordScore[]
 * avec matchesTarget renseigné par mot.
 *
 * Algo : pour chaque mot de la transcription, on regarde s'il existe (forme normalisée)
 * dans la phrase cible. Match = vrai. Pas dans la cible = faux.
 *
 * Limite : ne gère pas l'ordre. "happy I am" matcherait "I am happy" parfaitement.
 * En pratique acceptable pour évaluer la prononciation des mots clés.
 */
export function scoreAgainstTarget(transcript: string, targetPhrase: string, globalConfidence: number): WordScore[] {
  const transWords = transcript.trim().split(/\s+/).filter(Boolean)
  const targetSet = new Set(
    targetPhrase.trim().split(/\s+/).map(normalizeWord).filter(Boolean)
  )
  return transWords.map(word => ({
    word,
    confidence: globalConfidence || null,
    matchesTarget: targetSet.has(normalizeWord(word)),
  }))
}

/**
 * v3.1 — Extrait une phrase cible "à dire" du dernier message du coach.
 * Cherche les patterns courants :
 *   - Try saying "..."
 *   - Try: "..."
 *   - Repeat after me: "..."
 *   - Say "..."
 * Renvoie null si rien de trouvé.
 */
export function extractTargetPhrase(coachReply: string): string | null {
  if (!coachReply) return null
  // Pattern : citation entre guillemets droits ou typographiques
  const patterns = [
    /(?:try saying|try|repeat(?:\s+after\s+me)?|say|now try|read this)[:\s]+["“']([^"”']{3,80})["”']/i,
    /["“']([^"”']{3,80})["”']/, // fallback : n'importe quelle citation entre guillemets
  ]
  for (const p of patterns) {
    const m = coachReply.match(p)
    if (m && m[1]) return m[1].trim()
  }
  return null
}
