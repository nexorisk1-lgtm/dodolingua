'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { GAME_COMPONENTS, GAME_LIST, type GameId, type GameWord } from '@/components/games'
import { createClient } from '@/lib/supabase/client'
import { questPoints } from '@/lib/points'

export default function GamePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params.id as GameId
  const meta = GAME_LIST.find(g => g.id === id)
  const [words, setWords] = useState<GameWord[]>([])
  const [voiceName, setVoiceName] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pts, setPts] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // v1.4 — Récup niveau utilisateur (filtre CEFR)
      const { data: ulang } = await supabase.from('user_languages')
        .select('cefr_global').eq('user_id', user.id).eq('lang_code', 'en-GB').maybeSingle()
      const order = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
      const userLevel = (ulang?.cefr_global || 'A1').toUpperCase()
      const allowed = order.slice(0, Math.max(0, order.indexOf(userLevel)) + 1)

      // v1.4 — SELECT enrichi : gloss_fr + translations(lemma, ipa, audio_url, example)
      let q = supabase.from('concepts')
        .select('id, image_url, image_alt, gloss_fr, cefr_min, translations(lemma, ipa, audio_url, example)')
        .in('cefr_min', allowed)
        .eq('translations.lang_code', 'en-GB')
        .limit(meta?.needsImage ? 16 : 12)
      if (meta?.needsImage) q = q.not('image_url', 'is', null)
      const { data: cs } = await q

      let w: GameWord[] = (cs || []).map((c: any) => ({
        id: c.id,
        image_url: c.image_url,
        image_alt: c.image_alt,
        lemma: c.translations?.[0]?.lemma || '',
        ipa: c.translations?.[0]?.ipa,
        audio_url: c.translations?.[0]?.audio_url,
        translation: c.gloss_fr || null,         // v1.4 — sens en français
        example: c.translations?.[0]?.example || null, // v1.4 — phrase exemple
      }))

      // v1.4 — Filtrer pour les jeux qui ont besoin de phrases d'exemple
      if (id === 'sentence' || id === 'speaking_cloze') {
        w = w.filter(x => x.example && x.example.trim().length > 0)
      }

      setWords(w)
      const { data: vp } = await supabase.from('user_voice_pref')
        .select('voice_name').eq('user_id', user.id).eq('lang_code', 'en-GB').maybeSingle()
      if (vp) setVoiceName(vp.voice_name)
      setLoading(false)
    })()
  }, [id, meta, router])

  async function handleComplete(results: any[]) {
    const correct = results.filter(r => r.correct).length
    const perfect = correct === results.length
    const p = questPoints({ perfect })
    setPts(p.total); setDone(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const today = new Date().toISOString().slice(0, 10)
      await supabase.from('daily_quests').upsert({
        user_id: user.id, lang_code: 'en-GB', date: today,
        quest_type: 'jeu', status: 'completed', points_earned: p.total,
        completed_at: new Date().toISOString(),
        content_ref: { game_id: id, score: correct, total: results.length },
      }, { onConflict: 'user_id,lang_code,date,quest_type' })
      await supabase.rpc('increment_user_points', { p_user: user.id, p_lang: 'en-GB', p_amount: p.total })
    }
  }

  if (!meta) return <Container><Card>Jeu inconnu.</Card></Container>
  const Game = GAME_COMPONENTS[id]
  if (!Game) return <Container><Card>Jeu non disponible.</Card></Container>

  if (loading) return <Container className="max-w-md"><Card>Chargement…</Card></Container>
  if (words.length === 0) return (
    <Container className="max-w-md py-8">
      <Card className="text-center space-y-3">
        <div className="text-5xl">📚</div>
        <h2 className="text-lg font-bold text-primary-900">Pas encore assez de contenu</h2>
        <p className="text-sm text-gray-600">Ce jeu n&apos;a pas encore de phrases pour ton niveau. Reviens bientôt — on enrichit la base régulièrement.</p>
        <button onClick={() => router.push('/jeux')} className="w-full p-2 bg-primary-700 text-white rounded-xl font-semibold">Retour aux jeux</button>
      </Card>
    </Container>
  )
  if (done) return (
    <Container className="max-w-md py-8">
      <Card className="text-center space-y-3">
        <div className="text-5xl">{meta.emoji}</div>
        <h2 className="text-xl font-bold text-primary-900">{meta.name} terminé !</h2>
        <div className="text-3xl font-extrabold text-primary-700">+{pts} pts</div>
        <p className="text-sm text-gray-600">Quête « Jeu » validée.</p>
        <div className="flex gap-2 pt-2">
          <Button block onClick={() => router.push('/jeux')}>Autre jeu</Button>
          <Button block variant="ghost" onClick={() => router.push('/dashboard')}>Dashboard</Button>
        </div>
      </Card>
    </Container>
  )

  return (
    <Container className="max-w-md py-6">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-bold text-primary-900">{meta.emoji} {meta.name}</h1>
        <Button size="sm" variant="ghost" onClick={() => router.back()}>← Quitter</Button>
      </div>
      <Card>
        <Game
          words={words}
          voiceName={voiceName}
          onResult={() => {}}
          onComplete={handleComplete}
        />
      </Card>
    </Container>
  )
}
