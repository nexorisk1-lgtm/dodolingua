import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'

export default async function AdminHome() {
  const supabase = createClient()
  const { count: totalConcepts } = await supabase
    .from('concepts').select('*', { count: 'exact', head: true })
  const { count: withImage } = await supabase
    .from('concepts').select('*', { count: 'exact', head: true })
    .not('image_url', 'is', null)

  return (
    <Container className="max-w-5xl space-y-6">
      <Card>
        <h1 className="text-2xl font-bold text-primary-900">Tableau de bord admin</h1>
        <p className="text-sm text-gray-600 mt-1">
          Gestion du contenu pédagogique. Tous les utilisateurs peuvent lire le contenu publié.
          Seuls les administrateurs peuvent l&apos;éditer.
        </p>
      </Card>

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <div className="text-xs uppercase text-gray-500 font-bold tracking-wider">Concepts</div>
          <div className="text-3xl font-extrabold text-primary-700">{totalConcepts ?? 0}</div>
          <Link href="/admin/concepts" className="text-sm text-primary-700 hover:underline mt-2 inline-block">
            Gérer →
          </Link>
        </Card>
        <Card>
          <div className="text-xs uppercase text-gray-500 font-bold tracking-wider">Avec image</div>
          <div className="text-3xl font-extrabold text-primary-700">
            {withImage ?? 0}
            <span className="text-base text-gray-500">/{totalConcepts ?? 0}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Optionnel — UX fluide sans image</p>
        </Card>
        <Card>
          <div className="text-xs uppercase text-gray-500 font-bold tracking-wider">Stockage</div>
          <div className="text-3xl font-extrabold text-primary-700">~ 0 MB</div>
          <p className="text-xs text-gray-500 mt-1">/ 1 GB Supabase Free</p>
        </Card>
      </div>
    </Container>
  )
}
