import Link from 'next/link'

// v3.8.2 — Force le re-render à chaque visite (compteurs FSRS doivent être frais)
export const dynamic = 'force-dynamic'
export const revalidate = 0
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
    description: 'Consolide ton vocabulaire et ta grammaire',
    reward: '+10 pts',
    href: '/session?mode=revision',
    target: 5,
    unit: 'items',
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

  // v3.6 — Count des corrections coach à réviser
  const nowIso = new Date().toISOString()
  const { count: correctionsDue } = await supabase
    .from('coach_corrections')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .lte('next_review', nowIso)
  const { count: correctionsTotal } = await supabase
    .from('coach_corrections')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  // v3.7.5 — Count des mots dûs en révision (FSRS)
  const { count: revisionDue } = await supabase
    .from('user_progress')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .lte('next_review', nowIso)

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
            // v1.7 — progression : lit content_ref.progress (apprentissage/revision)
            // ou content_ref.games_played (jeu) ou content_ref.messages_count (pratique)
            const ref = (dq?.content_ref as any) || {}
            const refProgress = (typeof ref.progress === 'number' ? ref.progress
              : q.type === 'jeu' ? ref.games_played
              : q.type === 'pratique' ? ref.messages_count
              : null) as number | null
            const current = done ? q.target
              : typeof refProgress === 'number' ? Math.min(refProgress, q.target)
              : inProgress ? Math.max(1, Math.floor(q.target * 0.3))
              : 0
            const progressPct = Math.round((current / q.target) * 100)
            return (
              <Link key={q.type} href={q.href as any}>
                <div className={`p-3 rounded-xl border transition ${
                  done ? 'bg-green-50 border-green-200' :
                  inProgress ? 'bg-amber-50 border-amber-200' :
                  'bg-white border-rule hover:border-primary-300'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 ${
                      done ? 'bg-ok text-white' : 'bg-primary-50'
                    }`}>
                      {done ? '✓' : q.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="font-bold text-sm text-primary-900">{q.title}</div>
                        <div className="text-[11px] font-bold whitespace-nowrap">
                          {done ? (
                            <span className="text-ok">+{earned} pts ✨</span>
                          ) : (
                            <span className="text-primary-700">{q.reward}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-gray-600 truncate">
                        {done ? (
                          <>
                            {q.type === 'jeu' && ref.games_played
                              ? `${ref.games_played} jeu${ref.games_played > 1 ? 'x' : ''} joué${ref.games_played > 1 ? 's' : ''} · ${earned} pts cumulés`
                              : q.type === 'pratique' && ref.messages_count
                              ? `${ref.messages_count} échange${ref.messages_count > 1 ? 's' : ''} avec Dodo`
                              : `${q.target} ${q.unit} validés ✨`}
                          </>
                        ) : q.type === 'revision' && ((revisionDue || 0) > 0 || (correctionsDue || 0) > 0) ? (
                          <span className="text-amber-700 font-bold">
                            Révise {(revisionDue || 0) > 0 && `tes ${revisionDue} vocabulaire${(revisionDue || 0) > 1 ? 's' : ''}`}
                            {(revisionDue || 0) > 0 && (correctionsDue || 0) > 0 && ' + '}
                            {(correctionsDue || 0) > 0 && `tes ${correctionsDue} règle${(correctionsDue || 0) > 1 ? 's' : ''} de grammaire`}
                          </span>
                        ) : q.description}
                      </div>
                    </div>
                  </div>
                  {/* v1.7 — Barre de progression FULL WIDTH, gris→bleu */}
                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-full transition-all ${
                        done ? 'bg-ok' :
                        progressPct > 0 ? 'bg-primary-500' :
                        'bg-gray-200'
                      }`}
                        style={{ width: `${progressPct}%` }} />
                    </div>
                    <span className={`text-[11px] font-bold whitespace-nowrap ${
                      done ? 'text-ok' : progressPct > 0 ? 'text-primary-700' : 'text-gray-400'
                    }`}>
                      {current}/{q.target} {q.unit}
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* v3.8.1 — Carte standalone supprimée : intégrée dans la quête Révision */}

      {/* v3.7.5 — Carte explicative du cycle de révision */}
      {((revisionDue || 0) > 0 || (correctionsDue || 0) > 0) && (
        <details className="bg-white border border-rule rounded-xl p-3">
          <summary className="cursor-pointer text-xs font-bold text-gray-700">ℹ️ Comment fonctionne le cycle de révision ?</summary>
          <div className="mt-2 text-[12px] text-gray-600 space-y-1.5">
            <div>Tes mots reviennent à des intervalles calculés selon ta confiance :</div>
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
            <div className="text-[11px] italic mt-2">Pas de limite quotidienne — tu fais autant de révisions que tu veux selon le cycle.</div>
          </div>
        </details>
      )}

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
