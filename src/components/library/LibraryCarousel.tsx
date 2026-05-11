/**
 * v3.27.0 — Carrousel client-side avec flèches navigation
 */
'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'

interface Book {
  id: string
  level: string
  number: number
  title: string
  cover_url: string | null
  word_count: number | null
  estimated_minutes: number | null
}

interface Props {
  books: Book[]
  progressMap: Record<string, { status: string; progress_pct: number }>
}

export function LibraryCarousel({ books, progressMap }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showLeft, setShowLeft] = useState(false)
  const [showRight, setShowRight] = useState(true)

  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
    setShowLeft(scrollLeft > 10)
    setShowRight(scrollLeft + clientWidth < scrollWidth - 10)
  }

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return
    const amount = 360  // ~3 cartes
    scrollRef.current.scrollBy({ left: direction === 'right' ? amount : -amount, behavior: 'smooth' })
  }

  return (
    <div className="relative group">
      {/* Flèche gauche */}
      {showLeft && (
        <button onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white shadow-lg border border-gray-200 flex items-center justify-center text-primary-700 hover:bg-primary-50 hover:scale-110 transition"
          aria-label="Précédent">
          ◀
        </button>
      )}

      {/* Flèche droite */}
      {showRight && (
        <button onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white shadow-lg border border-gray-200 flex items-center justify-center text-primary-700 hover:bg-primary-50 hover:scale-110 transition"
          aria-label="Suivant">
          ▶
        </button>
      )}

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 snap-x snap-mandatory scroll-smooth"
        style={{ scrollbarWidth: 'thin' }}
      >
        {books.map(book => {
          const prog = progressMap[book.id]
          const isCompleted = prog?.status === 'completed'
          const isReading = prog?.status === 'reading'
          return (
            <Link
              key={book.id}
              href={`/bibliotheque/${book.id}` as any}
              className="shrink-0 snap-start w-32 group/card"
            >
              <div className={`relative rounded-xl overflow-hidden bg-gray-100 shadow-md aspect-[2/3] transition-transform group-hover/card:scale-105 ${isCompleted ? 'ring-2 ring-emerald-500 ring-offset-2' : ''}`}>
                {book.cover_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl bg-gradient-to-br from-primary-100 to-primary-200">📖</div>
                )}

                {/* Badge "Lu" visible */}
                {isCompleted && (
                  <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg shadow flex items-center gap-1">
                    ✓ Lu
                  </div>
                )}
                {isReading && !isCompleted && (
                  <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg shadow">
                    {prog.progress_pct}%
                  </div>
                )}

                {/* Numéro */}
                <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                  #{book.number}
                </div>

                {/* Voile sombre pour livres lus */}
                {isCompleted && (
                  <div className="absolute inset-0 bg-emerald-900/10 pointer-events-none" />
                )}
              </div>
              <div className="mt-1.5">
                <div className={`text-[11px] font-bold line-clamp-2 leading-tight ${isCompleted ? 'text-emerald-700' : 'text-primary-900'}`}>
                  {book.title}
                </div>
                {book.estimated_minutes && (
                  <div className="text-[10px] text-gray-500 mt-0.5">
                    📖 {book.estimated_minutes} min · {book.word_count} mots
                  </div>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
