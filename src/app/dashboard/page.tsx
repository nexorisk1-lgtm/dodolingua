import Link from 'next/link'

// v3.8.2 — Force le re-render à chaque visite (compteurs FSRS doivent être frais)
export const dynamic = 'force-dynamic'
export const revalidate = 0
import { createClient } from '@/lib/supabase/server'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'
import { cefrFull, cefrLabel } from '@/lib/cefr_labels'
import { QuestRow } from '@/components/dashboard/QuestRow'
import { QuestsAccordion } from '@/components/dashboard/QuestsAccordion'
import { ParcoursCarousel } from '@/components/dashboard/ParcoursCarousel'
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
    href: '/revision',  // v3.12 — page intermédiaire avec pavés Vocab/Grammaire/Tout
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

  // v3.12 — Total de mots maîtrisés pour le système de checkpoints
  const { count: masteredCount } = await supabase
    .from('user_progress')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('consec_correct', 2)

  // v3.14 — Stats par niveau CEFR pour le parcours basé sur la biblio réelle
  // v3.21.2 : boucle de pagination (Supabase config max-rows = 1000 même avec range())
  const byLevelAll: any[] = []
  let _from = 0
  const _PAGE = 1000
  while (true) {
    const { data: page } = await supabase
      .from('concepts').select('cefr_min').range(_from, _from + _PAGE - 1)
    if (!page || page.length === 0) break
    byLevelAll.push(...page)
    if (page.length < _PAGE) break
    _from += _PAGE
  }
  const byLevelTotal = byLevelAll
  const { data: byLevelMastered } = await supabase
    .from('user_progress')
    .select('concept_id, concepts(cefr_min)')
    .eq('user_id', user.id)
    .gte('consec_correct', 2)

  const totalByLevel: Record<string, number> = {}
  for (const c of (byLevelTotal || [])) {
    const lvl = (c as any).cefr_min || 'A1'
    totalByLevel[lvl] = (totalByLevel[lvl] || 0) + 1
  }
  const masteredByLevel: Record<string, number> = {}
  for (const r of (byLevelMastered || [])) {
    const lvl = ((r as any).concepts?.cefr_min) || 'A1'
    masteredByLevel[lvl] = (masteredByLevel[lvl] || 0) + 1
  }

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

      <QuestsAccordion completedCount={completedCount} totalCount={QUESTS.length}>
          {QUESTS.map(q => {
            const dq = questMap[q.type]
            const status = dq?.status
            const earned = dq?.points_earned || 0
            const done = status === 'completed'
            const inProgress = status === 'in_progress'
            const ref = (dq?.content_ref as any) || {}
            const refProgress = (typeof ref.progress === 'number' ? ref.progress
              : q.type === 'jeu' ? ref.games_played
              : q.type === 'pratique' ? ref.messages_count
              : null) as number | null
            const dynTarget = q.type === 'revision'
              ? Math.max(1, ((revisionDue || 0) + (correctionsDue || 0) + (refProgress || 0)))
              : q.target
            const current = done ? dynTarget
              : typeof refProgress === 'number' ? Math.min(refProgress, dynTarget)
              : inProgress ? Math.max(1, Math.floor(dynTarget * 0.3))
              : 0
            const dynDescription = q.type === 'revision' && ((revisionDue || 0) > 0 || (correctionsDue || 0) > 0)
              ? `Révise ${(revisionDue || 0) > 0 ? `tes ${revisionDue} vocabulaire${(revisionDue || 0) > 1 ? 's' : ''}` : ''}${(revisionDue || 0) > 0 && (correctionsDue || 0) > 0 ? ' + ' : ''}${(correctionsDue || 0) > 0 ? `tes ${correctionsDue} règle${(correctionsDue || 0) > 1 ? 's' : ''} de grammaire` : ''}`
              : q.description
            return (
              <QuestRow key={q.type}
                href={q.href as string}
                emoji={q.emoji}
                title={q.title}
                description={dynDescription}
                reward={q.reward}
                unit={q.unit}
                current={current}
                target={dynTarget}
                done={done}
                inProgress={inProgress}
                earnedText={done ? `+${earned} pts ✨` : null}
              />
            )
          })}
      </QuestsAccordion>

      {/* v3.8.1 — Carte standalone supprimée : intégrée dans la quête Révision */}

      {/* v3.13 — Carte cycle révision supprimée du dashboard (redondant avec /revision) */}

      {/* v3.14 — Parcours CEFR basé sur la BDD réelle : % de la biblio maîtrisée */}
      {(() => {
        const LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
        const currentLevel = lang?.cefr_global || 'A1'
        const currentIdx = LEVEL_ORDER.indexOf(currentLevel)
        const nextLevel = currentIdx >= 0 && currentIdx < 5 ? LEVEL_ORDER[currentIdx + 1] : null
        // v3.14 : target = TOTAL mots disponibles dans le niveau actuel (pas un chiffre arbitraire)
        const targetMastered = totalByLevel[currentLevel] || 0
        const masteredNum = masteredByLevel[currentLevel] || 0
        const pctToNext = targetMastered > 0 ? Math.min(100, Math.round((masteredNum / targetMastered) * 100)) : 0
        const canTest = targetMastered > 0 && masteredNum >= targetMastered && nextLevel !== null

        return (
          <Card className="!p-4 bg-gradient-to-br from-emerald-50 to-blue-50 border-emerald-200">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-bold text-primary-900">🎯 Ton parcours <span className="text-primary-700">{cefrFull(currentLevel)}</span></div>
              </div>
            </div>
            {/* v3.22.10 — Mini-carrousel des prochaines leçons */}
            <ParcoursCarousel level={currentLevel} />
            <Link href={`/parcours`}>
              <span className="mt-3 block w-full px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold text-sm text-center cursor-pointer hover:opacity-90 shadow">
                🗺️ Voir mon parcours complet →
              </span>
            </Link>
            {nextLevel ? (
              <>
                <div className="text-[11px] text-gray-700 mt-2 mb-1">
                  {targetMastered > 0
                    ? <>Mots <b>{cefrLabel(currentLevel)}</b> maîtrisés : <b>{masteredNum}</b> / {targetMastered} disponibles</>
                    : <>Aucun mot {cefrLabel(currentLevel)} disponible dans la biblio actuelle</>}
                </div>
                <div className="h-3 bg-white rounded-full overflow-hidden border border-emerald-200">
                  <div className={`h-full transition-all ${canTest ? 'bg-emerald-500' : 'bg-emerald-400'}`} style={{ width: `${pctToNext}%` }} />
                </div>
                {canTest ? (
                  <Link href={`/quiz?level=${currentLevel}`}>
                    <span className="mt-3 block w-full px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold text-sm text-center cursor-pointer hover:bg-emerald-700">
                      🎓 Passer le test {currentLevel} pour débloquer {nextLevel} →
                    </span>
                  </Link>
                ) : targetMastered > 0 ? (
                  <div className="text-[11px] text-gray-500 italic mt-2 text-center">
                    Encore {targetMastered - masteredNum} mot{targetMastered - masteredNum > 1 ? 's' : ''} {currentLevel} à maîtriser pour débloquer le test.
                    <br />Un mot est <b>maîtrisé</b> quand tu le valides ✅ 2 fois de suite en révision.
                  </div>
                ) : (
                  <div className="text-[11px] text-gray-500 italic mt-2 text-center">
                    Pas encore de contenu {currentLevel} dans la biblio. Plus de mots à venir.
                  </div>
                )}
              </>
            ) : (
              <div className="text-center mt-2">
                <div className="text-2xl">🏆</div>
                <div className="text-sm font-bold text-emerald-700 mt-1">Niveau C2 atteint !</div>
                <div className="text-[11px] text-gray-600">Tu maîtrises l'anglais au plus haut niveau.</div>
              </div>
            )}
          </Card>
        )
      })()}

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
