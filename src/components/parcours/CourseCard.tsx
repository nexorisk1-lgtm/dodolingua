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
  total: number
  mastered: number
  fragile: number
  stars: number  // 0-3
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
      {/* Hexagone avec mask */}
      <div
        className={`w-32 h-36 ${STATUS_BG[course.status]} border-4 ${STATUS_BORDER[course.status]} flex flex-col items-center justify-center text-white shadow-lg`}
        style={{
          clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
        }}
      >
        <div className="text-4xl mb-1">{isLocked ? '🔒' : course.emoji}</div>
        <div className="text-[10px] font-bold uppercase tracking-wider">Leçon</div>
        <div className="text-2xl font-extrabold leading-none">{course.number}</div>
      </div>

      {/* Étoiles */}
      <div className="absolute -bottom-2 left-0 right-0 flex justify-center gap-0.5">
        {[1, 2, 3].map(i => (
          <div
            key={i}
            className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${
              i <= course.stars
                ? 'bg-yellow-400 text-yellow-900 shadow-md'
                : 'bg-white/60 text-gray-400 border border-gray-300'
            }`}
          >
            ⭐
          </div>
        ))}
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
      <div className="flex flex-col items-center pb-6">
        {inner}
        <div className="text-[10px] text-gray-500 italic mt-2">Verrouillé</div>
      </div>
    )
  }

  return (
    <Link href={`/session?course=${course.id}`} className="flex flex-col items-center pb-6 cursor-pointer">
      {inner}
      <div className="text-[10px] font-bold text-primary-900 mt-2">{course.name}</div>
    </Link>
  )
}
