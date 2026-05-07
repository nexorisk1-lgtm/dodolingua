/**
 * v3.22.11 — Mini-carrousel parcours avec flèches navigation + Dodo encourageant.
 */
'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Mascot } from '@/components/Mascot'

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
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/courses?level=${level}`)
      .then(r => r.json())
      .then(data => setCourses(data.courses || []))
      .finally(() => setLoading(false))
  }, [level])

  // Auto-scroll au montage : centrer sur la 1ère leçon active
  useEffect(() => {
    if (!loading && courses.length > 0 && scrollRef.current) {
      const firstActiveIdx = courses.findIndex(c => c.status === 'in_progress' || c.status === 'available')
      if (firstActiveIdx > 0) {
        // Chaque carte fait ~92px (80 hex + 12 gap)
        scrollRef.current.scrollLeft = Math.max(0, (firstActiveIdx - 1) * 92)
      }
    }
  }, [loading, courses])

  if (loading) {
    return <div className="text-xs text-gray-500 italic py-4 text-center">Chargement du parcours…</div>
  }

  if (courses.length === 0) {
    return <div className="text-xs text-gray-500 italic py-4 text-center">Aucune leçon disponible.</div>
  }

  function scroll(direction: 'left' | 'right') {
    if (!scrollRef.current) return
    const amount = 280  // ~3 cartes
    scrollRef.current.scrollBy({ left: direction === 'right' ? amount : -amount, behavior: 'smooth' })
  }

  // v3.23.1 — Message Dodo intelligent : récap GLOBAL des étoiles manquantes
  const totalStars = courses.reduce((s, c) => s + c.stars, 0)
  const maxStars = courses.filter(c => c.kind === 'lesson').length * 4
  const missingStars = maxStars - totalStars
  // Leçons partielles (1-3 étoiles, pas 0 ni 4) : ce sont celles à terminer
  const partialLessons = courses.filter(c => c.kind === 'lesson' && c.stars > 0 && c.stars < 4)
  const masteredLessons = courses.filter(c => c.kind === 'lesson' && c.stars === 4).length
  const totalLessons = courses.filter(c => c.kind === 'lesson').length
  const checkpointActive = courses.find(c => c.kind === 'checkpoint' && (c.status === 'available' || c.status === 'in_progress'))

  let dodoMsg = "Allez, on attaque la première leçon !"
  let dodoPose: 'idle' | 'happy' | 'study' | 'champion' | 'quest' | 'stars' = 'quest'
  let dodoAnim: 'breathe' | 'bounce' | 'wave' | 'celebrate' = 'wave'

  if (totalStars === 0) {
    dodoMsg = `Démarre la Leçon 1 pour gagner tes 1ères étoiles !`
    dodoPose = 'quest'
    dodoAnim = 'wave'
  } else if (totalStars === maxStars) {
    dodoMsg = `Niveau complet ! Tu es prête pour le test.`
    dodoPose = 'stars'
    dodoAnim = 'celebrate'
  } else if (checkpointActive && checkpointActive.status === 'available') {
    dodoMsg = `Checkpoint #${checkpointActive.number} prêt ! Teste tes mots maîtrisés.`
    dodoPose = 'study'
    dodoAnim = 'bounce'
  } else if (partialLessons.length === 1) {
    const l = partialLessons[0]
    const remaining = 4 - l.stars
    dodoMsg = `Plus que ${remaining} étoile${remaining > 1 ? 's' : ''} sur la Leçon ${l.number} !`
    dodoPose = 'stars'
    dodoAnim = 'bounce'
  } else if (partialLessons.length > 1) {
    // Plusieurs leçons partielles : récap global
    const lessonNumbers = partialLessons.map(l => l.number).slice(0, 3).join(', ')
    const more = partialLessons.length > 3 ? ` (+${partialLessons.length - 3} autres)` : ''
    dodoMsg = `${missingStars} étoile${missingStars > 1 ? 's' : ''} à débloquer sur Leçons ${lessonNumbers}${more}`
    dodoPose = 'stars'
    dodoAnim = 'bounce'
  } else {
    // Toutes les leçons commencées sont à 4 étoiles → enchaîner sur la suivante
    const next = courses.find(c => c.status === 'available')
    if (next) {
      dodoMsg = `Bravo ! Continue avec ${next.kind === 'checkpoint' ? `le Checkpoint ${next.number}` : `la Leçon ${next.number}`}.`
      dodoPose = 'stars'
      dodoAnim = 'celebrate'
    } else {
      dodoMsg = `${masteredLessons}/${totalLessons} leçons maîtrisées 🎯`
      dodoPose = 'stars'
      dodoAnim = 'breathe'
    }
  }

  return (
    <div className="mt-3">
      {/* v3.22.12 — Bulle Dodo avec vraie mascotte (au lieu du 🐤) */}
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-2xl p-2 pl-1 mb-3 flex items-center gap-2 text-xs shadow-sm">
        <div className="shrink-0 -mb-2 -ml-1">
          <Mascot pose={dodoPose} size={130} animation={dodoAnim} />
        </div>
        <div className="flex-1 bg-white border border-blue-100 rounded-xl px-3 py-2 relative">
          {/* Petit triangle pointant vers Dodo */}
          <div className="absolute -left-1.5 top-3 w-3 h-3 bg-white border-l border-b border-blue-100 transform rotate-45" />
          <div className="text-blue-900 font-semibold">{dodoMsg}</div>
        </div>
      </div>

      {/* Carrousel avec flèches */}
      <div className="relative">
        {/* Flèche gauche */}
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white border border-rule shadow-md hover:bg-primary-50 flex items-center justify-center text-primary-700 font-bold"
          aria-label="Précédent"
        >
          ◀
        </button>

        {/* Liste scrollable */}
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto pb-3 px-10 scroll-smooth"
          style={{ scrollbarWidth: 'thin' }}
        >
          {courses.map(course => {
            const isLocked = course.status === 'locked'
            const cardContent = (
              <div className={`flex flex-col items-center shrink-0 transition-transform ${isLocked ? 'opacity-60' : 'hover:scale-105'}`}>
                <div
                  className={`flex flex-col items-center justify-center text-white shadow-md ${course.kind === 'checkpoint' ? 'bg-gradient-to-br from-purple-400 to-pink-500 ring-2 ring-yellow-300' : STATUS_BG[course.status]}`}
                  style={{
                    clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                    width: '80px',
                    height: '88px',
                  }}
                >
                  <div className="text-2xl">{isLocked ? '🔒' : course.emoji}</div>
                  <div className="text-[8px] font-bold uppercase">
                    {course.kind === 'checkpoint' ? 'CHECK' : 'Leçon'}
                  </div>
                  <div className="text-sm font-extrabold leading-none">
                    {course.kind === 'checkpoint' ? '★' : course.number}
                  </div>
                </div>
                <div className="flex gap-0.5 mt-1">
                  {[1, 2, 3, 4].map(i => (
                    <span key={i} className={`text-xs ${i <= course.stars ? '' : 'opacity-30 grayscale'}`}>⭐</span>
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

        {/* Flèche droite */}
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white border border-rule shadow-md hover:bg-primary-50 flex items-center justify-center text-primary-700 font-bold"
          aria-label="Suivant"
        >
          ▶
        </button>
      </div>

      {/* Compteur étoiles totales */}
      <div className="text-center text-[11px] text-gray-600 mt-1">
        ⭐ <b>{totalStars}</b> / {maxStars} étoiles · {courses.filter(c => c.status === 'completed').length} leçons maîtrisées
      </div>
    </div>
  )
}
