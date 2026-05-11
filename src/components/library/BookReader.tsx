/**
 * v3.30.0 — BookReader v5 :
 * + Toggle "🇫🇷 Tout traduire" (mode traduction progressive)
 * + Mini IA conversation post-lecture (page "💬 Discussion" avant la fin)
 * + Repeat after audio sur page Speaking (Web Speech Recognition + score)
 * Conserve : karaoké, STOP audio, traduction phrase par phrase, exercices
 */
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'

interface Book {
  id: string; level: string; number: number; title: string
  content: string[]; questions: string[]; answers_q: string[]
  cloze: string[]; answers_c: string[]; speaking: string[]; example: string[]
  vocab: string[]; grammar: string[]
  cover_url: string | null; word_count: number | null; estimated_minutes: number | null
}
interface Progress { status: string; progress_pct: number; last_page: number; saved_words: any[] }
interface Props { book: Book; initialProgress: Progress | null }

function chunkPages(content: string[], perPage = 2): string[][] {
  const pages: string[][] = []
  for (let i = 0; i < content.length; i += perPage) pages.push(content.slice(i, i + perPage))
  return pages
}
function splitSentences(text: string): string[] {
  const parts = text.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(s => s)
  return parts.length > 0 ? parts : [text]
}
// Score de prononciation : % de mots de la phrase originale présents dans la transcription
function scoreTranscript(original: string, transcript: string): { score: number; matched: string[]; missed: string[] } {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-zà-ÿ\s]/g, '').split(/\s+/).filter(w => w.length > 0)
  const origWords = normalize(original)
  const transWords = new Set(normalize(transcript))
  const matched: string[] = []
  const missed: string[] = []
  for (const w of origWords) {
    if (transWords.has(w)) matched.push(w)
    else missed.push(w)
  }
  const score = origWords.length > 0 ? Math.round((matched.length / origWords.length) * 100) : 0
  return { score, matched, missed }
}

export function BookReader({ book, initialProgress }: Props) {
  const contentPages = chunkPages(book.content, 2)
  // Ajout d'une page "discussion" avant "end"
  const pages: string[] = ['cover', ...contentPages.map((_, i) => `content-${i}`), 'questions', 'cloze', 'speaking', 'discussion', 'end']
  const totalPages = pages.length

  const [page, setPage] = useState(initialProgress?.last_page || 0)
  const [savedWords, setSavedWords] = useState<any[]>(initialProgress?.saved_words || [])
  const [translation, setTranslation] = useState<{ word: string; fr: string | null; loading: boolean; context: string } | null>(null)
  const [showVocab, setShowVocab] = useState(false)
  const [sentenceTrans, setSentenceTrans] = useState<Record<string, string>>({})
  const [openSentences, setOpenSentences] = useState<Record<string, boolean>>({})
  // Mode traduction : 'manual' (par défaut) | 'all' (auto-traduire toutes les phrases)
  const [transMode, setTransMode] = useState<'manual' | 'all'>('manual')
  // Audio
  const [isPlaying, setIsPlaying] = useState(false)
  const [highlightPos, setHighlightPos] = useState<{ paraIdx: number; charStart: number; charEnd: number } | null>(null)
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null)
  // Exercices
  const [revealedAnswers, setRevealedAnswers] = useState<Record<number, boolean>>({})
  const [clozeAnswers, setClozeAnswers] = useState<Record<number, string>>({})
  const [clozeChecked, setClozeChecked] = useState(false)
  // Repeat after audio
  const [recording, setRecording] = useState<{ idx: number } | null>(null)
  const [repeatScores, setRepeatScores] = useState<Record<number, { score: number; matched: string[]; missed: string[]; transcript: string }>>({})
  const recognitionRef = useRef<any>(null)
  // Discussion IA
  const [discussionQuestions, setDiscussionQuestions] = useState<string[] | null>(null)
  const [discussionLoading, setDiscussionLoading] = useState(false)
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant'; text: string }[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  const currentType = pages[page]
  const progressPct = Math.round((page / (totalPages - 1)) * 100)

  const saveProgress = useCallback(async (pageNum: number, status: 'reading' | 'completed' = 'reading') => {
    const pct = Math.round((pageNum / (totalPages - 1)) * 100)
    try {
      await fetch('/api/library/progress', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: book.id, status, progress_pct: pct, last_page: pageNum, saved_words: savedWords }),
      })
    } catch {}
  }, [book.id, savedWords, totalPages])

  useEffect(() => {
    if (page > 0) saveProgress(page, page === totalPages - 1 ? 'completed' : 'reading')
    stopAudio()
    stopRecording()
  }, [page, saveProgress, totalPages])

  useEffect(() => { return () => { stopAudio(); stopRecording() } }, [])

  // Charger les questions IA quand on arrive sur la page discussion
  useEffect(() => {
    if (currentType === 'discussion' && !discussionQuestions && !discussionLoading) {
      setDiscussionLoading(true)
      fetch('/api/book-chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'questions', book_id: book.id }),
      }).then(r => r.json()).then(data => {
        setDiscussionQuestions(data.questions || [])
        setDiscussionLoading(false)
      }).catch(() => {
        setDiscussionQuestions([])
        setDiscussionLoading(false)
      })
    }
  }, [currentType, book.id, discussionQuestions, discussionLoading])

  const stopAudio = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    utterRef.current = null
    setIsPlaying(false)
    setHighlightPos(null)
  }

  const stopRecording = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
      recognitionRef.current = null
    }
    setRecording(null)
  }

  const goPrev = () => setPage(p => Math.max(0, p - 1))
  const goNext = () => setPage(p => Math.min(totalPages - 1, p + 1))

  const touchStart = useRef<number | null>(null)
  const onTouchStart = (e: React.TouchEvent) => { touchStart.current = e.touches[0].clientX }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current === null) return
    const diff = touchStart.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 60) (diff > 0 ? goNext() : goPrev())
    touchStart.current = null
  }

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

  const fetchSentence = async (key: string, text: string) => {
    if (sentenceTrans[key] && sentenceTrans[key] !== '⏳') return
    setSentenceTrans(prev => ({ ...prev, [key]: '⏳' }))
    try {
      const res = await fetch('/api/translate-sentence', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentence: text.slice(0, 280) }),
      })
      const data = await res.json()
      setSentenceTrans(prev => ({ ...prev, [key]: data.fr || 'N/A' }))
    } catch {
      setSentenceTrans(prev => ({ ...prev, [key]: 'Erreur' }))
    }
  }

  const toggleSentence = async (key: string, text: string) => {
    const isOpen = openSentences[key]
    setOpenSentences(prev => ({ ...prev, [key]: !isOpen }))
    if (!isOpen) fetchSentence(key, text)
  }

  // Toggle mode "Tout traduire" : ouvre/ferme toutes les phrases de la page courante
  const toggleAllTranslation = () => {
    const newMode = transMode === 'all' ? 'manual' : 'all'
    setTransMode(newMode)
    if (newMode === 'all') {
      // Ouvrir et traduire toutes les phrases de la page courante
      if (currentType?.startsWith('content-')) {
        const idx = parseInt(currentType.split('-')[1])
        const paras = contentPages[idx] || []
        paras.forEach((para, paraI) => {
          const sentences = splitSentences(para)
          sentences.forEach((sent, sentI) => {
            const key = `${idx}-${paraI}-${sentI}`
            setOpenSentences(prev => ({ ...prev, [key]: true }))
            fetchSentence(key, sent)
          })
        })
      }
    } else {
      // Mode manual : fermer toutes
      setOpenSentences({})
    }
  }

  const speakText = (text: string, paraIdx: number, speed = 1) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    stopAudio()
    setIsPlaying(true)
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'en-US'
    utter.rate = speed
    utter.onboundary = (event: any) => {
      if (event.name === 'word' || event.charIndex !== undefined) {
        const start = event.charIndex
        const remaining = text.slice(start)
        const match = remaining.match(/^\S+/)
        const end = start + (match ? match[0].length : 1)
        setHighlightPos({ paraIdx, charStart: start, charEnd: end })
      }
    }
    utter.onend = () => { setIsPlaying(false); setHighlightPos(null); utterRef.current = null }
    utter.onerror = () => { setIsPlaying(false); setHighlightPos(null); utterRef.current = null }
    utterRef.current = utter
    window.speechSynthesis.speak(utter)
  }

  // Repeat after audio : démarrer l'enregistrement vocal
  const startRecording = (idx: number, originalSentence: string) => {
    if (typeof window === 'undefined') return
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      alert('Reconnaissance vocale non supportée sur ce navigateur. Utilise Chrome/Safari.')
      return
    }
    stopRecording()
    stopAudio()
    const recognition = new SR()
    recognition.lang = 'en-US'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onstart = () => setRecording({ idx })
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      const result = scoreTranscript(originalSentence, transcript)
      setRepeatScores(prev => ({ ...prev, [idx]: { ...result, transcript } }))
      setRecording(null)
    }
    recognition.onerror = (event: any) => {
      console.error('SpeechRecognition error:', event.error)
      setRecording(null)
      if (event.error === 'not-allowed') {
        alert('Autorise l\'accès au micro pour utiliser cette fonctionnalité.')
      }
    }
    recognition.onend = () => setRecording(null)
    recognitionRef.current = recognition
    try { recognition.start() } catch { setRecording(null) }
  }

  // Conversation IA
  const sendChatMessage = async (msg: string) => {
    if (!msg.trim() || chatLoading) return
    const newHistory = [...chatHistory, { role: 'user' as const, text: msg.trim() }]
    setChatHistory(newHistory)
    setChatInput('')
    setChatLoading(true)
    try {
      const res = await fetch('/api/book-chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'chat', book_id: book.id, message: msg.trim(), history: chatHistory }),
      })
      const data = await res.json()
      setChatHistory([...newHistory, { role: 'assistant' as const, text: data.reply || 'Désolé, je n\'ai pas compris.' }])
    } catch {
      setChatHistory([...newHistory, { role: 'assistant' as const, text: 'Désolé, je ne peux pas répondre pour l\'instant.' }])
    } finally {
      setChatLoading(false)
    }
  }

  const renderSentence = (text: string, paraIdx: number, charOffset: number) => {
    if (highlightPos && highlightPos.paraIdx === paraIdx) {
      const localStart = highlightPos.charStart - charOffset
      const localEnd = highlightPos.charEnd - charOffset
      if (localStart >= 0 && localStart < text.length) {
        const before = text.slice(0, localStart)
        const word = text.slice(localStart, Math.min(localEnd, text.length))
        const after = text.slice(Math.min(localEnd, text.length))
        return (
          <>{renderClickable(before, text)}<span className="bg-yellow-300 rounded px-1 transition-colors">{word}</span>{renderClickable(after, text)}</>
        )
      }
    }
    return renderClickable(text, text)
  }

  const renderClickable = (text: string, context: string) => {
    const parts = text.split(/(\s+)/)
    return parts.map((part, i) => {
      if (/^\s+$/.test(part)) return <span key={i}>{part}</span>
      return (
        <span key={i} onClick={() => handleWordClick(part, context)}
          className="cursor-pointer hover:bg-yellow-100 active:bg-yellow-200 transition-colors rounded">
          {part}
        </span>
      )
    })
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-amber-50 to-orange-50 flex flex-col z-50"
         onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <header className="bg-white/90 backdrop-blur border-b border-amber-200 px-4 py-3 flex items-center gap-3">
        <Link href="/bibliotheque" onClick={() => { stopAudio(); stopRecording() }} className="text-2xl text-primary-700 hover:text-primary-900">←</Link>
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
                <button onClick={() => speakText(book.title, -1, 0.9)}
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

          {/* CONTENT — phrase par phrase + toggle "tout traduire" */}
          {currentType?.startsWith('content-') && (() => {
            const idx = parseInt(currentType.split('-')[1])
            const paras = contentPages[idx] || []
            return (
              <div>
                {/* Toggle mode traduction */}
                <div className="mb-4 flex justify-center">
                  <button onClick={toggleAllTranslation}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition ${
                      transMode === 'all'
                        ? 'bg-amber-500 text-white shadow-md'
                        : 'bg-white text-amber-700 border border-amber-300 hover:bg-amber-50'
                    }`}>
                    {transMode === 'all' ? '🇫🇷 Toutes les traductions affichées' : '🇫🇷 Tout traduire'}
                  </button>
                </div>

                <div className="space-y-6">
                  {paras.map((para, paraI) => {
                    const sentences = splitSentences(para)
                    return (
                      <div key={paraI} className="space-y-2">
                        {sentences.map((sent, sentI) => {
                          const key = `${idx}-${paraI}-${sentI}`
                          const charOffset = sentences.slice(0, sentI).join(' ').length + (sentI > 0 ? 1 : 0)
                          const isOpen = openSentences[key]
                          return (
                            <div key={sentI}>
                              <div className="flex items-start gap-2">
                                <p className="flex-1 text-lg leading-relaxed text-primary-900 whitespace-pre-line">
                                  {renderSentence(sent, paraI, charOffset)}
                                </p>
                                <button onClick={() => toggleSentence(key, sent)}
                                  className={`shrink-0 mt-1.5 w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm transition ${
                                    isOpen ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                  }`}
                                  aria-label={isOpen ? 'Cacher' : 'Voir traduction'}>
                                  {isOpen ? '−' : '+'}
                                </button>
                              </div>
                              {isOpen && (
                                <div className="mt-1 ml-3 pl-3 border-l-2 border-amber-300 text-sm text-amber-800 italic">
                                  {sentenceTrans[key] || '⏳'}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>

                <div className="mt-6 flex flex-wrap gap-2 justify-center sticky bottom-2 bg-white/80 backdrop-blur p-2 rounded-lg shadow-sm">
                  {!isPlaying ? (
                    <>
                      <button onClick={() => speakText(paras.join(' '), 0, 1)}
                        className="px-3 py-2 bg-blue-500 text-white rounded-lg text-xs font-bold hover:bg-blue-600">
                        🔊 Écouter
                      </button>
                      <button onClick={() => speakText(paras.join(' '), 0, 0.6)}
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

          {/* SPEAKING + Repeat after audio */}
          {currentType === 'speaking' && (
            <div>
              <h2 className="text-xl font-bold text-primary-900 mb-3">🎤 À toi de parler</h2>
              <p className="text-sm text-gray-600 mb-4">Lis ces phrases à voix haute. Clique sur 🎤 pour t'auto-évaluer.</p>
              <div className="space-y-3">
                {book.speaking.map((s, i) => {
                  const sentence = s.replace(/["“”]/g, '')
                  const score = repeatScores[i]
                  const isRecording = recording?.idx === i
                  return (
                    <div key={i} className="bg-white rounded-xl p-4 shadow border-l-4 border-blue-500">
                      <div className="text-lg text-primary-900 mb-2">{s}</div>
                      <div className="flex gap-2 flex-wrap">
                        {!isPlaying && !isRecording ? (
                          <button onClick={() => speakText(sentence, -1, 0.9)}
                            className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-bold hover:bg-blue-600">
                            🔊 Écouter
                          </button>
                        ) : isPlaying ? (
                          <button onClick={stopAudio}
                            className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 animate-pulse">
                            ⏹️ Stop
                          </button>
                        ) : null}

                        {!isRecording ? (
                          <button onClick={() => startRecording(i, sentence)}
                            disabled={isPlaying}
                            className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-bold hover:bg-emerald-600 disabled:opacity-50">
                            🎤 Je répète
                          </button>
                        ) : (
                          <button onClick={stopRecording}
                            className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 animate-pulse">
                            🔴 J'écoute… (stop)
                          </button>
                        )}
                      </div>

                      {/* Résultat repeat */}
                      {score && (
                        <div className={`mt-3 p-3 rounded-lg ${
                          score.score >= 80 ? 'bg-emerald-50 border border-emerald-300' :
                          score.score >= 50 ? 'bg-amber-50 border border-amber-300' :
                          'bg-red-50 border border-red-300'
                        }`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-xl font-extrabold ${
                              score.score >= 80 ? 'text-emerald-700' :
                              score.score >= 50 ? 'text-amber-700' :
                              'text-red-700'
                            }`}>
                              {score.score >= 80 ? '🎉' : score.score >= 50 ? '👍' : '💪'} {score.score}%
                            </span>
                            <span className="text-xs text-gray-600">{score.matched.length} mots sur {score.matched.length + score.missed.length}</span>
                          </div>
                          <div className="text-xs text-gray-700 mt-1">
                            <span className="text-gray-500">Tu as dit : </span>
                            <span className="italic">"{score.transcript}"</span>
                          </div>
                          {score.missed.length > 0 && (
                            <div className="text-xs text-red-700 mt-1">
                              Mots manqués : <b>{score.missed.join(', ')}</b>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {book.example.length > 0 && (
                <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <div className="text-xs text-emerald-700 uppercase font-bold mb-1">💡 Exemple complet</div>
                  {book.example.map((e, i) => <div key={i} className="text-sm text-emerald-900 italic">{e}</div>)}
                </div>
              )}
              <p className="text-center text-[11px] text-gray-500 mt-4">
                💡 La reconnaissance vocale fonctionne mieux sur Chrome et Safari
              </p>
            </div>
          )}

          {/* DISCUSSION IA */}
          {currentType === 'discussion' && (
            <div>
              <h2 className="text-xl font-bold text-primary-900 mb-3">💬 Discute avec Dodo</h2>
              <p className="text-sm text-gray-600 mb-4">Dodo a quelques questions sur l'histoire que tu viens de lire.</p>

              {discussionLoading && (
                <div className="text-center py-8 text-amber-700">⏳ Dodo prépare ses questions...</div>
              )}

              {!discussionLoading && discussionQuestions && discussionQuestions.length > 0 && chatHistory.length === 0 && (
                <div className="space-y-2 mb-4">
                  <div className="text-xs text-gray-500 uppercase font-bold mb-2">Choisis une question pour commencer :</div>
                  {discussionQuestions.map((q, i) => (
                    <button key={i} onClick={() => sendChatMessage(q)}
                      className="w-full text-left p-3 bg-white border border-amber-200 rounded-xl text-sm text-primary-900 hover:bg-amber-50 hover:border-amber-400 transition">
                      <span className="text-amber-600 mr-2">▸</span>{q}
                    </button>
                  ))}
                </div>
              )}

              {chatHistory.length > 0 && (
                <div className="space-y-3 mb-4">
                  {chatHistory.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                        m.role === 'user'
                          ? 'bg-blue-500 text-white rounded-br-sm'
                          : 'bg-white border border-amber-200 text-primary-900 rounded-bl-sm'
                      }`}>
                        {m.role === 'assistant' && <div className="text-xs text-amber-600 font-bold mb-0.5">🦤 Dodo</div>}
                        <div className="text-sm">{m.text}</div>
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-amber-200 rounded-2xl rounded-bl-sm px-4 py-2">
                        <div className="text-xs text-amber-600 font-bold mb-0.5">🦤 Dodo</div>
                        <div className="text-sm">⏳ ...</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {chatHistory.length > 0 && (
                <div className="flex gap-2 sticky bottom-2 bg-white/90 backdrop-blur p-2 rounded-xl shadow-sm border border-amber-200">
                  <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') sendChatMessage(chatInput) }}
                    placeholder="Ta réponse..."
                    disabled={chatLoading}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-amber-500 focus:outline-none"
                  />
                  <button onClick={() => sendChatMessage(chatInput)} disabled={chatLoading || !chatInput.trim()}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-bold hover:bg-blue-600 disabled:opacity-50">
                    Envoyer
                  </button>
                </div>
              )}

              {chatHistory.length > 0 && (
                <p className="text-center text-[11px] text-gray-500 mt-3">
                  💡 Réponds en français ou en anglais — Dodo te comprendra
                </p>
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
              <Link href="/bibliotheque" onClick={() => { stopAudio(); stopRecording() }}
                className="inline-block mt-2 px-6 py-3 bg-primary-700 text-white rounded-xl font-bold hover:bg-primary-800">
                Retour à la bibliothèque
              </Link>
            </div>
          )}
        </div>
      </main>

      <footer className="bg-white/90 backdrop-blur border-t border-amber-200 px-4 py-3 flex items-center justify-between">
        <button onClick={goPrev} disabled={page === 0}
          className="px-4 py-2 rounded-lg bg-amber-100 text-amber-900 font-bold disabled:opacity-30 hover:bg-amber-200">
          ← Précédent
        </button>
        <div className="text-xs text-gray-500">{savedWords.length > 0 && `⭐ ${savedWords.length} mots`}</div>
        <button onClick={goNext} disabled={page === totalPages - 1}
          className="px-4 py-2 rounded-lg bg-amber-500 text-white font-bold disabled:opacity-30 hover:bg-amber-600">
          Suivant →
        </button>
      </footer>

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
                <button onClick={() => speakText(translation.word, -1, 0.9)}
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
