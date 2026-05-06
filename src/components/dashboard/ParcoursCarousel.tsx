/**
 * v3.22.10 — Mini-carrousel des prochaines leçons sur le dashboard.
 * Affiche 5 leçons (la 1ère available + 4 suivantes) en mini-hexagones scrollables.
 * Click sur une leçon → lance la session.
 */
'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

interface Course {
  id: string
  level: string
  number: number
  name: string
  emoji: string
  kind?: 'lesson' | 'checkpoint'
  total: number
  mastered: number
  stars: number
  status: 'locked' | 'available' | 'in_progress' | 'completed'
}

const STATUS_BG: Record<Course['status'], string> = {
  locked: 'bg-gray-300',
  available: 'bg-gradient-to-br from-amber-300 to-amber-500',
  in_progress: 'bg-gradient-to-br from-blue-400 to-blue-600',
  completed: 'bg-gradient-to-br from-emerald-400 to-emerald-600',
}

interface Props {
  level: string
}

export function ParcoursCarousel({ level }: Props) {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/courses?level=${level}`)
      .then(r => r.json())
      .then(data => {
        setCourses(data.courses || [])
      })
      .finally(() => setLoading(false))
  }, [level])

  if (loading) {
    return <div className="text-xs text-gray-500 italic py-4 text-center">Chargement du parcours…</div>
  }

  if (courses.length === 0) {
    return <div className="text-xs text-gray-500 italic py-4 text-center">Aucune leçon disponible pour ce niveau.</div>
  }

  // Trouver l'index de la 1ère leçon non-complétée pour centrer le carrousel
  const firstActiveIdx = courses.findIndex(c => c.status === 'in_progress' || c.status === 'available')
  const startIdx = Math.max(0, firstActiveIdx === -1 ? 0 : firstActiveIdx - 1)
  const visible = courses.slice(startIdx, startIdx + 6)

  return (
    <div className="-mx-2 mt-3">
      <div className="flex gap-3 overflow-x-auto pb-3 px-2 snap-x snap-mandatory">
        {visible.map(course => {
          const isLocked = course.status === 'locked'
          const cardContent = (
            <div className={`flex flex-col items-center shrink-0 snap-center transition-transform ${isLocked ? 'opacity-60' : 'hover:scale-105'}`}>
              {/* Mini-hexagone */}
              <div
                className={`w-20 h-22 ${course.kind === 'checkpoint' ? 'bg-gradient-to-br from-purple-400 to-pink-500' : STATUS_BG[course.status]} flex flex-col items-center justify-center text-white shadow-md ${course.kind === 'checkpoint' ? 'ring-2 ring-yellow-300' : ''}`}
                style={{
                  clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                  width: '80px',
                  height: '88px',
                }}
              >
                <div className="text-2xl">{isLocked ? '🔒' : course.emoji}</div>
                <div className="text-[8px] font-bold uppercase tracking-wide">
                  {course.kind === 'checkpoint' ? 'CHECK' : 'Leçon'}
                </div>
                <div className="text-sm font-extrabold leading-none">
                  {course.kind === 'checkpoint' ? '★' : course.number}
                </div>
              </div>
              {/* Mini-étoiles */}
              <div className="flex gap-0.5 mt-1">
                {[1, 2, 3, 4].map(i => (
                  <span
                    key={i}
                    className={`text-xs ${i <= course.stars ? '' : 'opacity-30 grayscale'}`}
                  >
                    ⭐
                  </span>
                ))}
              </div>
              <div className="text-[10px] font-bold text-primary-900 mt-0.5 whitespace-nowrap">
                {course.kind === 'checkpoint' ? 'Checkpoint' : `Leçon ${course.number}`}
              </div>
            </div>
          )
          if (isLocked) {
            return <div key={course.id} className="shrink-0">{cardContent}</div>
          }
          return (
            <Link key={course.id} href={`/session?course=${course.id}`} className="shrink-0">
              {cardContent}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
