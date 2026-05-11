/**
 * v3.27.0 — Page Bibliothèque (avec carrousels flèches + badges Lu)
 */
import { createClient } from '@/lib/supabase/server'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'
import { LibraryCarousel } from '@/components/library/LibraryCarousel'

export const dynamic = 'force-dynamic'
export const revalidate = 0

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

  const { data: lang } = await supabase.from('user_languages')
    .select('cefr_global').eq('user_id', user.id).eq('is_current', true).maybeSingle()
  const userLevel = lang?.cefr_global || 'A1'

  const { data: books } = await supabase.from('books')
    .select('id, level, number, title, cover_url, word_count, estimated_minutes')
    .order('level').order('number')

  const { data: progressRows } = await supabase.from('user_book_progress')
    .select('book_id, status, progress_pct').eq('user_id', user.id)
  const progressMap: Record<string, any> = {}
  for (const p of (progressRows || [])) progressMap[p.book_id] = p

  const completedCount = Object.values(progressMap).filter((p: any) => p.status === 'completed').length

  // Grouper par niveau
  const byLevel: Record<string, any[]> = {}
  for (const b of (books || [])) {
    if (!byLevel[b.level]) byLevel[b.level] = []
    byLevel[b.level].push(b)
  }

  const orderedLevels = [userLevel, ...LEVEL_ORDER.filter(l => l !== userLevel)].filter(l => byLevel[l])

  return (
    <Container className="space-y-6 pb-24">
      <Card className="!py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-500">Ta bibliothèque</div>
            <h1 className="text-xl font-bold text-primary-900">📚 Mini-histoires</h1>
          </div>
          <div className="text-right">
            <div className="text-2xl">📖</div>
            <div className="text-xs text-gray-500">
              {completedCount > 0 ? `${completedCount} lu${completedCount > 1 ? 's' : ''} · ` : ''}
              {books?.length || 0} livres
            </div>
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          Lis des histoires courtes adaptées à ton niveau. Clique sur un mot pour sa traduction, écoute l'audio, et complète les exercices à la fin.
        </p>
      </Card>

      {orderedLevels.map(level => {
        const bks = byLevel[level] || []
        const isUserLevel = level === userLevel
        const levelCompleted = bks.filter(b => progressMap[b.id]?.status === 'completed').length
        return (
          <section key={level}>
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className={`text-sm font-bold ${isUserLevel ? 'text-primary-700' : 'text-gray-700'}`}>
                {isUserLevel && '⭐ '}{LEVEL_LABELS[level] || level}
              </h2>
              <span className="text-xs text-gray-500">
                {levelCompleted > 0 && `${levelCompleted} ✓ · `}{bks.length} livres
              </span>
            </div>
            <LibraryCarousel books={bks} progressMap={progressMap} />
          </section>
        )
      })}
    </Container>
  )
}
