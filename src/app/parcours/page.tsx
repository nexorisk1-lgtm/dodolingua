/**
 * v3.22 — Page /parcours : vrai parcours visuel inspiré Simpler.
 * Cartes hexagonales en zigzag, fond ciel avec nuages.
 */
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CourseCard } from '@/components/parcours/CourseCard'
import { cefrFull, cefrLabel } from '@/lib/cefr_labels'

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

interface Course {
  id: string
  level: string
  number: number
  name: string
  emoji: string
  total: number
  mastered: number
  fragile: number
  stars: number
  status: 'locked' | 'available' | 'in_progress' | 'completed'
  preview_words?: { lemma: string; gloss_fr: string | null }[]
}

export default function ParcoursPage() {
  const [level, setLevel] = useState<string>('A1')
  const [courses, setCourses] = useState<Course[]>([])
  const [stats, setStats] = useState<{ total_words: number; total_courses: number; completed_courses: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/courses?level=${level}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
          setCourses([])
        } else {
          setCourses(data.courses || [])
          setStats({
            total_words: data.total_words,
            total_courses: data.total_courses,
            completed_courses: data.completed_courses,
          })
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [level])

  return (
    <div className="min-h-screen pb-24 relative overflow-hidden" style={{
      background: 'linear-gradient(180deg, #87CEEB 0%, #B0E0E6 30%, #E0F2FE 70%, #F0F9FF 100%)'
    }}>
      {/* Nuages décoratifs (v3.22.3 plus gros) */}
      <div className="absolute top-8 left-2 text-8xl opacity-80 pointer-events-none">☁️</div>
      <div className="absolute top-32 right-2 text-7xl opacity-60 pointer-events-none">☁️</div>
      <div className="absolute top-96 left-6 text-7xl opacity-70 pointer-events-none">☁️</div>
      <div className="absolute top-[40rem] right-2 text-8xl opacity-60 pointer-events-none">☁️</div>
      <div className="absolute top-[60rem] left-4 text-7xl opacity-50 pointer-events-none">☁️</div>

      {/* Header sticky avec sélecteur de niveau */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-rule p-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <Link href="/dashboard" className="text-xs text-primary-700 hover:underline">← Dashboard</Link>
            <div className="text-xs text-gray-600">
              {stats && (
                <span>{stats.completed_courses}/{stats.total_courses} leçons · {stats.total_words} mots</span>
              )}
            </div>
          </div>
          <div className="flex gap-1 flex-wrap">
            {LEVELS.map(lvl => (
              <button
                key={lvl}
                onClick={() => setLevel(lvl)}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition flex-shrink-0 ${
                  level === lvl
                    ? 'bg-primary-700 text-white'
                    : 'bg-white text-gray-600 border border-rule hover:border-primary-400'
                }`}
              >
                {lvl} <span className="opacity-70">= {cefrLabel(lvl)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div className="max-w-2xl mx-auto p-4 relative">
        <h1 className="text-2xl font-extrabold text-primary-900 text-center mb-2 drop-shadow">
          {cefrFull(level)}
        </h1>
        {stats && stats.total_courses > 0 && (
          <div className="text-center text-sm text-primary-800 mb-6">
            {stats.completed_courses === stats.total_courses
              ? <span>🏆 Niveau complet ! Passe au suivant.</span>
              : <span>{stats.total_courses - stats.completed_courses} leçon{stats.total_courses - stats.completed_courses > 1 ? 's' : ''} restante{stats.total_courses - stats.completed_courses > 1 ? 's' : ''}</span>}
          </div>
        )}

        {loading && (
          <div className="text-center text-gray-600 py-12">⏳ Chargement du parcours…</div>
        )}

        {error && (
          <div className="text-center text-red-600 py-12">Erreur : {error}</div>
        )}

        {!loading && !error && courses.length === 0 && (
          <div className="text-center text-gray-600 py-12">
            Aucun cours pour ce niveau (la biblio est peut-être vide).
          </div>
        )}

        {/* Grille zigzag : 1 carte par ligne, alternant gauche/droite */}
        <div className="space-y-2 relative z-10">
          {courses.map((course, i) => {
            const side = i % 4 === 0 ? 'center' : i % 4 === 1 ? 'right' : i % 4 === 2 ? 'center' : 'left'
            return <CourseCard key={course.id} course={course} side={side as any} />
          })}
        </div>

        {/* Certificat de fin de niveau */}
        {courses.length > 0 && courses.every(c => c.status === 'completed') && (
          <div className="mt-8 mx-auto max-w-xs bg-gradient-to-br from-blue-400 to-purple-500 rounded-2xl p-6 text-white text-center shadow-2xl">
            <div className="text-5xl mb-2">🎓</div>
            <div className="text-xl font-extrabold">Niveau {level} terminé !</div>
            <div className="text-sm opacity-90 mt-1">Tu peux passer au niveau suivant.</div>
            <Link href={`/quiz?level=${level}`} className="mt-4 inline-block px-4 py-2 bg-white text-purple-700 rounded-lg font-bold text-sm">
              Passer le test {level}
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
