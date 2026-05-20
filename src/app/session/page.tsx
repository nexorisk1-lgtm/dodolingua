'use client'

/**
 * v9.0 — REFONTE VOCABULAIRE : UX cohérente avec la grammaire
 *
 * Changements clés vs ancienne version :
 *  • Auto-voice EN→FR au montage de chaque mot via speakSequence (plus besoin de
 *    cliquer 🔊 — la grammaire fait pareil).
 *  • Affichage de gloss_fr (traduction) + example + example_fr pour tous les mots
 *    (données BDD déjà présentes sur les 6667 concepts).
 *  • Lecture vocale séquencée : mot EN (Daniel) → "veut dire" → traduction FR
 *    (Thomas) → exemple EN → exemple FR.
 *  • Mascotte Dodo (quest puis champion) cohérente avec GrammarStepV6.
 *  • Final : "Bravo {prénom}, tu as révisé X mots !" + pavé vert avec la liste
 *    des mots vus + lecture vocale du pavé (style v8.24 grammaire).
 *  • Header "Reprendre plus tard" + retour Dashboard.
 *  • Bouton 🔊 reste disponible en replay manuel.
 *
 * Le moteur (phases discovery/interleaved/mix/anchor + API /api/sessions) est
 * conservé tel quel — seules l'UI et la logique audio sont refondues.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ConceptImage } from '@/components/ConceptImage'
import { createClient } from '@/lib/supabase/client'
import { phaseLabel, type PlanItem } from '@/lib/session-engine'
import { speakSequence, stopSpeaking, type SequenceSegment } from '@/components/games/utils'

interface Concept {
  id: string
  image_url: string | null
  image_alt: string | null
  gloss_fr: string | null
  translations: {
    lemma: string
    ipa: string | null
    audio_url: string | null
    example: string | null
    example_fr: string | null
  }[]
}

export default function SessionRunner() {
  const router = useRouter()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [plan, setPlan] = useState<PlanItem[]>([])
  const [concepts, setConcepts] = useState<Record<string, Concept>>({})
  const [userName, setUserName] = useState<string | null>(null)
  const [idx, setIdx] = useState(0)
  const [done, setDone] = useState(false)
  const [points, setPoints] = useState<{ total?: number } | null>(null)
  const [grading, setGrading] = useState(false)
  const [revealed, setRevealed] = useState(false) // pour MCQ / grading : reveal example_fr après réponse

  const current = plan[idx]
  const concept = current ? concepts[current.word_id] : null
  const tr = concept?.translations?.[0]
  // v9.0 — Liste des mots déjà vus (pour le pavé final)
  const seenLemmas = useRef<string[]>([])

  /* ---------- Chargement initial ---------- */
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
        .select('id, image_url, image_alt, gloss_fr, translations(lemma, ipa, audio_url, example, example_fr)')
        .in('id', data.word_ids)
      const map: Record<string, Concept> = {}
      for (const c of cs || []) map[c.id] = c as unknown as Concept
      setConcepts(map)
      // v9.0 — prénom utilisateur pour le "Bravo, [prénom]" final
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: prof } = await supabase.from('profiles')
          .select('display_name').eq('id', user.id).maybeSingle()
        if (prof?.display_name) setUserName(prof.display_name)
      }
    })()
    // v9.0 — Stop TTS sur démontage de page (évite les voix résiduelles en navigation)
    return () => { stopSpeaking() }
  }, [])

  /* ---------- Auto-voice EN→FR à chaque mot (v9.0) ---------- */
  useEffect(() => {
    if (!tr || !current) return
    // Track des mots vus pour le pavé final
    if (!seenLemmas.current.includes(tr.lemma)) seenLemmas.current.push(tr.lemma)
    setRevealed(false)

    const segs: SequenceSegment[] = []
    // 1. Mot EN (voix Daniel)
    segs.push({ text: tr.lemma, lang: 'en-GB', pauseAfter: 600 })
    // 2. Traduction FR (Thomas)
    if (concept?.gloss_fr) {
      segs.push({ text: `veut dire ${concept.gloss_fr}`, lang: 'fr-FR', pauseAfter: 800 })
    }
    // 3. Exemple EN puis FR (seulement en phase discovery / anchor — pas en mode rapide)
    if (current.phase === 'discovery' || current.phase === 'anchor') {
      if (tr.example) {
        segs.push({ text: 'Par exemple…', lang: 'fr-FR', pauseAfter: 400 })
        segs.push({ text: tr.example, lang: 'en-GB', pauseAfter: 600 })
        if (tr.example_fr) {
          segs.push({ text: tr.example_fr, lang: 'fr-FR', pauseAfter: 400 })
        }
      }
    }
    // Délai pour laisser le DOM se monter avant de lancer le TTS
    const t = setTimeout(() => speakSequence(segs, 0.9), 600)
    return () => { clearTimeout(t); stopSpeaking() }
  }, [idx, tr?.lemma, concept?.gloss_fr, current?.phase, current])

  /* ---------- Replay manuel (bouton 🔊) ---------- */
  function replay() {
    if (!tr) return
    const segs: SequenceSegment[] = [
      { text: tr.lemma, lang: 'en-GB', pauseAfter: 500 },
    ]
    if (concept?.gloss_fr) segs.push({ text: `veut dire ${concept.gloss_fr}`, lang: 'fr-FR', pauseAfter: 600 })
    if (tr.example) {
      segs.push({ text: tr.example, lang: 'en-GB', pauseAfter: 500 })
      if (tr.example_fr) segs.push({ text: tr.example_fr, lang: 'fr-FR' })
    }
    speakSequence(segs, 0.9)
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
    stopSpeaking()
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

  // v9.0 — "Reprendre plus tard" : pas de save explicite (sessions API gère),
  // simple retour dashboard avec stop TTS.
  function pauseAndReturnHome() {
    stopSpeaking()
    router.push('/dashboard')
  }

  /* ---------- Lecture vocale du pavé final (v9.0, cohérence v8.24 grammaire) ---------- */
  const finalSegments: SequenceSegment[] = useMemo(() => {
    if (!done) return []
    const segs: SequenceSegment[] = []
    const firstName = userName?.split(' ')[0]
    const nb = seenLemmas.current.length
    if (firstName) {
      segs.push({ text: `Bravo ${firstName}, tu as révisé ${nb} mots aujourd'hui.`, lang: 'fr-FR', pauseAfter: 1000 })
    } else {
      segs.push({ text: `Bravo, tu as révisé ${nb} mots aujourd'hui.`, lang: 'fr-FR', pauseAfter: 1000 })
    }
    if (seenLemmas.current.length > 0) {
      segs.push({ text: 'Tu connais maintenant :', lang: 'fr-FR', pauseAfter: 700 })
      seenLemmas.current.forEach(w => {
        segs.push({ text: w, lang: 'en-GB', pauseAfter: 500 })
      })
    }
    return segs
  }, [done, userName])

  useEffect(() => {
    if (done && finalSegments.length > 0) {
      const t = setTimeout(() => speakSequence(finalSegments, 0.9), 400)
      return () => { clearTimeout(t); stopSpeaking() }
    }
  }, [done, finalSegments])

  /* ---------- Écran final ---------- */
  if (done) {
    return (
      <main className="min-h-screen flex items-center justify-center py-8 px-4">
        <Container className="max-w-md">
          <Card className="text-center space-y-4">
            <img src="/dodo-champion.png" alt="Dodo champion" className="w-40 h-40 mx-auto object-contain" />
            <h1 className="text-2xl font-bold text-primary-900">
              Bravo {userName?.split(' ')[0] || ''} !
            </h1>
            <p className="text-gray-700">
              Tu as révisé <strong>{seenLemmas.current.length} mots</strong> aujourd&apos;hui.
            </p>
            <div className="text-3xl font-extrabold text-primary-700">+{points?.total ?? 10} pts</div>

            {/* Pavé vert mots révisés (lu à voix haute v9.0) */}
            {seenLemmas.current.length > 0 && (
              <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 text-left">
                <div className="text-sm uppercase font-bold text-green-700 tracking-wide mb-2">
                  Tu connais maintenant :
                </div>
                <ul className="space-y-1">
                  {seenLemmas.current.map(w => (
                    <li key={w} className="text-green-900 font-semibold">• {w}</li>
                  ))}
                </ul>
              </div>
            )}

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
  const isAnchor = current.phase === 'anchor' || current.type === 'mix_quiz'

  return (
    <main className="min-h-screen flex items-center justify-center py-8 px-4">
      <Container className="max-w-md">
        {/* v9.0 — Header retour / reprendre plus tard (cohérent grammaire) */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <Button size="sm" variant="ghost" onClick={() => router.push('/dashboard')}>
            ← Retour
          </Button>
          <button
            onClick={pauseAndReturnHome}
            className="text-sm text-gray-600 hover:text-primary-700 underline">
            💾 Reprendre plus tard
          </button>
        </div>

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

          {/* v9.0 — Mascotte Dodo (cohérence grammaire) */}
          <div className="flex justify-center">
            <img src="/dodo-quest.png" alt="Dodo" className="w-20 h-20 object-contain" />
          </div>

          {/* Mot */}
          {tr && (
            <div className="text-center py-2 space-y-2">
              {showImage && (
                <div className="flex justify-center mb-3">
                  <ConceptImage url={concept!.image_url} alt={concept!.image_alt} variant="lesson" />
                </div>
              )}
              <div className="text-3xl font-extrabold text-primary-900">{tr.lemma}</div>
              {showIpa && tr.ipa && <div className="font-mono text-primary-500">{tr.ipa}</div>}

              {/* v9.0 — Traduction FR systématique (sauf en mode anchor où on cache pour challenger la mémoire avant grading) */}
              {concept?.gloss_fr && (!isAnchor || revealed) && (
                <div className="text-base text-gray-700">
                  <span className="text-gray-500">= </span>
                  <span className="font-semibold">{concept.gloss_fr}</span>
                </div>
              )}

              <button
                onClick={replay}
                className="text-sm bg-primary-50 text-primary-700 font-semibold px-4 py-1.5 rounded-full">
                🔊 Réécouter
              </button>

              {/* v9.0 — Exemple EN + FR (visible en discovery/anchor ou après reveal) */}
              {tr.example && (!isAnchor || revealed) && (
                <div className="mt-3 pt-3 border-t border-rule space-y-1 text-left">
                  <div className="text-sm text-primary-900 italic">{tr.example}</div>
                  {tr.example_fr && (
                    <div className="text-sm text-gray-600 italic">{tr.example_fr}</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Modality info */}
          <div className="text-xs text-center text-gray-500 capitalize">
            Modalité : {current.modality.replace('_', ' ')}
          </div>

          {/* Action */}
          {isAnchor ? (
            <div className="space-y-2">
              {!revealed ? (
                <>
                  <p className="text-sm text-center text-gray-600">Te souviens-tu de ce mot ?</p>
                  <Button block variant="ghost" onClick={() => setRevealed(true)}>
                    Voir la traduction
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-center text-gray-600">As-tu retenu ce mot ?</p>
                  <button disabled={grading} onClick={() => grade('savais')} className="w-full p-3 rounded-xl border-2 border-ok text-ok bg-white font-semibold">✅ Je savais</button>
                  <button disabled={grading} onClick={() => grade('hesite')} className="w-full p-3 rounded-xl border-2 border-rule text-gray-700 bg-white font-semibold">🤔 J&apos;ai hésité</button>
                  <button disabled={grading} onClick={() => grade('pas_su')} className="w-full p-3 rounded-xl border-2 border-warn text-warn bg-white font-semibold">❌ Je ne savais pas</button>
                </>
              )}
            </div>
          ) : (
            <Button block onClick={next}>Suivant →</Button>
          )}
        </Card>
      </Container>
    </main>
  )
}
