'use client'
import { speak } from '@/components/games/utils'

/**
 * v5 — Composant d'affichage d'une leçon de grammaire.
 *
 * Parse le champ rule_md (markdown léger avec sections `### Titre`) et rend
 * les sections avec une typographie hiérarchisée :
 *   - sous-titres en bleu/gras
 *   - "Position" renommée en "Où la positionner dans une phrase"
 *   - exemples séparés sur des lignes distinctes, chacune avec un bouton haut-parleur (TTS)
 */

interface GrammarLessonProps {
  titleFr: string
  ruleMd: string
  examples: { en: string; fr?: string }[]
  voiceName?: string | null
}

const SECTION_LABELS: Record<string, string> = {
  "Quand l'utiliser": "Quand l'utiliser",
  "Comment ça marche": "Comment ça marche",
  "Position": "Où la positionner dans une phrase",       // v5 — renommage demandé
  "Contractions": "Contractions courantes",
  "Astuce": "💡 Astuce",
  "Pièges": "⚠️ Pièges à éviter",
  "Exemples": "Exemples",
}

interface ParsedSection {
  heading: string
  body: string
}

function parseRuleMd(md: string): ParsedSection[] {
  const lines = md.split('\n')
  const sections: ParsedSection[] = []
  let current: ParsedSection | null = null
  for (const raw of lines) {
    const m = raw.match(/^#{2,4}\s+(.+)$/)
    if (m) {
      if (current) sections.push(current)
      current = { heading: m[1].trim(), body: '' }
    } else if (current) {
      current.body += raw + '\n'
    }
  }
  if (current) sections.push(current)
  return sections
}

function ExampleLine({ text, voiceName }: { text: string; voiceName?: string | null }) {
  return (
    <div className="flex items-center gap-2 py-1.5 px-3 bg-white border border-rule rounded-lg">
      <div className="flex-1 text-sm text-primary-900 font-medium">{text}</div>
      <button
        onClick={() => speak(text, voiceName)}
        aria-label={`Écouter : ${text}`}
        className="shrink-0 w-9 h-9 rounded-full bg-primary-50 text-primary-700 text-base hover:bg-primary-100"
      >
        🔊
      </button>
    </div>
  )
}

function SectionTitle({ heading }: { heading: string }) {
  // v5 — Sous-titres bleu/gras avec une barre verticale d'accent
  const label = SECTION_LABELS[heading] ?? heading
  return (
    <h3 className="flex items-center gap-2 mt-4 mb-2">
      <span className="inline-block w-1 h-5 bg-primary-500 rounded-full" aria-hidden />
      <span className="text-primary-700 font-bold uppercase tracking-wider text-xs">{label}</span>
    </h3>
  )
}

function isTipSection(heading: string) {
  return heading === 'Astuce' || heading.startsWith('💡')
}

export function GrammarLesson({ titleFr, ruleMd, examples, voiceName }: GrammarLessonProps) {
  const sections = parseRuleMd(ruleMd)

  // v5 — Extraire les phrases d'exemple inline contenues dans la règle, séparées par ". "
  // pour affichage en lignes individuelles avec TTS sur chaque.
  function splitInlineExamples(body: string): string[] {
    return body
      .split(/[.!?]\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 4 && /[a-zA-Z]/.test(s))
      .slice(0, 3) // max 3 par section pour éviter le bruit
  }

  return (
    <article className="space-y-3">
      <h2 className="text-xl font-bold text-primary-900">{titleFr}</h2>

      {sections.map((s, i) => {
        const tipBg = isTipSection(s.heading)
        return (
          <div key={i} className={tipBg ? 'border-l-4 border-amber-400 bg-amber-50 p-3 rounded-r-lg' : ''}>
            <SectionTitle heading={s.heading} />
            <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
              {s.body.trim()}
            </div>
          </div>
        )
      })}

      {examples.length > 0 && (
        <div>
          <SectionTitle heading="Exemples" />
          {/* v5 — Chaque exemple sur sa propre ligne + haut-parleur */}
          <div className="space-y-2">
            {examples.map((ex, i) => (
              <div key={i} className="space-y-1">
                <ExampleLine text={ex.en} voiceName={voiceName} />
                {ex.fr && (
                  <div className="text-xs italic text-gray-500 pl-3">→ {ex.fr}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  )
}
