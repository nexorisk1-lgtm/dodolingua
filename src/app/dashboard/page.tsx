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
}

const QUESTS: QuestDef[] = [
  { type: 'apprentissage', emoji: '📖', title: 'Apprentissage', description: 'Découvre 5 nouveaux mots', reward: '+15 pts', href: '/session' },
  { type: 'revision', emoji: '🔄', title: 'Révision', description: 'Consolide tes mots à revoir', reward: '+10 pts', href: '/session?mode=revision' },
  { type: 'pratique', emoji: '💬', title: 'Pratique', description: 'Échange avec ton coach IA', reward: '+15 pts', href: '/coach' },
  { type: 'jeu', emoji: '🎮', title: 'Jeu', description: 'Choisis un jeu et amuse-toi', reward: '+10 pts', href: '/jeux' },
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
            const status = questMap[q.type]?.status
            const earned = questMap[q.type]?.points_earned || 0
            const done = status === 'completed'
            const inProgress = status === 'in_progress'
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
                  <div className="flex-1">
                    <div className="font-bold text-sm text-primary-900">{q.title}</div>
                    <div className="text-xs text-gray-600">
                      {done ? <span className="text-ok font-semibold">+{earned} pts gagnés ✨</span> : q.description}
                    </div>
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
