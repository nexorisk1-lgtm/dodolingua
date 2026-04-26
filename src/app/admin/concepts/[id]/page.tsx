import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'
import { ConceptImageManager } from './ConceptImageManager'

export default async function AdminConceptEditPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: concept } = await supabase
    .from('concepts').select('*').eq('id', params.id).single()
  if (!concept) notFound()

  const { data: translations } = await supabase
    .from('translations').select('*').eq('concept_id', params.id).order('lang_code')

  return (
    <Container className="max-w-4xl space-y-5">
      <Card>
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-bold text-primary-900">Concept</h1>
          <span className="text-xs text-gray-500 font-mono">{concept.id}</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
          <div><span className="text-gray-500 text-xs">Domaine</span><div className="font-semibold">{concept.domain}</div></div>
          <div><span className="text-gray-500 text-xs">CEFR min</span><div className="font-semibold">{concept.cefr_min}</div></div>
          <div><span className="text-gray-500 text-xs">Tags</span><div className="font-semibold text-xs">{(concept.tags ?? []).join(', ') || '—'}</div></div>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-bold text-primary-700 mb-3">Image (optionnelle)</h2>
        <ConceptImageManager
          conceptId={concept.id}
          initialUrl={concept.image_url}
          initialAlt={concept.image_alt}
          initialAttribution={concept.image_attribution}
        />
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-primary-700">Traductions</h2>
          <a href={`/admin/concepts/${concept.id}/translations`}
            className="text-sm text-primary-700 font-semibold hover:underline">Gérer →</a>
        </div>
        {translations && translations.length > 0 ? (
          <ul className="divide-y divide-rule">
            {translations.map(t => (
              <li key={t.id} className="py-2 flex items-center gap-3 text-sm">
                <span className="text-xs font-mono bg-primary-50 text-primary-700 px-2 py-1 rounded">{t.lang_code}</span>
                <span className="font-semibold flex-1">{t.lemma}</span>
                <span className="text-xs font-mono text-primary-500">{t.ipa || '—'}</span>
                {t.audio_url && <span className="text-xs">🔊</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">Aucune traduction enregistrée.</p>
        )}
      </Card>
    </Container>
  )
}
