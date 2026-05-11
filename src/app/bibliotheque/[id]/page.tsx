/**
 * v3.26.0 — Page Reader (lecture d'un livre)
 * Server Component qui charge un livre + Client Component pour la pagination.
 */
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BookReader } from '@/components/library/BookReader'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export default async function ReaderPage({ params }: Props) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: book } = await supabase
    .from('books')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (!book) notFound()

  // Récupérer ou initialiser la progression
  const { data: progress } = await supabase
    .from('user_book_progress')
    .select('*')
    .eq('user_id', user.id)
    .eq('book_id', book.id)
    .maybeSingle()

  return <BookReader book={book as any} initialProgress={progress as any} />
}
