/**
 * v3.23.3 — Dodo intelligent post-checkpoint.
 * Affiché après un test de checkpoint :
 *  - Si réussi (score >= seuil) → Dodo champion + félicitations
 *  - Si raté (score < seuil)   → Dodo détective + 3 leçons précises à refaire
 *
 * Logique : récupère /api/courses, filtre les leçons avant le checkpoint
 * avec stars < 4, trie par étoiles croissantes, prend les 3 premières.
 */
'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'

interface Lesson {
  id: string
  number: number
  name: string
  emoji: string
  stars: number
  kind?: 'lesson' | 'checkpoint'
  status: string
}

interface Props {
  level: string
  checkpointNumber: number
  score: number
  threshold?: number
  onClose?: () => void
}

export function CheckpointResultDodo({ level, checkpointNumber, score, threshold = 70, onClose }: Props) {
  const passed = score >= threshold
  const [weakLessons, setWeakLessons] = useState<Lesson[]>([])

  useEffect(() => {
    if (passed) return
    fetch(`/api/courses?level=${level}`)
      .then(r => r.json())
      .then(d => {
        const all: Lesson[] = d.courses || []
        const before = all.filter(
          c => c.kind !== 'checkpoint' && c.number < checkpointNumber && c.stars < 4
        )
        before.sort((a, b) => a.stars - b.stars || a.number - b.number)
        setWeakLessons(before.slice(0, 3))
      })
      .catch(() => setWeakLessons([]))
  }, [level, checkpointNumber, passed])

  // ───── RÉUSSI ─────
  if (passed) {
    return (
      <div className="bg-gradient-to-br from-emerald-50 to-green-100 border-2 border-emerald-300 rounded-2xl p-5 text-center">
        <div className="flex justify-center mb-2">
          <Image src="/dodo/dodo-stars.png" alt="Dodo champion" width={120} height={120} priority />
        </div>
        <h2 className="text-xl font-extrabold text-emerald-900">Bravo&nbsp;! 🌟</h2>
        <p className="text-sm text-emerald-800 mt-1">
          Tu as validé le checkpoint avec <span className="font-extrabold">{Math.round(score)}/100</span>.
        </p>
        <p className="text-xs text-emerald-700 mt-2">
          Le bloc suivant est débloqué — continue sur ta lancée&nbsp;!
        </p>
        <Link
          href="/parcours"
          className="mt-4 inline-block px-5 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow"
        >
          Continuer le parcours →
        </Link>
      </div>
    )
  }

  // ───── RATÉ ─────
  const missingPoints = threshold - Math.round(score)
  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-100 border-2 border-amber-300 rounded-2xl p-5">
      <div className="flex items-start gap-3">
        <Image src="/dodo/dodo-quest.png" alt="Dodo détective" width={110} height={110} className="shrink-0" />
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-extrabold text-amber-900">Pas tout à fait, on retravaille&nbsp;!</h2>
          <p className="text-xs text-amber-800 mt-1">
            Score : <span className="font-bold">{Math.round(score)}/100</span> · seuil : {threshold}.
            Il te manque <span className="font-bold">{missingPoints} pt{missingPoints > 1 ? 's' : ''}</span>.
          </p>
          <p className="text-xs text-amber-900 mt-2 font-semibold">
            J'ai repéré les leçons à consolider avant de retenter&nbsp;:
          </p>
        </div>
      </div>

      {weakLessons.length > 0 ? (
        <div className="mt-3 space-y-2">
          {weakLessons.map(l => (
            <Link
              key={l.id}
              href={`/session?course=${l.id}`}
              className="flex items-center gap-3 bg-white rounded-xl p-3 hover:shadow-md transition border border-amber-200"
            >
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center text-xl shrink-0">
                {l.emoji || '📘'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-primary-900">
                  Leçon {l.number} — {l.name}
                </div>
                <div className="flex gap-0.5 mt-0.5">
                  {[1, 2, 3, 4].map(i => (
                    <span key={i} className={`text-xs ${i <= l.stars ? '' : 'opacity-25 grayscale'}`}>⭐</span>
                  ))}
                  <span className="text-[10px] text-gray-500 ml-1">{l.stars}/4</span>
                </div>
              </div>
              <div className="text-amber-600 text-lg shrink-0">→</div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-3 bg-white rounded-xl p-3 text-center text-xs text-gray-700">
          Toutes tes leçons sont déjà solides. Refais une session de{' '}
          <Link href="/revision" className="underline font-bold text-primary-700">révisions ciblées</Link>{' '}
          puis retente le checkpoint.
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <Link
          href="/parcours"
          className="flex-1 px-4 py-2 bg-white text-amber-900 font-bold text-sm rounded-xl border border-amber-300 text-center hover:bg-amber-50"
        >
          Voir le parcours
        </Link>
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 bg-amber-600 text-white font-bold text-sm rounded-xl hover:bg-amber-700"
        >
          Je m'y mets&nbsp;!
        </button>
      </div>
    </div>
  )
}
