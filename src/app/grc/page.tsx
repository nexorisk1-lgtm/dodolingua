import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'

const LEVELS = [
  { id: 'junior',   label: 'Junior',   emoji: '🌱', desc: 'Analyste 0-2 ans, contrôle 1er niveau', color: 'bg-green-50' },
  { id: 'confirme', label: 'Confirmé', emoji: '🔵', desc: '3-5 ans, manager opérationnel',         color: 'bg-blue-50' },
  { id: 'senior',   label: 'Senior',   emoji: '🟠', desc: 'Manager risques, audit interne',        color: 'bg-orange-50' },
  { id: 'expert',   label: 'Expert',   emoji: '🟣', desc: 'Directeur conformité, CRO, partner',    color: 'bg-purple-50' },
]

export default async function GrcPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: prefs } = user ? await supabase.from('user_preferences')
    .select('grc_enabled, grc_level').eq('user_id', user.id).single() : { data: null }

  const counts: Record<string, number> = {}
  for (const lvl of LEVELS) {
    const { count } = await supabase.from('concepts').select('*', { count: 'exact', head: true })
      .eq('domain', `grc_${lvl.id}`)
    counts[lvl.id] = count || 0
  }

  return (
    <Container className="space-y-4">
      <Card>
        <h1 className="text-2xl font-bold text-primary-900">🛡️ Module GRC</h1>
        <p className="text-sm text-gray-600 mt-1">
          Anglais métier pour gouvernance, risques et conformité. 4 niveaux.
        </p>
        {prefs?.grc_enabled ? (
          <div className="mt-3 inline-block px-3 py-1 bg-ok text-white text-xs font-bold rounded-full">
            Activé · {prefs.grc_level || 'à définir'}
          </div>
        ) : (
          <div className="mt-3 inline-block px-3 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded-full">
            Module non activé — voir Profil
          </div>
        )}
      </Card>

      <div className="grid sm:grid-cols-2 gap-3">
        {LEVELS.map(lvl => (
          <Card key={lvl.id} className={`!p-4 ${lvl.color}`}>
            <div className="flex items-start justify-between">
              <div className="text-3xl">{lvl.emoji}</div>
              <div className="text-xs font-bold text-primary-700 bg-white px-2 py-0.5 rounded-full">
                {counts[lvl.id]} termes
              </div>
            </div>
            <h2 className="font-bold text-lg mt-2 text-primary-900">{lvl.label}</h2>
            <p className="text-xs text-gray-700">{lvl.desc}</p>
            <Link href={`/grc/${lvl.id}`}
              className="mt-3 inline-block text-sm text-primary-700 font-semibold hover:underline">
              Explorer →
            </Link>
          </Card>
        ))}
      </div>
    </Container>
  )
}
