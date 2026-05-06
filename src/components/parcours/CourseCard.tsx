/**
 * v3.22 — Carte hexagonale de cours, inspirée Simpler.
 * Affiche emoji thème, nom, étoiles de progression, statut (locked/available/in_progress/completed).
 */
'use client'

import Link from 'next/link'

interface Course {
  id: string
  level: string
  number: number
  name: string
  emoji: string
  kind?: 'lesson' | 'checkpoint'
  total: number
  mastered: number
  fragile: number
  stars: number  // 0-4
  status: 'locked' | 'available' | 'in_progress' | 'completed'
  preview_words?: { lemma: string; gloss_fr: string | null }[]
}

interface Props {
  course: Course
  side?: 'left' | 'right' | 'center'
}

const STATUS_BG: Record<Course['status'], string> = {
  locked: 'bg-gray-300',
  available: 'bg-gradient-to-br from-amber-300 to-amber-500',
  in_progress: 'bg-gradient-to-br from-blue-400 to-blue-600',
  completed: 'bg-gradient-to-br from-emerald-400 to-emerald-600',
}
// v3.22.9 — Couleurs spéciales pour les checkpoints (style "récompense")
const CHECKPOINT_BG: Record<Course['status'], string> = {
  locked: 'bg-gray-300',
  available: 'bg-gradient-to-br from-purple-400 to-pink-500',
  in_progress: 'bg-gradient-to-br from-purple-500 to-pink-600',
  completed: 'bg-gradient-to-br from-yellow-400 to-orange-500',
}

const STATUS_BORDER: Record<Course['status'], string> = {
  locked: 'border-gray-400',
  available: 'border-amber-600',
  in_progress: 'border-blue-700',
  completed: 'border-emerald-700',
}

export function CourseCard({ course, side = 'center' }: Props) {
  const isLocked = course.status === 'locked'
  const offsetClass = side === 'left' ? '-translate-x-12' : side === 'right' ? 'translate-x-12' : ''

  const inner = (
    <div className={`relative ${offsetClass} transition-transform hover:scale-105 ${isLocked ? 'opacity-60' : ''}`}>
      {/* v3.22.9 — Hexagone plus gros (Simpler-like) + style checkpoint */}
      <div
        className={`w-48 h-52 ${course.kind === 'checkpoint' ? CHECKPOINT_BG[course.status] : STATUS_BG[course.status]} border-4 ${STATUS_BORDER[course.status]} flex flex-col items-center justify-center text-white shadow-2xl ${course.kind === 'checkpoint' ? 'ring-4 ring-yellow-300' : ''}`}
        style={{
          clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
        }}
      >
        <div className="text-6xl mb-2">{isLocked ? '🔒' : course.emoji}</div>
        <div className="text-xs font-bold uppercase tracking-wider">
          {course.kind === 'checkpoint' ? '★ CHECKPOINT' : 'Leçon'}
        </div>
        <div className="text-4xl font-extrabold leading-none">{course.kind === 'checkpoint' ? '✓' : course.number}</div>
      </div>

      {/* v3.22.6 — 4 étoiles selon avancement de phase (Proposition A) */}
      <div className="absolute -bottom-7 left-0 right-0 flex justify-center gap-1">
        {[1, 2, 3, 4].map(i => {
          const earned = i <= course.stars
          return (
            <div
              key={i}
              className={`w-12 h-12 rounded-full flex items-center justify-center text-3xl shadow-md transition-transform ${
                earned
                  ? 'bg-yellow-400 border-2 border-yellow-600 hover:scale-110'
                  : 'bg-gray-200 border-2 border-gray-300 opacity-50'
              }`}
              style={{ filter: earned ? 'drop-shadow(0 2px 4px rgba(234, 179, 8, 0.5))' : 'grayscale(1)' }}
            >
              ⭐
            </div>
          )
        })}
      </div>

      {/* Badge progression mots maîtrisés */}
      {!isLocked && (
        <div className="absolute -top-2 -right-2 bg-white text-primary-900 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full shadow border border-rule">
          {course.mastered}/{course.total}
        </div>
      )}
    </div>
  )

  if (isLocked) {
    return (
      <div className="flex flex-col items-center pb-16">
        {inner}
        <div className="text-xs text-gray-600 italic mt-4">Verrouillé</div>
      </div>
    )
  }

  const remaining = 4 - course.stars
  return (
    <Link href={`/session?course=${course.id}`} className="flex flex-col items-center pb-16 cursor-pointer">
      {inner}
      <div className="text-sm font-bold text-primary-900 mt-4">{course.name}</div>
      {course.stars > 0 && course.stars < 4 && (
        <div className="text-xs text-primary-700 italic mt-1 font-semibold">
          Encore {remaining} étoile{remaining > 1 ? 's' : ''} à débloquer
        </div>
      )}
      {course.stars === 4 && (
        <div className="text-xs text-emerald-700 font-bold mt-1">
          ✓ Leçon maîtrisée !
        </div>
      )}
    </Link>
  )
}
