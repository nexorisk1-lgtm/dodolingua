import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'
import { tierMeta } from '@/lib/leagues'
import { VoicePicker } from '@/components/profile/VoicePicker'
import { CefrEvalCard } from '@/components/profile/CefrEvalCard'
import { PreferencesEditor } from '@/components/profile/PreferencesEditor'
import { cefrFull } from '@/lib/cefr_labels'

export default async function ProfilePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const { data: langs } = await supabase.from('user_languages').select('*').eq('user_id', user.id)
  const { data: prefs } = await supabase.from('user_preferences').select('*').eq('user_id', user.id).maybeSingle()
  const { data: voicePref } = await supabase.from('user_voice_pref')
    .select('voice_name').eq('user_id', user.id).eq('lang_code', 'en-GB').maybeSingle()
  const { data: badges } = await supabase.from('user_badges')
    .select('badge_id, unlocked_at, badges(code, label, icon)').eq('user_id', user.id).limit(8)

  const current = langs?.find(l => l.is_current) || langs?.[0]
  const tier = current ? tierMeta(current.league_tier) : null

  return (
    <Container className="space-y-4">
      <Card className="text-center">
        <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-primary-700 to-primary-500 text-white text-3xl font-extrabold flex items-center justify-center">
          {(profile?.display_name?.[0] || 'R').toUpperCase()}
        </div>
        <div className="font-bold text-primary-900 mt-2">{profile?.display_name || 'Utilisateur'}</div>
        <div className="text-xs text-gray-500">{user.email}</div>
        {tier && current && (
          <div className="text-sm text-gray-600 mt-1">
            Ligue {tier.label} {tier.emoji} · {current.weekly_points} pts cette semaine
          </div>
        )}
        {profile?.is_admin && (
          <Link href="/admin" className="inline-block mt-3 px-3 py-1 bg-primary-900 text-white text-xs rounded-full font-bold">
            ⚙ Espace admin
          </Link>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-primary-700">Mes langues</h2>
          <span className="text-xs text-gray-500">{langs?.length || 0} actives</span>
        </div>
        <div className="space-y-2">
          {(langs || []).map(l => (
            <div key={l.lang_code} className={`p-3 rounded-xl flex items-center gap-3 ${l.is_current ? 'bg-primary-50 border border-primary-500' : 'bg-gray-50'}`}>
              <span className="text-xl">{LANG_FLAGS[l.lang_code] || '🌍'}</span>
              <div className="flex-1">
                <div className="font-semibold text-sm">{LANG_NAMES[l.lang_code] || l.lang_code}</div>
                <div className="text-xs text-gray-500">{cefrFull(l.cefr_global)} · {l.total_points} pts total</div>
              </div>
              {l.is_current && <span className="text-[10px] bg-ok text-white px-2 py-0.5 rounded-full font-bold">ACTIVE</span>}
            </div>
          ))}
        </div>
      </Card>

      {current && (
        <Card>
          <h2 className="font-bold text-primary-700 mb-3">CEFR — {LANG_NAMES[current.lang_code]}</h2>
          {[
            ['Compréhension orale', current.cefr_co],
            ['Compréhension écrite', current.cefr_ce],
            ['Expression orale', current.cefr_eo],
            ['Expression écrite', current.cefr_ee],
          ].map(([l, v]) => (
            <div key={l as string} className="flex justify-between py-1.5 border-b border-rule text-sm">
              <span className="text-gray-700">{l}</span>
              <b className="text-primary-700">{v || '—'}</b>
            </div>
          ))}
        </Card>
      )}

      <Card>
        <h2 className="font-bold text-primary-700 mb-3">Préférences</h2>
        <PreferencesEditor initialPrefs={prefs} userId={user.id} />
      </Card>

      <Card>
        <h2 className="font-bold text-primary-700 mb-3">Badges débloqués</h2>
        {(badges?.length || 0) === 0 ? (
          <p className="text-sm text-gray-500">Pas encore de badge. Continue de progresser !</p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {badges!.map((b: any) => (
              <div key={b.badge_id} className="aspect-square bg-primary-50 rounded-lg flex flex-col items-center justify-center">
                <div className="text-2xl">🏅</div>
                <div className="text-[9px] text-center mt-1">{b.badges?.label || b.badges?.code}</div>
              </div>
            ))}
          </div>
        )}
            </Card>

      <Card>
        <div className="font-bold text-primary-900 mb-2">🔊 Voix du coach</div>
        <VoicePicker initialVoice={voicePref?.voice_name || null} />
      </Card>

      <Card>
        <div className="font-bold text-primary-900 mb-2">📊 Niveau CEFR estimé</div>
        <CefrEvalCard 
          declared={current?.cefr_global || 'A1'} 
          estimated={(current as any)?.cefr_estimated || null}
          estimatedAt={(current as any)?.cefr_estimated_at || null}
          breakdown={(current as any)?.cefr_breakdown || null}
        />
      </Card>

      <form action="/api/auth/signout" method="post">
        <button className="w-full text-sm text-warn font-semibold py-2">Déconnexion</button>
      </form>
    </Container>
  )
}

function PrefRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-rule text-sm">
      <span className="text-gray-700">{label}</span>
      <b className="text-primary-700 text-right max-w-[60%] truncate">{value}</b>
    </div>
  )
}

const LANG_FLAGS: Record<string, string> = {
  'en-GB': '🇬🇧', 'es-ES': '🇪🇸', 'ar-SA': '🇸🇦', 'ko-KR': '🇰🇷', 'zh-CN': '🇨🇳',
}
const LANG_NAMES: Record<string, string> = {
  'en-GB': 'Anglais (UK)', 'es-ES': 'Espagnol', 'ar-SA': 'Arabe', 'ko-KR': 'Coréen', 'zh-CN': 'Chinois',
}
