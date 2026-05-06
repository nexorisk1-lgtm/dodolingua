/**
 * v3.23 — Endpoint /api/league/current
 *
 * Retourne :
 * - la saison en cours (semaine du lundi au dimanche)
 * - ta ligue + ton rang + tes points
 * - le leaderboard des 20 utilisateurs de ta ligue
 * - jours restants
 * - projection (top X = promotion, bottom 4 = relégation)
 *
 * Au passage : ferme la saison précédente si elle est échue (calcul promotions/relégations)
 * et crée la saison suivante. Pas besoin de cron.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { LEAGUE_TIERS, RELEGATE_BOTTOM, tierMeta, nextTier, prevTier, fidelityMultiplier } from '@/lib/leagues'
import type { LeagueTier } from '@/types/database'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  const lang_code = (new URL(req.url).searchParams.get('lang') || 'en-GB')

  // 1) Trouve ou crée la saison courante (semaine ISO du lundi 00:00 au dimanche 23:59 UTC)
  const now = new Date()
  const weekStart = getMondayUTC(now)
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)

  // Cherche la saison courante
  let { data: season } = await supabase
    .from('league_seasons')
    .select('*')
    .gte('week_end', now.toISOString())
    .lte('week_start', now.toISOString())
    .maybeSingle()

  // Si pas de saison active → ferme la précédente s'il y en a une, puis crée la nouvelle
  if (!season) {
    // 1a) Ferme la dernière saison ouverte (si échue)
    const { data: prev } = await supabase
      .from('league_seasons').select('*')
      .is('closed_at', null)
      .order('week_start', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (prev && new Date(prev.week_end) < now) {
      await closeSeasonAndPromote(supabase, prev.id)
    }

    // 1b) Crée la nouvelle saison
    const { data: lastSeason } = await supabase
      .from('league_seasons').select('season_number')
      .order('season_number', { ascending: false })
      .limit(1).maybeSingle()
    const seasonNumber = (lastSeason?.season_number || 0) + 1
    const { data: created } = await supabase
      .from('league_seasons')
      .insert({
        season_number: seasonNumber,
        week_start: weekStart.toISOString(),
        week_end: weekEnd.toISOString(),
      })
      .select('*')
      .single()
    season = created
  }

  if (!season) return NextResponse.json({ error: 'cannot create season' }, { status: 500 })

  // 2) Inscrit l'user à la saison courante s'il n'y est pas
  const { data: userLang } = await supabase
    .from('user_languages').select('league_tier, weekly_points')
    .eq('user_id', user.id).eq('lang_code', lang_code).maybeSingle()

  const userTier = (userLang?.league_tier || 'bronze') as LeagueTier

  const { data: existingEntry } = await supabase
    .from('user_league_seasons').select('*')
    .eq('user_id', user.id).eq('season_id', season.id).eq('lang_code', lang_code)
    .maybeSingle()

  if (!existingEntry) {
    await supabase.from('user_league_seasons').insert({
      user_id: user.id,
      season_id: season.id,
      lang_code,
      tier: userTier,
      points_earned: userLang?.weekly_points || 0,
    })
  }

  // 3) Récupère le leaderboard de la ligue de l'user (20 personnes max du même tier)
  const { data: leaderboard } = await supabase
    .from('user_league_seasons')
    .select('user_id, points_earned, tier, profiles(display_name)')
    .eq('season_id', season.id)
    .eq('lang_code', lang_code)
    .eq('tier', userTier)
    .order('points_earned', { ascending: false })
    .limit(20)

  const myRank = (leaderboard || []).findIndex(r => r.user_id === user.id) + 1
  const tierInfo = tierMeta(userTier)
  const promotionThreshold = tierInfo.promote_top
  const relegationThreshold = leaderboard ? Math.max(0, leaderboard.length - RELEGATE_BOTTOM) : 0

  const daysRemaining = Math.max(0, Math.ceil((new Date(season.week_end).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))

  return NextResponse.json({
    season: {
      id: season.id,
      number: season.season_number,
      week_start: season.week_start,
      week_end: season.week_end,
      days_remaining: daysRemaining,
    },
    user: {
      tier: userTier,
      tier_label: tierInfo.label,
      tier_emoji: tierInfo.emoji,
      tier_color: tierInfo.color,
      points: userLang?.weekly_points || 0,
      rank: myRank,
      total_in_league: leaderboard?.length || 0,
    },
    promotion: {
      next_tier: nextTier(userTier),
      next_tier_label: nextTier(userTier) ? tierMeta(nextTier(userTier) as LeagueTier).label : null,
      promote_top: promotionThreshold,
      will_promote: promotionThreshold > 0 && myRank > 0 && myRank <= promotionThreshold,
    },
    relegation: {
      prev_tier: prevTier(userTier),
      prev_tier_label: prevTier(userTier) ? tierMeta(prevTier(userTier) as LeagueTier).label : null,
      relegate_below: relegationThreshold,
      will_relegate: myRank > 0 && myRank > relegationThreshold,
    },
    leaderboard: (leaderboard || []).map((row, idx) => ({
      rank: idx + 1,
      user_id: row.user_id,
      display_name: (Array.isArray(row.profiles) ? row.profiles[0] : row.profiles)?.display_name || 'Anonyme',
      points: row.points_earned,
      is_me: row.user_id === user.id,
      will_promote: idx + 1 <= promotionThreshold && promotionThreshold > 0,
      will_relegate: idx + 1 > relegationThreshold,
    })),
  })
}

/** Calcule le lundi 00:00 UTC de la semaine d'une date donnée. */
function getMondayUTC(d: Date): Date {
  const day = d.getUTCDay()  // 0=dimanche, 1=lundi, ..., 6=samedi
  const diff = day === 0 ? -6 : 1 - day  // ramener au lundi
  const monday = new Date(d)
  monday.setUTCDate(d.getUTCDate() + diff)
  monday.setUTCHours(0, 0, 0, 0)
  return monday
}

/**
 * Ferme une saison : calcule rangs finaux, applique promotions/relégations.
 */
async function closeSeasonAndPromote(supabase: any, seasonId: string) {
  const { data: entries } = await supabase
    .from('user_league_seasons').select('*')
    .eq('season_id', seasonId)

  if (!entries) return

  // Group by tier+lang
  const groups: Record<string, any[]> = {}
  for (const e of entries) {
    const key = `${e.tier}|${e.lang_code}`
    if (!groups[key]) groups[key] = []
    groups[key].push(e)
  }

  // Pour chaque groupe : trier par points, déterminer rang, promote/relegate
  for (const key in groups) {
    const [tier, lang_code] = key.split('|')
    const tierInfo = tierMeta(tier as LeagueTier)
    const promoteTop = tierInfo.promote_top
    const sorted = groups[key].sort((a, b) => b.points_earned - a.points_earned)

    for (let i = 0; i < sorted.length; i++) {
      const rank = i + 1
      const entry = sorted[i]
      const willPromote = rank <= promoteTop && promoteTop > 0
      const willRelegate = rank > sorted.length - RELEGATE_BOTTOM

      await supabase.from('user_league_seasons').update({
        rank_final: rank,
        promoted: willPromote,
        relegated: willRelegate,
      }).eq('user_id', entry.user_id).eq('season_id', seasonId).eq('lang_code', lang_code)

      // Mettre à jour user_languages.league_tier pour la nouvelle saison
      let newTier: LeagueTier = entry.tier
      if (willPromote) {
        const next = nextTier(entry.tier as LeagueTier)
        if (next) newTier = next
      } else if (willRelegate) {
        const prev = prevTier(entry.tier as LeagueTier)
        if (prev) newTier = prev
      }

      // Reset weekly_points pour la nouvelle saison
      await supabase.from('user_languages').update({
        league_tier: newTier,
        weekly_points: 0,
        days_active_this_week: 0,
      }).eq('user_id', entry.user_id).eq('lang_code', lang_code)
    }
  }

  // Marquer saison comme fermée
  await supabase.from('league_seasons').update({ closed_at: new Date().toISOString() }).eq('id', seasonId)
}
