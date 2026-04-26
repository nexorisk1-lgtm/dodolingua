import { createClient } from '@/lib/supabase/server'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'
import { LEAGUE_TIERS, tierMeta, nextTier } from '@/lib/leagues'

export default async function LeaguePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: me } = await supabase.from('user_languages')
    .select('*').eq('user_id', user.id).eq('is_current', true).maybeSingle()
  const tier = (me?.league_tier || 'bronze') as any
  const info = tierMeta(tier)
  const next = nextTier(tier)

  // Top 15 dans la même ligue + langue
  const { data: rows } = await supabase.from('user_languages')
    .select('user_id, weekly_points, profiles(display_name)')
    .eq('league_tier', tier)
    .eq('lang_code', me?.lang_code || 'en-GB')
    .order('weekly_points', { ascending: false })
    .limit(15)

  const promoted = 4

  return (
    <Container className="space-y-4">
      <Card style={{ background: `linear-gradient(135deg, ${info.color}, #2E75B6)` }} className="text-center text-white">
        <div className="text-4xl">{info.emoji}</div>
        <h1 className="text-2xl font-extrabold mt-1">Ligue {info.label}</h1>
        <p className="text-xs opacity-80 mt-0.5">Reset chaque lundi 00:00</p>
      </Card>

      <Card className="!p-0 overflow-hidden">
        <div className="bg-primary-50 px-4 py-2 text-xs uppercase font-bold text-primary-900 flex justify-between">
          <span>Classement</span>
          {next && <span>Top {promoted} → {tierMeta(next).label}</span>}
        </div>
        <ul>
          {(rows || []).map((r: any, i: number) => {
            const isMe = r.user_id === user.id
            const willPromote = i < promoted
            return (
              <li key={r.user_id} className={`flex items-center gap-3 px-4 py-2 border-b border-rule ${isMe ? 'bg-primary-50' : ''}`}>
                <span className={`w-7 text-center font-bold ${willPromote ? 'text-ok' : 'text-gray-400'}`}>{i + 1}</span>
                <span className="flex-1 text-sm">
                  {isMe ? <b>Toi · {r.profiles?.display_name || ''}</b> : (r.profiles?.display_name || 'Anonyme')}
                </span>
                <span className="text-sm font-bold text-primary-700">{r.weekly_points} pts</span>
              </li>
            )
          })}
          {(!rows || rows.length === 0) && <li className="px-4 py-6 text-center text-sm text-gray-500">Personne dans cette ligue pour le moment.</li>}
        </ul>
      </Card>

      <Card>
        <h2 className="text-sm font-bold text-primary-700 mb-2">Toutes les ligues</h2>
        <div className="grid grid-cols-3 gap-2">
          {LEAGUE_TIERS.map(t => (
            <div key={t.id} className={`text-center p-2 rounded-lg border-2 ${t.id === tier ? 'border-primary-500 bg-primary-50' : 'border-rule'}`}>
              <div className="text-2xl">{t.emoji}</div>
              <div className="text-xs font-semibold mt-1">{t.label}</div>
            </div>
          ))}
        </div>
      </Card>
    </Container>
  )
}
