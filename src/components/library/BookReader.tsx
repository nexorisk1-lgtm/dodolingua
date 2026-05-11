/**
 * v3.28.0 — BookReader v3 : karaoké + STOP audio + traduction ligne par ligne
 * - Web Speech API avec onboundary → surbrillance mot par mot pendant lecture
 * - Bouton ⏹️ STOP pour arrêter l'audio
 * - Traduction par paragraphe (chaque paragraphe a sa traduction sous lui)
 * - 2 paragraphes par page
 * - Exercices interactifs à la fin
 */
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'

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

function chunkPages(content: string[], perPage = 2): string[][] {
  const pages: string[][] = []
  for (let i = 0; i < content.length; i += perPage) {
    pages.push(content.slice(i, i + perPage))
  }
  return pages
}

export function BookReader({ book, initialProgress }: Props) {
  const contentPages = chunkPages(book.content, 2)
  const pages: string[] = ['cover', ...contentPages.map((_, i) => `content-${i}`), 'questions', 'cloze', 'speaking', 'end']
  const totalPages = pages.length

  const [page, setPage] = useState(initialProgress?.last_page || 0)
  const [savedWords, setSavedWords] = useState<any[]>(initialProgress?.saved_words || [])
  const [translation, setTranslation] = useState<{ word: string; fr: string | null; loading: boolean; context: string } | null>(null)
  const [showVocab, setShowVocab] = useState(false)
  // Traduction par paragraphe (key = "pageIdx-paraIdx")
  const [paraTranslations, setParaTranslations] = useState<Record<string, string>>({})
  const [showParaTrans, setShowParaTrans] = useState<Record<number, boolean>>({})
  // Audio state
  const [isPlaying, setIsPlaying] = useState(false)
  const [highlightPos, setHighlightPos] = useState<{ paraIdx: number; charStart: number; charEnd: number } | null>(null)
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null)
  // Réponses exercices
  const [revealedAnswers, setRevealedAnswers] = useState<Record<number, boolean>>({})
  const [clozeAnswers, setClozeAnswers] = useState<Record<number, string>>({})
  const [clozeChecked, setClozeChecked] = useState(false)

  const currentType = pages[page]
  const progressPct = Math.round((page / (totalPages - 1)) * 100)

  // Save progress
  const saveProgress = useCallback(async (pageNum: number, status: 'reading' | 'completed' = 'reading') => {
    const pct = Math.round((pageNum / (totalPages - 1)) * 100)
    try {
      await fetch('/api/library/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: book.id, status, progress_pct: pct, last_page: pageNum, saved_words: savedWords }),
      })
    } catch (e) { console.error(e) }
  }, [book.id, savedWords, totalPages])

  useEffect(() => {
    if (page > 0) saveProgress(page, page === totalPages - 1 ? 'completed' : 'reading')
    // Stop audio when changing page
    stopAudio()
  }, [page, saveProgress, totalPages])

  // Cleanup on unmount
  useEffect(() => {
    return () => { stopAudio() }
  }, [])

  const stopAudio = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    utterRef.current = null
    setIsPlaying(false)
    setHighlightPos(null)
  }

  const goPrev = () => setPage(p => Math.max(0, p - 1))
  const goNext = () => setPage(p => Math.min(totalPages - 1, p + 1))

  // Swipe
  const touchStart = useRef<number | null>(null)
  const onTouchStart = (e: React.TouchEvent) => { touchStart.current = e.touches[0].clientX }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current === null) return
    const diff = touchStart.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 60) (diff > 0 ? goNext() : goPrev())
    touchStart.current = null
  }

  // Tap sur un mot → traduction
  const handleWordClick = async (word: string, context: string) => {
    const clean = word.replace(/[^a-zA-ZÀ-ÿ'-]/g, '').trim()
    if (!clean) return
    setTranslation({ word: clean, fr: null, loading: true, context })
    try {
      const res = await fetch('/api/translate-word', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: clean, context, level: book.level }),
      })
      const data = await res.json()
      setTranslation({ word: clean, fr: data.fr || '?', loading: false, context })
    } catch { setTranslation({ word: clean, fr: 'Erreur', loading: false, context }) }
  }

  const saveWord = () => {
    if (!translation) return
    const entry = { word: translation.word, fr: translation.fr, context: translation.context, saved_at: new Date().toISOString() }
    setSavedWords(prev => prev.find(w => w.word === translation.word) ? prev : [...prev, entry])
    setTranslation(null)
  }

  // Traduction d'un paragraphe (ligne par ligne)
  const translateParagraph = async (pageIdx: number, paraIdx: number, text: string) => {
    const key = `${pageIdx}-${paraIdx}`
    if (paraTranslations[key]) return  // déjà fait
    setParaTranslations(prev => ({ ...prev, [key]: '⏳' }))
    try {
      const res = await fetch('/api/translate-sentence', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentence: text.slice(0, 280) }),
      })
      const data = await res.json()
      setParaTranslations(prev => ({ ...prev, [key]: data.fr || 'N/A' }))
    } catch {
      setParaTranslations(prev => ({ ...prev, [key]: 'Erreur' }))
    }
  }

  // Toggle traduction d'une page (traduit tous les paragraphes de la page)
  const togglePageTranslation = (pageIdx: number) => {
    const newState = !showParaTrans[pageIdx]
    setShowParaTrans(prev => ({ ...prev, [pageIdx]: newState }))
    if (newState) {
      // Lancer la traduction de chaque paragraphe
      const paras = contentPages[pageIdx] || []
      paras.forEach((para, i) => {
        translateParagraph(pageIdx, i, para)
      })
    }
  }

  // TTS Web Speech avec karaoké (surbrillance mot par mot)
  const speakParagraph = (text: string, paraIdx: number, speed = 1) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    stopAudio()
    setIsPlaying(true)
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'en-US'
    utter.rate = speed
    utter.onboundary = (event: any) => {
      if (event.name === 'word' || event.charIndex !== undefined) {
        // Détecter la longueur du mot courant
        const start = event.charIndex
        const remaining = text.slice(start)
        const match = remaining.match(/^\S+/)
        const end = start + (match ? match[0].length : 1)
        setHighlightPos({ paraIdx, charStart: start, charEnd: end })
      }
    }
    utter.onend = () => {
      setIsPlaying(false)
      setHighlightPos(null)
      utterRef.current = null
    }
    utter.onerror = () => {
      setIsPlaying(false)
      setHighlightPos(null)
      utterRef.current = null
    }
    utterRef.current = utter
    window.speechSynthesis.speak(utter)
  }

  // Rendu d'un paragraphe avec mots cliquables + highlight karaoké
  const renderParagraph = (text: string, paraIdx: number) => {
    // Si highlight actif sur ce paragraphe : surligner le mot courant
    if (highlightPos && highlightPos.paraIdx === paraIdx) {
      const { charStart, charEnd } = highlightPos
      const before = text.slice(0, charStart)
      const word = text.slice(charStart, charEnd)
      const after = text.slice(charEnd)
      return (
        <>
          {renderClickableText(before, text)}
          <span className="bg-yellow-300 rounded px-1 transition-colors">{word}</span>
          {renderClickableText(after, text)}
        </>
      )
    }
    return renderClickableText(text, text)
  }

  const renderClickableText = (text: string, fullContext: string) => {
    const parts = text.split(/(\s+)/)
    return parts.map((part, i) => {
      if (/^\s+$/.test(part)) return <span key={i}>{part}</span>
      return (
        <span key={i} onClick={() => handleWordClick(part, fullContext)}
          className="cursor-pointer hover:bg-yellow-100 active:bg-yellow-200 transition-colors rounded">
          {part}
        </span>
      )
    })
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-amber-50 to-orange-50 flex flex-col z-50"
         onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* Header */}
      <header className="bg-white/90 backdrop-blur border-b border-amber-200 px-4 py-3 flex items-center gap-3">
        <Link href="/bibliotheque" onClick={stopAudio} className="text-2xl text-primary-700 hover:text-primary-900">←</Link>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-gray-500 uppercase font-bold">{book.level} · {book.number}</div>
          <div className="text-sm font-bold text-primary-900 truncate">{book.title}</div>
        </div>
        <div className="text-xs text-gray-500">{page + 1}/{totalPages}</div>
      </header>

      <div className="h-1 bg-amber-100">
        <div className="h-full bg-amber-500 transition-all" style={{ width: `${progressPct}%` }} />
      </div>

      <main className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-2xl mx-auto">
          {/* COVER */}
          {currentType === 'cover' && (
            <div className="flex flex-col items-center text-center">
              {book.cover_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={book.cover_url} alt={book.title} className="w-56 rounded-2xl shadow-2xl mb-6" />
              )}
              <h1 className="text-3xl font-extrabold text-primary-900 mb-2">{book.title}</h1>
              <div className="text-sm text-gray-600 mb-4">{book.level} · {book.estimated_minutes} min · {book.word_count} mots</div>
              {!isPlaying ? (
                <button onClick={() => speakParagraph(book.title, -1, 0.9)}
                  className="mb-3 px-4 py-2 bg-blue-100 text-blue-800 rounded-lg text-sm font-bold hover:bg-blue-200">
                  🔊 Écouter le titre
                </button>
              ) : (
                <button onClick={stopAudio}
                  className="mb-3 px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-bold hover:bg-red-600 animate-pulse">
                  ⏹️ Arrêter
                </button>
              )}
              {book.vocab.length > 0 && (
                <button onClick={() => setShowVocab(true)}
                  className="mt-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-bold hover:bg-amber-600">
                  📚 Voir le vocabulaire clé ({book.vocab.length})
                </button>
              )}
              <button onClick={goNext}
                className="mt-6 px-6 py-3 bg-primary-700 text-white rounded-xl font-bold shadow-lg hover:bg-primary-800">
                Commencer la lecture →
              </button>
            </div>
          )}

          {/* CONTENT */}
          {currentType?.startsWith('content-') && (() => {
            const idx = parseInt(currentType.split('-')[1])
            const paras = contentPages[idx] || []
            const showTrans = showParaTrans[idx]
            return (
              <div>
                <div className="space-y-5">
                  {paras.map((para, i) => {
                    const transKey = `${idx}-${i}`
                    return (
                      <div key={i}>
                        <p className="text-lg leading-relaxed text-primary-900 whitespace-pre-line">
                          {renderParagraph(para, i)}
                        </p>
                        {/* Traduction directement sous le paragraphe */}
                        {showTrans && (
                          <div className="mt-2 pl-3 border-l-2 border-amber-300 text-sm text-amber-800 italic whitespace-pre-line">
                            {paraTranslations[transKey] || '⏳'}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Toolbar */}
                <div className="mt-6 flex flex-wrap gap-2 justify-center sticky bottom-2 bg-white/80 backdrop-blur p-2 rounded-lg shadow-sm">
                  {!isPlaying ? (
                    <>
                      <button onClick={() => speakParagraph(paras.join(' '), 0, 1)}
                        className="px-3 py-2 bg-blue-500 text-white rounded-lg text-xs font-bold hover:bg-blue-600">
                        🔊 Écouter
                      </button>
                      <button onClick={() => speakParagraph(paras.join(' '), 0, 0.6)}
                        className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-200">
                        🐢 Lent
                      </button>
                    </>
                  ) : (
                    <button onClick={stopAudio}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 animate-pulse">
                      ⏹️ Stop
                    </button>
                  )}
                  <button onClick={() => togglePageTranslation(idx)}
                    className="px-3 py-2 bg-amber-100 text-amber-800 rounded-lg text-xs font-bold hover:bg-amber-200">
                    {showTrans ? '➖ Cacher FR' : '➕ Voir FR'}
                  </button>
                </div>
              </div>
            )
          })()}

          {/* QUESTIONS */}
          {currentType === 'questions' && (
            <div>
              <h2 className="text-xl font-bold text-primary-900 mb-3">🤔 Questions de compréhension</h2>
              <p className="text-sm text-gray-600 mb-4">Réponds à chaque question, puis clique pour vérifier.</p>
              <ol className="space-y-4 list-decimal pl-6">
                {book.questions.map((q, i) => (
                  <li key={i} className="text-primary-900">
                    <div className="font-medium mb-2">{q}</div>
                    {!revealedAnswers[i] ? (
                      <button onClick={() => setRevealedAnswers(prev => ({ ...prev, [i]: true }))}
                        className="text-xs px-3 py-1.5 bg-amber-500 text-white rounded-lg font-bold hover:bg-amber-600">
                        Voir la réponse
                      </button>
                    ) : (
                      <div className="mt-1 text-sm text-emerald-800 bg-emerald-50 p-2 rounded border border-emerald-200">
                        ✓ {book.answers_q[i]}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* CLOZE */}
          {currentType === 'cloze' && (
            <div>
              <h2 className="text-xl font-bold text-primary-900 mb-3">📝 Complète les phrases</h2>
              <p className="text-sm text-gray-600 mb-4">Tape le mot manquant pour chaque phrase, puis vérifie.</p>
              <div className="space-y-4">
                {book.cloze.map((sentence, i) => {
                  const correct = book.answers_c[i] || ''
                  const userAnswer = (clozeAnswers[i] || '').trim().toLowerCase()
                  const isCorrect = clozeChecked && userAnswer === correct.toLowerCase()
                  const isWrong = clozeChecked && userAnswer !== correct.toLowerCase()
                  return (
                    <div key={i} className="bg-white rounded-xl p-3 shadow-sm">
                      <div className="text-base text-primary-900 mb-2">{sentence}</div>
                      <input type="text" value={clozeAnswers[i] || ''}
                        onChange={e => setClozeAnswers(prev => ({ ...prev, [i]: e.target.value }))}
                        placeholder="ta réponse..." disabled={clozeChecked}
                        className={`w-full px-3 py-2 rounded-lg border-2 text-sm ${
                          isCorrect ? 'border-emerald-500 bg-emerald-50' :
                          isWrong ? 'border-red-500 bg-red-50' :
                          'border-gray-300 focus:border-amber-500'
                        }`}
                      />
                      {clozeChecked && isWrong && (
                        <div className="mt-1 text-xs text-red-700">Bonne réponse : <b>{correct}</b></div>
                      )}
                    </div>
                  )
                })}
              </div>
              {!clozeChecked && (
                <button onClick={() => setClozeChecked(true)}
                  className="mt-4 w-full py-2.5 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600">
                  Vérifier mes réponses
                </button>
              )}
              {clozeChecked && (
                <div className="mt-4 text-center text-sm">
                  Score : <b>{book.cloze.filter((_, i) => (clozeAnswers[i] || '').trim().toLowerCase() === (book.answers_c[i] || '').toLowerCase()).length}/{book.cloze.length}</b>
                </div>
              )}
            </div>
          )}

          {/* SPEAKING */}
          {currentType === 'speaking' && (
            <div>
              <h2 className="text-xl font-bold text-primary-900 mb-3">🎤 À toi de parler</h2>
              <p className="text-sm text-gray-600 mb-4">Lis ces phrases à voix haute pour pratiquer.</p>
              <div className="space-y-3">
                {book.speaking.map((s, i) => (
                  <div key={i} className="bg-white rounded-xl p-4 shadow border-l-4 border-blue-500">
                    <div className="text-lg text-primary-900 mb-2">{s}</div>
                    {!isPlaying ? (
                      <button onClick={() => speakParagraph(s.replace(/["“”]/g, ''), -1, 0.9)}
                        className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-bold hover:bg-blue-600">
                        🔊 Écouter
                      </button>
                    ) : (
                      <button onClick={stopAudio}
                        className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 animate-pulse">
                        ⏹️ Stop
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {book.example.length > 0 && (
                <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <div className="text-xs text-emerald-700 uppercase font-bold mb-1">💡 Exemple complet</div>
                  {book.example.map((e, i) => <div key={i} className="text-sm text-emerald-900 italic">{e}</div>)}
                </div>
              )}
            </div>
          )}

          {/* END */}
          {currentType === 'end' && (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-2xl font-extrabold text-primary-900 mb-2">Bravo !</h2>
              <p className="text-gray-700 mb-6">Tu as terminé "{book.title}".</p>
              {savedWords.length > 0 && (
                <div className="bg-white rounded-xl p-4 shadow mb-4 text-left max-w-md mx-auto">
                  <h3 className="text-sm font-bold text-primary-900 mb-2">⭐ Mots sauvegardés ({savedWords.length})</h3>
                  <ul className="space-y-1">
                    {savedWords.map((w, i) => <li key={i} className="text-sm"><b>{w.word}</b> → {w.fr}</li>)}
                  </ul>
                </div>
              )}
              <Link href="/bibliotheque" onClick={stopAudio}
                className="inline-block mt-2 px-6 py-3 bg-primary-700 text-white rounded-xl font-bold hover:bg-primary-800">
                Retour à la bibliothèque
              </Link>
            </div>
          )}
        </div>
      </main>

      {/* Footer navigation */}
      <footer className="bg-white/90 backdrop-blur border-t border-amber-200 px-4 py-3 flex items-center justify-between">
        <button onClick={goPrev} disabled={page === 0}
          className="px-4 py-2 rounded-lg bg-amber-100 text-amber-900 font-bold disabled:opacity-30 hover:bg-amber-200">
          ← Précédent
        </button>
        <div className="text-xs text-gray-500">
          {savedWords.length > 0 && `⭐ ${savedWords.length} mots`}
        </div>
        <button onClick={goNext} disabled={page === totalPages - 1}
          className="px-4 py-2 rounded-lg bg-amber-500 text-white font-bold disabled:opacity-30 hover:bg-amber-600">
          Suivant →
        </button>
      </footer>

      {/* Popup vocab */}
      {showVocab && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={() => setShowVocab(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-primary-900 mb-3">📚 Vocabulaire clé</h3>
            <ul className="space-y-2">
              {book.vocab.map((v, i) => <li key={i} className="text-sm bg-amber-50 p-2 rounded">{v}</li>)}
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
              <div className="mt-3 flex gap-2">
                <button onClick={() => speakParagraph(translation.word, -1, 0.9)}
                  className="flex-1 py-2 bg-blue-100 text-blue-800 rounded-lg font-bold text-sm hover:bg-blue-200">
                  🔊 Écouter
                </button>
                <button onClick={saveWord} disabled={!!savedWords.find(w => w.word === translation.word)}
                  className="flex-1 py-2 bg-amber-500 text-white rounded-lg font-bold text-sm hover:bg-amber-600 disabled:bg-emerald-500">
                  {savedWords.find(w => w.word === translation.word) ? '✓ Sauvegardé' : '⭐ Sauvegarder'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
