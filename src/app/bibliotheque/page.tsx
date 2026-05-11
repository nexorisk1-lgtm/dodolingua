/**
 * v3.26.0 — Page Bibliothèque
 * Affiche les 450 livres groupés par niveau CECRL.
 * Le niveau actif de l'utilisateur est mis en avant.
 */
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Book {
  id: string
  level: string
  number: number
  title: string
  cover_url: string | null
  word_count: number | null
  estimated_minutes: number | null
}

const LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C1+', 'C2']
const LEVEL_LABELS: Record<string, string> = {
  'A1': 'A1 — Elementary',
  'A2': 'A2 — Pre-intermediate',
  'B1': 'B1 — Intermediate',
  'B2': 'B2 — Upper-intermediate',
  'C1': 'C1 — Advanced',
  'C1+': 'C1+ — Advanced+',
  'C2': 'C2 — Proficiency',
}

export default async function BibliothequePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Niveau actuel de l'utilisateur
  const { data: lang } = await supabase.from('user_languages')
    .select('cefr_global').eq('user_id', user.id).eq('is_current', true).maybeSingle()
  const userLevel = lang?.cefr_global || 'A1'

  // Tous les livres
  const { data: books } = await supabase.from('books')
    .select('id, level, number, title, cover_url, word_count, estimated_minutes')
    .order('level').order('number')

  // Progression
  const { data: progressRows } = await supabase.from('user_book_progress')
    .select('book_id, status, progress_pct').eq('user_id', user.id)
  const progressMap: Record<string, any> = {}
  for (const p of (progressRows || [])) progressMap[p.book_id] = p

  // Grouper par niveau
  const byLevel: Record<string, Book[]> = {}
  for (const b of (books || [])) {
    if (!byLevel[b.level]) byLevel[b.level] = []
    byLevel[b.level].push(b as Book)
  }

  // Ordre : niveau actuel d'abord, puis ordre CECRL
  const orderedLevels = [
    userLevel,
    ...LEVEL_ORDER.filter(l => l !== userLevel)
  ].filter(l => byLevel[l])

  return (
    <Container className="space-y-6 pb-24">
      {/* Header */}
      <Card className="!py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-500">Ta bibliothèque</div>
            <h1 className="text-xl font-bold text-primary-900">📚 Mini-histoires</h1>
          </div>
          <div className="text-right">
            <div className="text-2xl">📖</div>
            <div className="text-xs text-gray-500">{books?.length || 0} livres</div>
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          Lis des histoires courtes adaptées à ton niveau. Clique sur un mot pour sa traduction.
        </p>
      </Card>

      {/* Sections par niveau */}
      {orderedLevels.map(level => {
        const bks = byLevel[level] || []
        const isUserLevel = level === userLevel
        return (
          <section key={level}>
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className={`text-sm font-bold ${isUserLevel ? 'text-primary-700' : 'text-gray-700'}`}>
                {isUserLevel && '⭐ '}{LEVEL_LABELS[level] || level}
              </h2>
              <span className="text-xs text-gray-500">{bks.length} livres</span>
            </div>

            {/* Carrousel horizontal */}
            <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 snap-x snap-mandatory scroll-smooth"
                 style={{ scrollbarWidth: 'thin' }}>
              {bks.map(book => {
                const prog = progressMap[book.id]
                const isCompleted = prog?.status === 'completed'
                const isReading = prog?.status === 'reading'
                return (
                  <Link
                    key={book.id}
                    href={`/bibliotheque/${book.id}` as any}
                    className="shrink-0 snap-start w-32 group"
                  >
                    <div className="relative rounded-xl overflow-hidden bg-gray-100 shadow-md aspect-[2/3] transition-transform group-hover:scale-105">
                      {book.cover_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={book.cover_url}
                          alt={book.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl bg-gradient-to-br from-primary-100 to-primary-200">
                          📖
                        </div>
                      )}
                      {/* Badge progression */}
                      {isCompleted && (
                        <div className="absolute top-1 right-1 bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          ✓
                        </div>
                      )}
                      {isReading && (
                        <div className="absolute top-1 right-1 bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          {prog.progress_pct}%
                        </div>
                      )}
                      {/* Numéro */}
                      <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                        #{book.number}
                      </div>
                    </div>
                    <div className="mt-1.5">
                      <div className="text-[11px] font-bold text-primary-900 line-clamp-2 leading-tight">
                        {book.title}
                      </div>
                      {book.estimated_minutes && (
                        <div className="text-[10px] text-gray-500 mt-0.5">
                          📖 {book.estimated_minutes} min · {book.word_count} mots
                        </div>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )
      })}
    </Container>
  )
}
