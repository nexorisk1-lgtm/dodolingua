/**
 * v3.26.0 — BookReader : pagination + tap-to-translate
 * - 1 paragraphe par page (sauf court → groupé)
 * - Swipe gauche/droite ou flèches
 * - Tap sur un mot → popup traduction
 * - Save word → user_book_progress.saved_words
 */
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'

interface Book {
  id: string
  level: string
  number: number
  title: string
  content: string[]
  questions: string[]
  answers_q: string[]
  cloze: string[]
  answers_c: string[]
  speaking: string[]
  example: string[]
  vocab: string[]
  grammar: string[]
  cover_url: string | null
  word_count: number | null
  estimated_minutes: number | null
}

interface Progress {
  status: string
  progress_pct: number
  last_page: number
  saved_words: any[]
}

interface Props {
  book: Book
  initialProgress: Progress | null
}

export function BookReader({ book, initialProgress }: Props) {
  const router = useRouter()
  const [page, setPage] = useState(initialProgress?.last_page || 0)
  const [savedWords, setSavedWords] = useState<any[]>(initialProgress?.saved_words || [])
  const [translation, setTranslation] = useState<{
    word: string
    fr: string | null
    loading: boolean
    context: string
  } | null>(null)
  const [showVocab, setShowVocab] = useState(false)
  const [showQuestions, setShowQuestions] = useState(false)

  // Pages : couverture + paragraphes + questions + fin
  const pages = ['cover', ...book.content.map((_, i) => `content-${i}`), 'questions', 'end']
  const totalPages = pages.length
  const currentType = pages[page]

  // Sauvegarder la progression à chaque changement de page
  const saveProgress = useCallback(async (pageNum: number, status: 'reading' | 'completed' = 'reading') => {
    const pct = Math.round((pageNum / (totalPages - 1)) * 100)
    try {
      await fetch('/api/library/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_id: book.id,
          status,
          progress_pct: pct,
          last_page: pageNum,
          saved_words: savedWords,
        }),
      })
    } catch (e) {
      console.error('Save progress error:', e)
    }
  }, [book.id, savedWords, totalPages])

  useEffect(() => {
    if (page > 0) saveProgress(page, page === totalPages - 1 ? 'completed' : 'reading')
  }, [page, saveProgress, totalPages])

  const goPrev = () => setPage(p => Math.max(0, p - 1))
  const goNext = () => setPage(p => Math.min(totalPages - 1, p + 1))

  // Swipe gestures
  const touchStart = useRef<number | null>(null)
  const onTouchStart = (e: React.TouchEvent) => { touchStart.current = e.touches[0].clientX }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current === null) return
    const diff = touchStart.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 60) {
      if (diff > 0) goNext()
      else goPrev()
    }
    touchStart.current = null
  }

  // Tap sur un mot → traduction
  const handleWordClick = async (word: string, context: string) => {
    // Nettoyer le mot (ponctuation)
    const clean = word.replace(/[^a-zA-ZÀ-ÿ'-]/g, '').trim()
    if (!clean) return

    setTranslation({ word: clean, fr: null, loading: true, context })
    try {
      const res = await fetch('/api/translate-word', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: clean, context, level: book.level }),
      })
      const data = await res.json()
      setTranslation({ word: clean, fr: data.fr || '?', loading: false, context })
    } catch (e) {
      setTranslation({ word: clean, fr: 'Erreur', loading: false, context })
    }
  }

  const saveWord = () => {
    if (!translation) return
    const entry = {
      word: translation.word,
      fr: translation.fr,
      context: translation.context,
      saved_at: new Date().toISOString(),
    }
    setSavedWords(prev => {
      if (prev.find(w => w.word === translation.word)) return prev
      return [...prev, entry]
    })
    setTranslation(null)
  }

  // Rendu d'un paragraphe avec mots cliquables
  const renderParagraph = (text: string) => {
    // Split en mots tout en conservant les espaces/ponctuation
    const parts = text.split(/(\s+)/)
    return parts.map((part, i) => {
      if (/^\s+$/.test(part)) return <span key={i}>{part}</span>
      // Mot : cliquable
      return (
        <span
          key={i}
          onClick={() => handleWordClick(part, text)}
          className="cursor-pointer hover:bg-yellow-200 active:bg-yellow-300 transition-colors rounded px-0.5"
        >
          {part}
        </span>
      )
    })
  }

  const progressPct = Math.round((page / (totalPages - 1)) * 100)

  return (
    <div
      className="fixed inset-0 bg-gradient-to-b from-amber-50 to-orange-50 flex flex-col z-50"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Header */}
      <header className="bg-white/90 backdrop-blur border-b border-amber-200 px-4 py-3 flex items-center gap-3">
        <Link href="/bibliotheque" className="text-2xl text-primary-700 hover:text-primary-900">←</Link>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-gray-500 uppercase font-bold">{book.level} · {book.number}</div>
          <div className="text-sm font-bold text-primary-900 truncate">{book.title}</div>
        </div>
        <div className="text-xs text-gray-500">{page + 1}/{totalPages}</div>
      </header>

      {/* Progress bar */}
      <div className="h-1 bg-amber-100">
        <div className="h-full bg-amber-500 transition-all" style={{ width: `${progressPct}%` }} />
      </div>

      {/* Contenu page */}
      <main className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-xl mx-auto">
          {currentType === 'cover' && (
            <div className="flex flex-col items-center text-center">
              {book.cover_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={book.cover_url}
                  alt={book.title}
                  className="w-56 rounded-2xl shadow-2xl mb-6"
                />
              )}
              <h1 className="text-3xl font-extrabold text-primary-900 mb-2">{book.title}</h1>
              <div className="text-sm text-gray-600 mb-4">
                {book.level} · {book.estimated_minutes} min · {book.word_count} mots
              </div>
              {book.vocab.length > 0 && (
                <button
                  onClick={() => setShowVocab(true)}
                  className="mt-4 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-bold hover:bg-amber-600"
                >
                  📚 Voir le vocabulaire clé ({book.vocab.length})
                </button>
              )}
              <button
                onClick={goNext}
                className="mt-6 px-6 py-3 bg-primary-700 text-white rounded-xl font-bold shadow-lg hover:bg-primary-800"
              >
                Commencer la lecture →
              </button>
            </div>
          )}

          {currentType?.startsWith('content-') && (() => {
            const idx = parseInt(currentType.split('-')[1])
            const para = book.content[idx]
            return (
              <div className="prose prose-lg max-w-none">
                <p className="text-lg leading-relaxed text-primary-900 whitespace-pre-line">
                  {renderParagraph(para)}
                </p>
              </div>
            )
          })()}

          {currentType === 'questions' && (
            <div>
              <h2 className="text-xl font-bold text-primary-900 mb-4">🤔 Questions de compréhension</h2>
              <ol className="space-y-3 list-decimal pl-6">
                {book.questions.map((q, i) => (
                  <li key={i} className="text-primary-900">
                    <div className="font-medium">{q}</div>
                    <details className="mt-1">
                      <summary className="text-xs text-amber-700 cursor-pointer hover:underline">Voir la réponse</summary>
                      <div className="mt-1 text-sm text-gray-700 italic bg-amber-100 p-2 rounded">{book.answers_q[i]}</div>
                    </details>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {currentType === 'end' && (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-2xl font-extrabold text-primary-900 mb-2">Bravo !</h2>
              <p className="text-gray-700 mb-6">Tu as terminé "{book.title}".</p>

              {savedWords.length > 0 && (
                <div className="bg-white rounded-xl p-4 shadow mb-4 text-left">
                  <h3 className="text-sm font-bold text-primary-900 mb-2">⭐ Mots sauvegardés ({savedWords.length})</h3>
                  <ul className="space-y-1">
                    {savedWords.map((w, i) => (
                      <li key={i} className="text-sm">
                        <b>{w.word}</b> → {w.fr}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {book.speaking.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-left mb-4">
                  <h3 className="text-sm font-bold text-blue-900 mb-2">🎤 À toi de parler</h3>
                  {book.speaking.map((s, i) => (
                    <p key={i} className="text-sm text-blue-800 italic">"{s}"</p>
                  ))}
                </div>
              )}

              <Link
                href="/bibliotheque"
                className="inline-block mt-2 px-6 py-3 bg-primary-700 text-white rounded-xl font-bold hover:bg-primary-800"
              >
                Retour à la bibliothèque
              </Link>
            </div>
          )}
        </div>
      </main>

      {/* Footer navigation */}
      <footer className="bg-white/90 backdrop-blur border-t border-amber-200 px-4 py-3 flex items-center justify-between">
        <button
          onClick={goPrev}
          disabled={page === 0}
          className="px-4 py-2 rounded-lg bg-amber-100 text-amber-900 font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-amber-200"
        >
          ← Précédent
        </button>
        <div className="text-xs text-gray-500">
          {savedWords.length > 0 && `⭐ ${savedWords.length} mots`}
        </div>
        <button
          onClick={goNext}
          disabled={page === totalPages - 1}
          className="px-4 py-2 rounded-lg bg-amber-500 text-white font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-amber-600"
        >
          Suivant →
        </button>
      </footer>

      {/* Popup vocab clé (depuis cover) */}
      {showVocab && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={() => setShowVocab(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-primary-900 mb-3">📚 Vocabulaire clé</h3>
            <ul className="space-y-2">
              {book.vocab.map((v, i) => (
                <li key={i} className="text-sm bg-amber-50 p-2 rounded">{v}</li>
              ))}
            </ul>
            <button onClick={() => setShowVocab(false)} className="mt-4 w-full py-2 bg-primary-700 text-white rounded-lg font-bold">
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Popup traduction mot */}
      {translation && (
        <div className="fixed inset-0 bg-black/30 z-[60] flex items-end sm:items-center justify-center p-4" onClick={() => setTranslation(null)}>
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-xs text-gray-500 uppercase">Anglais</div>
                <div className="text-2xl font-extrabold text-primary-900">{translation.word}</div>
              </div>
              <button onClick={() => setTranslation(null)} className="text-2xl text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div className="border-t border-gray-200 pt-3">
              <div className="text-xs text-gray-500 uppercase">Français</div>
              <div className="text-xl font-bold text-amber-700">
                {translation.loading ? '⏳ Traduction…' : translation.fr}
              </div>
            </div>
            {!translation.loading && translation.fr && (
              <button
                onClick={saveWord}
                disabled={savedWords.find(w => w.word === translation.word)}
                className="mt-4 w-full py-2.5 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 disabled:bg-emerald-500 disabled:cursor-not-allowed"
              >
                {savedWords.find(w => w.word === translation.word) ? '✓ Déjà sauvegardé' : '⭐ Sauvegarder ce mot'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
