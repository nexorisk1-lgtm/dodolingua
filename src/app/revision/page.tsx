/**
 * v3.12 — Page hub de révision : choix entre vocabulaire, grammaire, ou tout.
 * Affiche les counts en temps réel et propose 3 chemins.
 */

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function RevisionPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const nowIso = new Date().toISOString()
  const { count: wordsDue } = await supabase
    .from('user_progress')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .lte('next_review', nowIso)

  const { count: corrDue } = await supabase
    .from('coach_corrections')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .lte('next_review', nowIso)

  const { count: drillDue } = await supabase
    .from('coach_corrections')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .lte('next_review', nowIso)
    .eq('is_drill_variant', true)

  const grammarRulesDue = (corrDue || 0)
  const totalDue = (wordsDue || 0) + grammarRulesDue

  return (
    <Container className="space-y-4 pb-20 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-primary-900">🔄 Révision</h1>
          <div className="text-xs text-gray-500">{totalDue} item{totalDue > 1 ? 's' : ''} à revoir maintenant</div>
        </div>
        <Link href="/dashboard" className="text-xs text-gray-500 underline">← Dashboard</Link>
      </div>

      {totalDue === 0 ? (
        <Card className="!p-8 text-center space-y-3">
          <div className="text-5xl">🎉</div>
          <div className="text-lg font-bold text-primary-900">Tout est à jour !</div>
          <div className="text-sm text-gray-600">
            Tu n&apos;as rien à réviser maintenant. Reviens demain ou apprends de nouveaux mots.
          </div>
          <div className="flex gap-2 justify-center">
            <Link href="/session"><span className="px-4 py-2 rounded-lg bg-primary-700 text-white text-sm font-semibold inline-block">📖 Apprendre</span></Link>
            <Link href="/dashboard"><span className="px-4 py-2 rounded-lg bg-white border border-rule text-gray-700 text-sm font-semibold inline-block">← Dashboard</span></Link>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Pavé Vocabulaire */}
            <Link href="/session?mode=revision&type=words">
              <Card className={`!p-5 transition cursor-pointer ${(wordsDue || 0) > 0 ? 'border-primary-300 bg-primary-50 hover:bg-primary-100' : 'border-rule bg-white opacity-60'}`}>
                <div className="text-3xl mb-2">🔡</div>
                <div className="font-bold text-primary-900">Vocabulaire</div>
                <div className="text-xs text-gray-600 mt-1">
                  {(wordsDue || 0) > 0
                    ? `${wordsDue} mot${(wordsDue || 0) > 1 ? 's' : ''} à revoir`
                    : 'Rien à réviser'}
                </div>
                {(wordsDue || 0) > 0 && (
                  <div className="mt-3 inline-block px-3 py-1 rounded-full bg-primary-700 text-white text-xs font-semibold">
                    Réviser →
                  </div>
                )}
              </Card>
            </Link>

            {/* Pavé Grammaire */}
            <Link href="/session?mode=revision&type=grammar">
              <Card className={`!p-5 transition cursor-pointer ${grammarRulesDue > 0 ? 'border-purple-300 bg-purple-50 hover:bg-purple-100' : 'border-rule bg-white opacity-60'}`}>
                <div className="text-3xl mb-2">📚</div>
                <div className="font-bold text-primary-900">Règles de grammaire</div>
                <div className="text-xs text-gray-600 mt-1">
                  {grammarRulesDue > 0
                    ? `${grammarRulesDue} règle${grammarRulesDue > 1 ? 's' : ''} à revoir${(drillDue || 0) > 0 ? ` (dont ${drillDue} variantes drilling)` : ''}`
                    : 'Rien à réviser'}
                </div>
                {grammarRulesDue > 0 && (
                  <div className="mt-3 inline-block px-3 py-1 rounded-full bg-purple-700 text-white text-xs font-semibold">
                    Réviser →
                  </div>
                )}
              </Card>
            </Link>
          </div>

          {/* Pavé Tout réviser ensemble */}
          {(wordsDue || 0) > 0 && grammarRulesDue > 0 && (
            <Link href="/session?mode=revision">
              <Card className="!p-5 transition cursor-pointer bg-gradient-to-r from-primary-700 to-purple-700 text-white hover:opacity-90">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">🎯</div>
                  <div className="flex-1">
                    <div className="font-bold">Tout réviser d&apos;un coup</div>
                    <div className="text-xs opacity-90 mt-0.5">
                      {wordsDue} mots + {grammarRulesDue} règles dans la même session
                    </div>
                  </div>
                  <div className="text-2xl">→</div>
                </div>
              </Card>
            </Link>
          )}
        </>
      )}

      <details className="bg-white border border-rule rounded-xl p-3">
        <summary className="cursor-pointer text-xs font-bold text-gray-700">ℹ️ Comment fonctionne le cycle de révision ?</summary>
        <div className="mt-2 text-[12px] text-gray-600 space-y-1.5">
          <div>Tes items reviennent à des intervalles calculés selon ta confiance (algorithme FSRS) :</div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <div className="bg-red-50 rounded p-2 text-center">
              <div className="text-base">😖</div>
              <div className="font-bold text-red-700 text-[11px]">Pas su</div>
              <div className="text-[10px] text-gray-600">Revu dans ~10 min</div>
            </div>
            <div className="bg-amber-50 rounded p-2 text-center">
              <div className="text-base">🤔</div>
              <div className="font-bold text-amber-700 text-[11px]">Hésité</div>
              <div className="text-[10px] text-gray-600">Revu demain</div>
            </div>
            <div className="bg-emerald-50 rounded p-2 text-center">
              <div className="text-base">✅</div>
              <div className="font-bold text-emerald-700 text-[11px]">Savais</div>
              <div className="text-[10px] text-gray-600">+4j, +12j, +30j…</div>
            </div>
          </div>
        </div>
      </details>
    </Container>
  )
}
