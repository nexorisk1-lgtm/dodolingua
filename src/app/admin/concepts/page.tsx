import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'
import { ConceptImage } from '@/components/ConceptImage'

export default async function AdminConceptsListPage() {
  const supabase = createClient()
  const { data: concepts } = await supabase
    .from('v_concepts_with_image')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  return (
    <Container className="max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary-900">Concepts</h1>
        <Link href="/admin/concepts/new" className="text-sm font-semibold text-primary-700 hover:underline">
          + Nouveau concept
        </Link>
      </div>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-primary-50 text-primary-900 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3">Image</th>
              <th className="text-left px-4 py-3">Domaine</th>
              <th className="text-left px-4 py-3">CEFR</th>
              <th className="text-left px-4 py-3">Tags</th>
              <th className="text-left px-4 py-3">Traductions</th>
              <th className="text-right px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {(concepts ?? []).map((c: any) => (
              <tr key={c.id} className="border-t border-rule">
                <td className="px-4 py-2">
                  {c.image_url ? (
                    <ConceptImage url={c.image_url} alt={c.image_alt} variant="thumb" />
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-2">{c.domain}</td>
                <td className="px-4 py-2">{c.cefr_min}</td>
                <td className="px-4 py-2 text-xs text-gray-600">
                  {(c.tags ?? []).join(', ')}
                </td>
                <td className="px-4 py-2">{c.translation_count}</td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/admin/concepts/${c.id}`}
                    className="text-primary-700 hover:underline text-xs font-semibold">
                    Éditer →
                  </Link>
                </td>
              </tr>
            ))}
            {(!concepts || concepts.length === 0) && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Aucun concept.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </Container>
  )
}
