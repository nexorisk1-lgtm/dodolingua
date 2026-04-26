import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'

const VALID = ['junior', 'confirme', 'senior', 'expert'] as const

export default async function GrcLevelPage({ params }: { params: { level: string } }) {
  if (!VALID.includes(params.level as any)) notFound()
  const supabase = createClient()

  const { data: terms } = await supabase
    .from('concepts').select('id, translations(lemma, ipa)')
    .eq('domain', `grc_${params.level}`).limit(50)

  const { data: scenarios } = await supabase
    .from('scenarios').select('*')
    .eq('grc_level', params.level)

  return (
    <Container className="max-w-3xl space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold text-primary-900">GRC · {params.level}</h1>
        <Link href="/grc" className="text-sm text-gray-500 hover:underline">← Tous les niveaux</Link>
      </div>

      <Card>
        <h2 className="font-bold text-primary-700 mb-3">Glossaire ({terms?.length || 0} termes)</h2>
        <div className="grid sm:grid-cols-2 gap-2">
          {(terms || []).map((t: any) => (
            <div key={t.id} className="border border-rule rounded-lg p-2.5">
              <div className="font-semibold">{t.translations?.[0]?.lemma}</div>
              <div className="text-xs text-primary-500 font-mono">{t.translations?.[0]?.ipa || ''}</div>
            </div>
          ))}
        </div>
      </Card>

      {(scenarios?.length || 0) > 0 && (
        <Card>
          <h2 className="font-bold text-primary-700 mb-3">Scénarios</h2>
          <ul className="space-y-2">
            {scenarios?.map((s: any) => (
              <li key={s.id} className="border border-rule rounded-lg p-3">
                <div className="font-semibold">{s.title}</div>
                <div className="text-xs text-gray-500">CEFR {s.cefr} · {(s.steps_json || []).length} étapes</div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <p className="text-sm text-gray-600">
          Pratique ce vocabulaire via le coach IA en mode <b>Expert GRC</b> :
        </p>
        <Link href="/coach" className="mt-2 inline-block text-primary-700 font-semibold hover:underline text-sm">
          Aller au coach →
        </Link>
      </Card>
    </Container>
  )
}
