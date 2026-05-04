/**
 * v3.14 — Page de certificat CEFR. Affiche un beau certificat HTML imprimable
 * (l'utilisateur peut l'imprimer en PDF via Cmd+P → Save as PDF).
 */
'use client'

import { useEffect, useState, Suspense} from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

function CertificateInner() {
  const search = useSearchParams()
  const level = (search.get('level') || 'A1').toUpperCase()
  const score = search.get('score') || '0'
  const total = search.get('total') || '20'
  const [name, setName] = useState('Apprenant')
  const today = new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })

  useEffect(() => {
    (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).single()
      if (profile?.display_name) setName(profile.display_name)
    })()
  }, [])

  return (
    <main className="min-h-screen p-6 bg-gradient-to-br from-blue-50 to-amber-50 print:bg-white">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-2xl p-12 print:shadow-none print:p-8 border-8 border-double border-amber-400 print:border-amber-600">
        <div className="text-center space-y-6">
          <div className="text-6xl">🏆</div>
          <div className="text-xs uppercase tracking-widest text-gray-500 font-bold">Certificat de réussite</div>
          <div className="text-3xl font-extrabold text-primary-900">DodoLingua</div>
          <div className="border-t border-b border-amber-300 py-6">
            <div className="text-sm text-gray-700">Décerné à</div>
            <div className="text-4xl font-bold mt-2 mb-3 text-primary-900">{name}</div>
            <div className="text-sm text-gray-700">pour avoir validé le niveau</div>
            <div className="text-5xl font-extrabold mt-3 text-emerald-700">{level}</div>
            <div className="text-xs text-gray-600 mt-2">Common European Framework of Reference</div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs text-gray-500 uppercase font-bold">Score</div>
              <div className="text-lg font-bold text-primary-900">{score} / {total}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase font-bold">Date</div>
              <div className="text-lg font-bold text-primary-900">{today}</div>
            </div>
          </div>
          <div className="text-[10px] text-gray-500 italic mt-6 leading-snug">
            Certificat interne DodoLingua. Reflète une évaluation algorithmique de vocabulaire CEFR sur la bibliothèque DodoLingua.<br />
            Pour une certification reconnue officiellement, voir Cambridge English, EF SET ou TOEFL.
          </div>
        </div>
      </div>
      <div className="max-w-3xl mx-auto mt-4 flex gap-2 print:hidden">
        <button onClick={() => window.print()}
          className="flex-1 px-4 py-2 rounded-lg bg-primary-700 text-white font-semibold text-sm">
          🖨️ Imprimer / Sauver en PDF
        </button>
        <Link href="/dashboard">
          <span className="px-4 py-2 rounded-lg bg-white border border-rule text-gray-700 text-sm font-semibold inline-block">
            ← Dashboard
          </span>
        </Link>
      </div>
    </main>
  )
}

export default function CertificatePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Chargement…</div>}>
      <CertificateInner />
    </Suspense>
  )
}
