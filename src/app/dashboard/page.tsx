import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'
import { tierMeta, nextTier } from '@/lib/leagues'
import type { QuestType } from '@/types/database'

interface QuestDef {
  type: QuestType
  emoji: string
  title: string
  description: string
  reward: string
  href: string
  target: number   // v1.3 — objectif numérique pour la barre de progression
  unit: string     // v1.3 — unité affichée (ex: "mots", "jeu", "message")
}

const QUESTS: QuestDef[] = [
  {
    type: 'apprentissage',
    emoji: '📖',
    title: 'Apprentissage',
    description: 'Découvre 5 nouveaux mots',
    reward: '+15 pts',
    href: '/session',
    target: 5,
    unit: 'mots',
  },
  {
    type: 'revision',
    emoji: '🔄',
    title: 'Révision',
    description: 'Consolide tes mots à revoir',
    reward: '+10 pts',
    href: '/session?mode=revision',
    target: 5,
    unit: 'mots',
  },
  {
    type: 'pratique',
    emoji: '💬',
    title: 'Pratique',
    description: 'Échange avec ton coach IA',
    reward: '+15 pts',
    href: '/coach',
    target: 1,
    unit: 'message',
  },
  {
    type: 'jeu',
    emoji: '🎮',
    title: 'Jeu',
    description: 'Choisis un jeu et amuse-toi',
    reward: '+10 pts',
    href: '/jeux',
    target: 1,
    unit: 'jeu',
  },
]

const LEAGUE_THRESHOLDS: Record<string, number> = {
  bronze: 100, argent: 200, or: 350, saphir: 500, emeraude: 700, obsidienne: 1000,
}

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const today = new Date().toISOString().slice(0, 10)
  const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).single()
  const { data: lang } = await supabase.from('user_languages')
    .select('*').eq('user_id', user.id).eq('is_current', true).maybeSingle()
  const { data: quests } = await supabase.from('daily_quests')
    .select('*').eq('user_id', user.id).eq('date', today)

  const questMap: Record<QuestType, any> = {} as any
  for (const q of quests || []) questMap[q.quest_type as QuestType] = q

  const completedCount = QUESTS.filter(q => questMap[q.type]?.status === 'completed').length
  const tier = lang?.league_tier || 'bronze'
  const tierInfo = tierMeta(tier)
  const next = nextTier(tier)
  const nextThreshold = LEAGUE_THRESHOLDS[tier] ?? 100
  const wp = lang?.weekly_points ?? 0
  const progressPct = Math.min(100, Math.round((wp / nextThreshold) * 100))

  return (
    <Container className="space-y-5 pb-20">
      <Card className="!py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-500">Bonjour</div>
            <h1 className="text-xl font-bold text-primary-900">{profile?.display_name || 'Raïssa'} 👋</h1>
          </div>
          <div className="text-right">
            <div className="text-2xl">🔥</div>
            <div className="text-xs text-gray-500">streak</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          <Stat n={lang?.cefr_global || 'A1'} l="CECRL" />
          <Stat n={String(wp)} l="Pts semaine" />
          <Stat n={`${completedCount}/4`} l="Quêtes" />
        </div>
      </Card>

      <div>
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="text-xs uppercase font-bold text-gray-500">Tes 4 quêtes du jour</h2>
          {completedCount === 4 && <span className="text-xs font-bold text-ok">⭐ Quadrifecta !</span>}
        </div>
        <div className="space-y-2">
          {QUESTS.map(q => {
            const dq = questMap[q.type]
            const status = dq?.status
            const earned = dq?.points_earned || 0
            const done = status === 'completed'
            const inProgress = status === 'in_progress'
            // v1.3 — Calcul progression : lit content_ref.progress si disponible,
            // sinon dérive depuis le statut (in_progress = 1, completed = target).
            const refProgress = (dq?.content_ref as any)?.progress
            const current = done ? q.target
              : typeof refProgress === 'number' ? Math.min(refProgress, q.target)
              : inProgress ? Math.max(1, Math.floor(q.target * 0.3))
              : 0
            const progressPct = Math.round((current / q.target) * 100)
            return (
              <Link key={q.type} href={q.href as any}>
                <div className={`p-3 rounded-xl border flex items-center gap-3 transition ${
                  done ? 'bg-green-50 border-green-200' :
                  inProgress ? 'bg-yellow-50 border-yellow-200' :
                  'bg-white border-rule hover:border-primary-300'
                }`}>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                    done ? 'bg-ok text-white' : 'bg-primary-50'
                  }`}>
                    {done ? '✓' : q.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="font-bold text-sm text-primary-900">{q.title}</div>
                      {/* v1.3 — Compteur X/Y visible sur quêtes en cours */}
                      {!done && q.target > 1 && (
                        <div className="text-[11px] font-bold text-primary-700 whitespace-nowrap">
                          {current}/{q.target} {q.unit}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-600 truncate">
                      {done ? <span className="text-ok font-semibold">+{earned} pts gagnés ✨</span> : q.description}
                    </div>
                    {/* v1.3 — Barre de progression visible si quête multi-étapes */}
                    {!done && q.target > 1 && (
                      <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full transition-all ${inProgress ? 'bg-warn' : 'bg-primary-300'}`}
                          style={{ width: `${progressPct}%` }} />
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    {done ? (
                      <span className="text-xs font-bold text-ok">⭐</span>
                    ) : (
                      <>
                        <div className="text-xs font-bold text-primary-700">{q.reward}</div>
                        <div className="text-primary-500 text-lg">→</div>
                      </>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      <Link href="/ligue">
        <Card style={{ background: `linear-gradient(135deg, ${tierInfo.color}, #2E75B6)` }} className="text-white">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="text-xs opacity-80">Ligue {tierInfo.label}</div>
              <div className="text-2xl font-extrabold mt-0.5">{wp} / {nextThreshold} pts</div>
              {next && <div className="text-xs opacity-80 mt-0.5">→ {tierMeta(next).label} si tu dépasses {nextThreshold}</div>}
              <div className="mt-2 h-2 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white transition-all" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
            <div className="text-5xl ml-3">{tierInfo.emoji}</div>
          </div>
        </Card>
      </Link>
    </Container>
  )
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div className="bg-primary-50 rounded-lg py-2 text-center">
      <div className="text-lg font-extrabold text-primary-700">{n}</div>
      <div className="text-[10px] uppercase text-gray-500">{l}</div>
    </div>
  )
}
