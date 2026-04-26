'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'

type LangCode = 'en-GB' | 'es-ES' | 'ar-SA' | 'ko-KR' | 'zh-CN'
type Goal = 'parler' | 'complet' | 'scolaire' | 'pro' | 'voyage' | 'grc' | 'plaisir'
type ScolaireLevel = 'cm1' | 'cm2' | '6e' | '5e' | '4e' | '3e' | '2nde' | '1ere' | 'term' | 'l1' | 'l2' | 'l3' | 'm1' | 'm2'

const LANGS: { code: LangCode; flag: string; name: string }[] = [
  { code: 'en-GB', flag: '🇬🇧', name: 'Anglais (UK)' },
  { code: 'es-ES', flag: '🇪🇸', name: 'Espagnol' },
  { code: 'ar-SA', flag: '🇸🇦', name: 'Arabe' },
  { code: 'ko-KR', flag: '🇰🇷', name: 'Coréen' },
  { code: 'zh-CN', flag: '🇨🇳', name: 'Chinois' },
]
const GOALS: { id: Goal; emoji: string; label: string }[] = [
  { id: 'parler', emoji: '🗣️', label: 'Parler' },
  { id: 'complet', emoji: '🎯', label: 'Complet' },
  { id: 'scolaire', emoji: '🎓', label: 'Scolaire' },
  { id: 'pro', emoji: '💼', label: 'Professionnel' },
  { id: 'voyage', emoji: '✈️', label: 'Voyage' },
  { id: 'grc', emoji: '🛡️', label: 'GRC' },
  { id: 'plaisir', emoji: '🎉', label: 'Plaisir' },
]
const SCOLAIRE: { id: ScolaireLevel; label: string }[] = [
  { id: 'cm1', label: 'CM1' }, { id: 'cm2', label: 'CM2' },
  { id: '6e', label: '6e' }, { id: '5e', label: '5e' }, { id: '4e', label: '4e' }, { id: '3e', label: '3e' },
  { id: '2nde', label: 'Seconde' }, { id: '1ere', label: 'Première' }, { id: 'term', label: 'Terminale' },
  { id: 'l1', label: 'L1' }, { id: 'l2', label: 'L2' }, { id: 'l3', label: 'L3' },
  { id: 'm1', label: 'Master 1' }, { id: 'm2', label: 'Master 2' },
]
const THEMES = ['Vie quotidienne', 'École', 'Voyage', 'Travail', 'GRC', 'Examens', 'Culture', 'Conversations libres']

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [lang, setLang] = useState<LangCode>('en-GB')
  const [level, setLevel] = useState<'known' | 'test' | 'zero'>('test')
  const [goals, setGoals] = useState<Goal[]>(['complet'])
  const [scolaireLevel, setScolaireLevel] = useState<ScolaireLevel | null>(null)
  const [themes, setThemes] = useState<string[]>(['Vie quotidienne'])
  const [mode, setMode] = useState<'oral' | 'complet'>('complet')
  const [dailyMin, setDailyMin] = useState<5 | 10 | 20>(10)
  const [voice, setVoice] = useState<string | null>(null)
  const [voicesList, setVoicesList] = useState<SpeechSynthesisVoice[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    const load = () => {
      const all = window.speechSynthesis.getVoices()
      const en = all.filter(v => v.lang.startsWith('en'))
      setVoicesList(en)
      if (!voice) {
        const uk = en.find(v => /gb|uk/i.test(v.lang) && v.localService) || en.find(v => /gb|uk/i.test(v.lang)) || en[0]
        if (uk) setVoice(uk.name)
      }
    }
    load()
    window.speechSynthesis.onvoiceschanged = load
    setTimeout(load, 500)
    setTimeout(load, 1500)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggle<T>(arr: T[], v: T): T[] {
    return arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]
  }

  function canNext() {
    if (step === 3 && goals.length === 0) return false
    if (step === 3 && goals.includes('scolaire') && !scolaireLevel) return false
    if (step === 4 && themes.length === 0) return false
    return true
  }

  async function finish() {
    setBusy(true); setErr(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setErr('Session expirée'); setBusy(false); return }

    // user_languages : langue active
    const { error: e1 } = await supabase.from('user_languages').upsert({
      user_id: user.id, lang_code: lang, status: 'active', is_current: true,
      daily_goal_min: dailyMin, last_activity: new Date().toISOString(),
    }, { onConflict: 'user_id,lang_code' })
    if (e1) { setErr(e1.message); setBusy(false); return }

    // user_preferences
    const { error: e2 } = await supabase.from('user_preferences').upsert({
      user_id: user.id, lang_code: lang,
      goals,
      scolaire_level: goals.includes('scolaire') ? scolaireLevel : null,
      themes,
      mode,
      grc_enabled: goals.includes('grc'),
    }, { onConflict: 'user_id,lang_code' })
    if (e2) { setErr(e2.message); setBusy(false); return }

    // Voice
    if (voice) {
      const v = voicesList.find(x => x.name === voice)
      await supabase.from('user_voice_pref').upsert({
        user_id: user.id, lang_code: lang,
        voice_name: voice,
        voice_lang: v?.lang || 'en-GB',
        is_local: v?.localService ?? true,
      }, { onConflict: 'user_id,lang_code' })
    }

    setBusy(false)
    router.push('/dashboard')
  }

  const progress = (
    <div className="flex gap-1.5 mb-4">
      {[1, 2, 3, 4, 5, 6].map(i => (
        <span key={i} className={`flex-1 h-1.5 rounded-full ${i < step ? 'bg-ok' : i === step ? 'bg-primary-500' : 'bg-rule'}`} />
      ))}
    </div>
  )

  const stepLabel = `Étape ${step} sur 6`
  const labels: Record<number, string> = {
    1: 'Langue cible', 2: 'Ton niveau', 3: 'Tes objectifs', 4: 'Tes thèmes', 5: 'Mode et temps', 6: 'Ta voix',
  }

  return (
    <main className="min-h-screen flex items-center justify-center py-8 px-4">
      <Container className="max-w-md">
        <Card className="space-y-4">
          {progress}
          <div className="text-xs uppercase text-gray-500 tracking-wider font-bold">{stepLabel} — {labels[step]}</div>

          {step === 1 && (
            <div className="space-y-2">
              <h1 className="text-xl font-bold text-primary-900">Quelle langue veux-tu apprendre ?</h1>
              {LANGS.map(l => (
                <button key={l.code} type="button"
                  className={`w-full p-3 rounded-xl border-2 flex items-center gap-3 text-left ${lang === l.code ? 'border-primary-500 bg-primary-50' : 'border-rule bg-white'}`}
                  onClick={() => setLang(l.code)}>
                  <span className="text-2xl">{l.flag}</span>
                  <span className="font-semibold">{l.name}</span>
                  {l.code === 'en-GB' && <span className="ml-auto text-xs text-ok font-bold">par défaut</span>}
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-2">
              <h1 className="text-xl font-bold text-primary-900">Quel est ton niveau actuel ?</h1>
              {([
                { id: 'known', emoji: '📊', t: 'Je connais mon niveau', s: 'A1 → C2' },
                { id: 'test', emoji: '🎯', t: 'Je fais le test CECRL', s: '8-12 minutes, adaptatif' },
                { id: 'zero', emoji: '🌱', t: 'Je commence de zéro', s: 'Démarrage en douceur' },
              ] as const).map(o => (
                <button key={o.id} type="button"
                  className={`w-full p-3 rounded-xl border-2 flex items-center gap-3 text-left ${level === o.id ? 'border-primary-500 bg-primary-50' : 'border-rule bg-white'}`}
                  onClick={() => setLevel(o.id)}>
                  <span className="text-2xl">{o.emoji}</span>
                  <div><div className="font-semibold">{o.t}</div><div className="text-xs text-gray-500">{o.s}</div></div>
                </button>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <h1 className="text-xl font-bold text-primary-900">Tes objectifs ?</h1>
              <p className="text-xs text-gray-500">Choix multiple. Le coach IA s&apos;adaptera.</p>
              <div className="flex flex-wrap gap-2">
                {GOALS.map(g => (
                  <button key={g.id} type="button"
                    className={`px-3 py-2 rounded-full border-2 text-sm font-medium ${goals.includes(g.id) ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-rule bg-white text-gray-700'}`}
                    onClick={() => setGoals(toggle(goals, g.id))}>
                    {g.emoji} {g.label}
                  </button>
                ))}
              </div>

              {goals.includes('scolaire') && (
                <div className="mt-3 p-3 bg-primary-50 rounded-xl border-l-4 border-primary-500">
                  <div className="text-xs font-bold text-primary-700 mb-1">Niveau scolaire / universitaire</div>
                  <p className="text-xs text-gray-600 mb-2">Le contenu sera adapté à ton niveau.</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SCOLAIRE.map(s => (
                      <button key={s.id} type="button"
                        className={`px-2.5 py-1.5 rounded-full border text-xs font-medium ${scolaireLevel === s.id ? 'border-primary-500 bg-white text-primary-700' : 'border-rule bg-white text-gray-700'}`}
                        onClick={() => setScolaireLevel(s.id)}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-2">
              <h1 className="text-xl font-bold text-primary-900">Tes thèmes prioritaires ?</h1>
              <p className="text-xs text-gray-500">Choix multiple — modifiable plus tard.</p>
              <div className="flex flex-wrap gap-2 pt-2">
                {THEMES.map(t => (
                  <button key={t} type="button"
                    className={`px-3 py-2 rounded-full border-2 text-sm font-medium ${themes.includes(t) ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-rule bg-white text-gray-700'}`}
                    onClick={() => setThemes(toggle(themes, t))}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-3">
              <h1 className="text-xl font-bold text-primary-900">Mode et temps quotidien</h1>
              <div>
                <div className="text-xs uppercase text-gray-500 font-bold mb-1">Mode d&apos;apprentissage</div>
                <div className="grid grid-cols-2 gap-2">
                  {([['oral', '🎧', 'Oral only'], ['complet', '📚', 'Complet']] as const).map(([id, e, l]) => (
                    <button key={id} type="button"
                      className={`p-3 rounded-xl border-2 ${mode === id ? 'border-primary-500 bg-primary-50' : 'border-rule bg-white'}`}
                      onClick={() => setMode(id)}>
                      <div className="text-2xl">{e}</div><div className="text-sm font-semibold">{l}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase text-gray-500 font-bold mb-1">Temps quotidien</div>
                <div className="flex gap-2">
                  {[5, 10, 20].map(m => (
                    <button key={m} type="button"
                      className={`flex-1 px-4 py-2 rounded-full border-2 text-sm font-bold ${dailyMin === m ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-rule bg-white text-gray-700'}`}
                      onClick={() => setDailyMin(m as 5 | 10 | 20)}>
                      {m} min
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-3">
              <h1 className="text-xl font-bold text-primary-900">Ta voix</h1>
              <p className="text-xs text-gray-500">Choisis maintenant ou plus tard dans Paramètres.</p>
              {voicesList.length === 0 && <p className="text-xs text-warn">Aucune voix anglaise détectée sur ce navigateur.</p>}
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {voicesList.map(v => {
                  const isUK = /gb|uk/i.test(v.lang)
                  const isRecom = isUK && v.localService && /daniel/i.test(v.name)
                  return (
                    <button key={v.name} type="button"
                      className={`w-full p-2.5 rounded-xl border flex items-center gap-2 text-left ${voice === v.name ? 'border-primary-500 bg-primary-50' : 'border-rule bg-white'}`}
                      onClick={() => setVoice(v.name)}>
                      {isRecom && <span className="text-[10px] bg-ok text-white px-1.5 py-0.5 rounded font-bold">RECOM</span>}
                      <div className="flex-1">
                        <div className="text-sm font-semibold">{isUK ? '🇬🇧' : '🌍'} {v.name}</div>
                        <div className="text-[11px] text-gray-500">{v.lang} {v.localService ? '(local)' : '(réseau)'}</div>
                      </div>
                      <button type="button" className="text-xs px-2 py-1 bg-primary-700 text-white rounded"
                        onClick={(e) => {
                          e.stopPropagation()
                          const u = new SpeechSynthesisUtterance("Hello, I'm your voice for learning English.")
                          u.voice = v; window.speechSynthesis.speak(u)
                        }}>
                        ▶
                      </button>
                    </button>
                  )
                })}
              </div>
              <Button variant="ghost" block size="sm" onClick={() => { setVoice(null); finish() }}>
                Choisir plus tard
              </Button>
            </div>
          )}

          {err && <p className="text-sm text-warn">{err}</p>}

          <div className="flex justify-between gap-2 pt-2">
            {step > 1 ? <Button variant="ghost" onClick={() => setStep(step - 1)}>← Retour</Button> : <div />}
            {step < 6 ? (
              <Button onClick={() => canNext() && setStep(step + 1)} disabled={!canNext()}>
                Continuer →
              </Button>
            ) : (
              <Button onClick={finish} disabled={busy}>
                {busy ? 'Finalisation…' : 'Terminer 🎉'}
              </Button>
            )}
          </div>
        </Card>
      </Container>
    </main>
  )
}
