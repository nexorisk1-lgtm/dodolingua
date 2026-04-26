import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'
import { QUEST_TYPES, QUEST_LABELS, QUEST_ICONS } from '@/lib/points'
import { tierMeta, nextTier } from '@/lib/leagues'
import type { QuestType } from '@/types/database'

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

  const completedCount = QUEST_TYPES.filter(t => questMap[t]?.status === 'completed').length
  const tier = lang?.league_tier || 'bronze'
  const tierInfo = tierMeta(tier)
  const next = nextTier(tier)
  const nextThreshold = LEAGUE_THRESHOLDS[tier] ?? 100
  const wp = lang?.weekly_points ?? 0

  return (
    <Container className="space-y-5">
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
        <h2 className="text-xs uppercase font-bold text-gray-500 mb-2">4 quêtes du jour</h2>
        <div className="space-y-2">
          {QUEST_TYPES.map(t => {
            const q = questMap[t]
            const done = q?.status === 'completed'
            const link = t === 'apprentissage' ? '/session' : t === 'revision' ? '/session?mode=revision' : t === 'pratique' ? '/coach' : '/jeux'
            return (
              <Link key={t} href={link}>
                <div className={`p-3 rounded-xl border flex items-center gap-3 ${done ? 'bg-green-50 border-green-200' : 'bg-white border-rule'}`}>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${done ? 'bg-ok text-white' : 'bg-primary-50'}`}>
                    {done ? '✓' : QUEST_ICONS[t]}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{QUEST_LABELS[t]}</div>
                    <div className="text-xs text-gray-500">
                      {done ? `+${q.points_earned} pts` : 'À faire'}
                    </div>
                  </div>
                  {!done && <span className="text-primary-500">→</span>}
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      <Link href="/ligue">
        <Card style={{ background: `linear-gradient(135deg, ${tierInfo.color}, #2E75B6)` }} className="text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs opacity-80">Ligue {tierInfo.label}</div>
              <div className="text-2xl font-extrabold mt-0.5">{wp} / {nextThreshold} pts</div>
              {next && <div className="text-xs opacity-80 mt-0.5">→ {tierMeta(next).label} si tu dépasses {nextThreshold}</div>}
            </div>
            <div className="text-5xl">{tierInfo.emoji}</div>
          </div>
        </Card>
      </Link>

      <Card>
        <h2 className="text-sm font-bold text-primary-700 mb-2">Accès rapide</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Link href="/jeux" className="p-2 bg-primary-50 rounded-lg text-center font-semibold text-primary-700">🎮 Jeux</Link>
          <Link href="/coach" className="p-2 bg-primary-50 rounded-lg text-center font-semibold text-primary-700">💬 Coach</Link>
          <Link href="/profile" className="p-2 bg-primary-50 rounded-lg text-center font-semibold text-primary-700">👤 Profil</Link>
          <Link href="/grc" className="p-2 bg-primary-50 rounded-lg text-center font-semibold text-primary-700">🛡️ GRC</Link>
        </div>
      </Card>
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

const LEAGUE_THRESHOLDS: Record<string, number> = {
  bronze: 100, argent: 200, or: 350, saphir: 500, emeraude: 700, obsidienne: 1000,
}
