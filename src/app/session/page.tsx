'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ConceptImage } from '@/components/ConceptImage'
import { createClient } from '@/lib/supabase/client'
import { phaseLabel, type PlanItem } from '@/lib/session-engine'

interface Concept {
  id: string
  image_url: string | null
  image_alt: string | null
  translations: { lemma: string; ipa: string | null; audio_url: string | null }[]
}

export default function SessionRunner() {
  const router = useRouter()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [plan, setPlan] = useState<PlanItem[]>([])
  const [concepts, setConcepts] = useState<Record<string, Concept>>({})
  const [voiceName, setVoiceName] = useState<string | null>(null)
  const [idx, setIdx] = useState(0)
  const [done, setDone] = useState(false)
  const [points, setPoints] = useState<any>(null)
  const [grading, setGrading] = useState(false)

  const current = plan[idx]
  const concept = current ? concepts[current.word_id] : null
  const tr = concept?.translations?.[0]

  useEffect(() => {
    (async () => {
      const supabase = createClient()
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang_code: 'en-GB', word_count: 8 }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Erreur'); return }
      setSessionId(data.id)
      setPlan(data.plan)
      const { data: cs } = await supabase
        .from('concepts')
        .select('id, image_url, image_alt, translations(lemma, ipa, audio_url)')
        .in('id', data.word_ids)
      const map: Record<string, Concept> = {}
      for (const c of cs || []) map[c.id] = c as any
      setConcepts(map)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: vp } = await supabase.from('user_voice_pref')
          .select('voice_name').eq('user_id', user.id).eq('lang_code', 'en-GB').maybeSingle()
        if (vp) setVoiceName(vp.voice_name)
      }
    })()
  }, [])

  function speak() {
    if (!tr || typeof window === 'undefined' || !window.speechSynthesis) return
    const u = new SpeechSynthesisUtterance(tr.lemma)
    if (voiceName) {
      const v = window.speechSynthesis.getVoices().find(v => v.name === voiceName)
      if (v) u.voice = v
    }
    u.lang = 'en-GB'
    window.speechSynthesis.speak(u)
  }

  async function grade(g: 'savais' | 'hesite' | 'pas_su') {
    if (!sessionId || !current) return
    setGrading(true)
    await fetch(`/api/sessions/${sessionId}/submit`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word_id: current.word_id, grade: g }),
    })
    setGrading(false)
    next()
  }

  function next() {
    if (idx + 1 >= plan.length) finish()
    else setIdx(idx + 1)
  }

  async function finish() {
    if (!sessionId) return
    const res = await fetch(`/api/sessions/${sessionId}/submit?finalize=1`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}',
    })
    const data = await res.json()
    setPoints(data.points)
    setDone(true)
  }

  if (done) {
    return (
      <main className="min-h-screen flex items-center justify-center py-8 px-4">
        <Container className="max-w-md">
          <Card className="text-center space-y-4">
            <div className="text-5xl">🎉</div>
            <h1 className="text-2xl font-bold text-primary-900">Session terminée</h1>
            <div className="text-3xl font-extrabold text-primary-700">+{points?.total ?? 10} pts</div>
            <p className="text-sm text-gray-600">Quête « Apprentissage » validée. À demain pour la suite !</p>
            <Button block onClick={() => router.push('/dashboard')}>Retour au dashboard</Button>
          </Card>
        </Container>
      </main>
    )
  }

  if (!current) {
    return (
      <main className="min-h-screen flex items-center justify-center py-8 px-4">
        <Container className="max-w-md">
          <Card><p className="text-center text-gray-500">Préparation de la session…</p></Card>
        </Container>
      </main>
    )
  }

  const phaseName = phaseLabel(current.phase)
  const showImage = !!concept?.image_url
  const showIpa = ['ipa', 'discovery', 'listening_cloze', 'phonetic'].includes(current.modality) || current.phase === 'mix'
  const showTranslation = current.modality === 'translation' || current.modality === 'discovery' || current.phase === 'anchor'

  return (
    <main className="min-h-screen flex items-center justify-center py-8 px-4">
      <Container className="max-w-md">
        <Card className="space-y-4">
          {/* Phase tracker */}
          <div className="flex gap-1.5">
            {(['discovery', 'interleaved', 'mix', 'anchor'] as const).map(p => (
              <div key={p} className={`flex-1 h-2 rounded-full ${
                current.phase === p ? 'bg-primary-500' :
                ['discovery', 'interleaved', 'mix', 'anchor'].indexOf(p) < ['discovery', 'interleaved', 'mix', 'anchor'].indexOf(current.phase) ? 'bg-ok' : 'bg-rule'
              }`} />
            ))}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold text-primary-500">{phaseName}</span>
            <span className="text-xs text-gray-500">{idx + 1} / {plan.length}</span>
          </div>

          {/* Mot */}
          {tr && (
            <div className="text-center py-4 space-y-2">
              {showImage && <div className="flex justify-center mb-3"><ConceptImage url={concept!.image_url} alt={concept!.image_alt} variant="lesson" /></div>}
              <div className="text-3xl font-extrabold text-primary-900">{tr.lemma}</div>
              {showIpa && tr.ipa && <div className="font-mono text-primary-500">{tr.ipa}</div>}
              <button onClick={speak} className="text-sm bg-primary-50 text-primary-700 font-semibold px-4 py-1.5 rounded-full">🔊 Écouter</button>
              {showTranslation && (
                <div className="text-sm text-gray-600 italic mt-3 pt-3 border-t border-rule">
                  Traduction et exemple bientôt disponibles
                </div>
              )}
            </div>
          )}

          {/* Modality info */}
          <div className="text-xs text-center text-gray-500 capitalize">
            Modalité : {current.modality.replace('_', ' ')}
          </div>

          {/* Action */}
          {current.phase === 'anchor' || current.type === 'mix_quiz' ? (
            <div className="space-y-2">
              <p className="text-sm text-center text-gray-600">As-tu retenu ce mot ?</p>
              <button disabled={grading} onClick={() => grade('savais')} className="w-full p-3 rounded-xl border-2 border-ok text-ok bg-white font-semibold">✅ Je savais</button>
              <button disabled={grading} onClick={() => grade('hesite')} className="w-full p-3 rounded-xl border-2 border-rule text-gray-700 bg-white font-semibold">🤔 J&apos;ai hésité</button>
              <button disabled={grading} onClick={() => grade('pas_su')} className="w-full p-3 rounded-xl border-2 border-warn text-warn bg-white font-semibold">❌ Je ne savais pas</button>
            </div>
          ) : (
            <Button block onClick={next}>Suivant →</Button>
          )}
        </Card>
      </Container>
    </main>
  )
}
