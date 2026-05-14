'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'
import { createClient } from '@/lib/supabase/client'

interface Topic {
  id: string
  level: string
  slug: string
  position: number
  title_fr: string
  emoji: string | null
}

type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
const LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

/**
 * v5 — Liste des leçons de grammaire par niveau CECRL.
 * Affiche les 279 topics regroupés par niveau, avec accès direct à chaque leçon.
 */
export default function GrammairePage() {
  const [topics, setTopics] = useState<Topic[]>([])
  const [level, setLevel] = useState<Level>('A1')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('grammar_topics')
        .select('id, level, slug, position, title_fr, emoji')
        .order('level').order('position')
      setTopics((data || []) as Topic[])
      setLoading(false)
    })()
  }, [])

  const filtered = topics.filter(t => t.level === level)

  return (
    <Container className="max-w-md py-6">
      <h1 className="text-2xl font-bold text-primary-900 mb-1">📘 Grammaire</h1>
      <p className="text-sm text-gray-600 mb-4">Choisis un niveau et entre dans une leçon. Chaque leçon contient 5 exercices.</p>

      {/* Onglets niveau */}
      <div className="grid grid-cols-6 gap-1 mb-4">
        {LEVELS.map(l => (
          <button
            key={l}
            onClick={() => setLevel(l)}
            className={`p-2 rounded-lg text-sm font-bold border-2 transition ${
              level === l ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-rule bg-white text-gray-600'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <Card>Chargement…</Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(t => (
            <Link key={t.id} href={`/grammaire/${t.id}`}>
              <Card className="hover:bg-primary-50 cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">{t.emoji || '📘'}</div>
                  <div className="flex-1">
                    <div className="font-semibold text-primary-900">{t.title_fr}</div>
                    <div className="text-xs text-gray-500">{t.slug}</div>
                  </div>
                  <div className="text-primary-500">→</div>
                </div>
              </Card>
            </Link>
          ))}
          {filtered.length === 0 && (
            <Card>Aucune leçon pour ce niveau.</Card>
          )}
        </div>
      )}
    </Container>
  )
}
