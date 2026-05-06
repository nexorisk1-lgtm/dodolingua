/**
 * v3.23 — Page Ligue refondue (Pacer-like).
 * Affiche : ta ligue + classement live + leaderboard + projection promotion/relégation
 * + navigation entre ligues (voir les autres groupes).
 */
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'
import { LEAGUE_TIERS, tierMeta } from '@/lib/leagues'

interface LeagueData {
  season: { number: number; week_end: string; days_remaining: number }
  user: { tier: string; tier_label: string; tier_emoji: string; tier_color: string; points: number; rank: number; total_in_league: number }
  promotion: { next_tier: string | null; next_tier_label: string | null; promote_top: number; will_promote: boolean }
  relegation: { prev_tier: string | null; prev_tier_label: string | null; relegate_below: number; will_relegate: boolean }
  leaderboard: Array<{ rank: number; user_id: string; display_name: string; points: number; is_me: boolean; will_promote: boolean; will_relegate: boolean }>
}

export default function LeaguePage() {
  const [data, setData] = useState<LeagueData | null>(null)
  const [loading, setLoading] = useState(true)
  const [browseTier, setBrowseTier] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/league/current')
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Container><Card>Chargement de la ligue…</Card></Container>
  if (!data || !data.user) return <Container><Card>Erreur de chargement.</Card></Container>

  const tier = data.user.tier
  const info = tierMeta(tier as any)
  const totalLeagues = LEAGUE_TIERS.length
  const tierIdx = LEAGUE_TIERS.findIndex(t => t.id === tier)

  return (
    <Container className="space-y-4 pb-24">
      {/* Header : ta ligue + jours restants */}
      <Card style={{ background: `linear-gradient(135deg, ${info.color}, #2E75B6)` }} className="text-white">
        <div className="text-center">
          <div className="text-5xl">{info.emoji}</div>
          <div className="text-2xl font-extrabold mt-2">Ligue {info.label}</div>
          <div className="text-xs opacity-90 mt-1">
            Saison #{data.season.number} · {data.season.days_remaining} jour{data.season.days_remaining > 1 ? 's' : ''} restant{data.season.days_remaining > 1 ? 's' : ''}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4 text-center">
          <div>
            <div className="text-[10px] opacity-80">Rang</div>
            <div className="text-2xl font-extrabold">#{data.user.rank}/{data.user.total_in_league}</div>
          </div>
          <div>
            <div className="text-[10px] opacity-80">Points</div>
            <div className="text-2xl font-extrabold">{data.user.points}</div>
          </div>
          <div>
            <div className="text-[10px] opacity-80">Statut</div>
            <div className="text-2xl">
              {data.promotion.will_promote ? '🚀' : data.relegation.will_relegate ? '⚠️' : '➡️'}
            </div>
          </div>
        </div>
      </Card>

      {/* Projection */}
      {(data.promotion.will_promote || data.relegation.will_relegate) && (
        <Card>
          {data.promotion.will_promote && data.promotion.next_tier_label && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm">
              <b className="text-emerald-700">🚀 Tu seras promu en {data.promotion.next_tier_label}</b>
              <div className="text-xs text-gray-600 mt-1">si tu restes dans le top {data.promotion.promote_top} d'ici dimanche</div>
            </div>
          )}
          {data.relegation.will_relegate && data.relegation.prev_tier_label && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm mt-2">
              <b className="text-red-700">⚠️ Tu risques de descendre en {data.relegation.prev_tier_label}</b>
              <div className="text-xs text-gray-600 mt-1">tu es dans les {Object.keys(data.leaderboard).length - data.relegation.relegate_below} derniers</div>
            </div>
          )}
        </Card>
      )}

      {/* Leaderboard */}
      <Card>
        <h2 className="font-bold text-primary-900 mb-3">Classement de ta ligue</h2>
        <div className="space-y-1">
          {data.leaderboard.length === 0 && (
            <div className="text-sm text-gray-500 italic text-center py-4">
              Tu es seul dans cette ligue pour l'instant. D'autres apprenants te rejoindront !
            </div>
          )}
          {data.leaderboard.map(row => (
            <div
              key={row.user_id}
              className={`flex items-center justify-between p-2 rounded-lg ${
                row.is_me ? 'bg-primary-50 border-2 border-primary-500' :
                row.will_promote ? 'bg-emerald-50' :
                row.will_relegate ? 'bg-red-50' :
                'bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  row.rank <= 3 ? 'bg-yellow-400 text-yellow-900' :
                  row.will_promote ? 'bg-emerald-500 text-white' :
                  row.will_relegate ? 'bg-red-500 text-white' :
                  'bg-gray-300 text-gray-700'
                }`}>
                  {row.rank}
                </div>
                <div className="font-semibold text-sm">
                  {row.display_name} {row.is_me && <span className="text-xs text-primary-700">(toi)</span>}
                </div>
              </div>
              <div className="text-sm font-bold text-primary-700">{row.points} pts</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Navigation entre ligues */}
      <Card>
        <h2 className="font-bold text-primary-900 mb-2">Voir une autre ligue</h2>
        <div className="grid grid-cols-5 gap-1">
          {LEAGUE_TIERS.map((t, i) => (
            <button
              key={t.id}
              onClick={() => setBrowseTier(t.id)}
              className={`flex flex-col items-center p-1.5 rounded-lg transition ${
                t.id === tier ? 'bg-primary-100 border border-primary-500' : 'bg-gray-50 hover:bg-gray-100'
              }`}
              title={t.label}
            >
              <span className="text-xl">{t.emoji}</span>
              <span className="text-[9px] font-bold mt-0.5">{t.label}</span>
              {t.id === tier && <span className="text-[8px] text-primary-700 font-bold">TOI</span>}
            </button>
          ))}
        </div>
        {browseTier && browseTier !== tier && (
          <div className="mt-3 text-xs text-gray-600 italic text-center">
            Navigation entre ligues : à venir (besoin de récupérer le leaderboard d'une autre tier)
          </div>
        )}
      </Card>

      {/* Règles */}
      <Card>
        <details>
          <summary className="font-bold text-primary-900 text-sm cursor-pointer">📜 Comment ça marche ?</summary>
          <div className="text-xs text-gray-700 mt-2 space-y-2">
            <p><b>Saison hebdomadaire</b> : du lundi au dimanche. Reset chaque lundi.</p>
            <p><b>Promotion</b> : les <b>{info.promote_top}</b> premiers de la ligue {info.label} montent en {info.id !== 'diamant' ? tierMeta(LEAGUE_TIERS[Math.min(tierIdx + 1, totalLeagues - 1)].id).label : 'niveau max atteint'}.</p>
            <p><b>Relégation</b> : les 4 derniers descendent d'une ligue.</p>
            <p><b>Bonus fidélité</b> : si tu respectes ton objectif de jours par semaine, tu gagnes <b>+30%</b> sur tes points (+50% si tu dépasses).</p>
          </div>
        </details>
      </Card>
    </Container>
  )
}
