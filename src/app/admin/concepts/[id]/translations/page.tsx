'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'

const LANGS = ['en-GB', 'es-ES', 'ar-SA', 'ko-KR', 'zh-CN'] as const

export default function TranslationsAdmin() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [items, setItems] = useState<any[]>([])
  const [lang, setLang] = useState<string>('en-GB')
  const [lemma, setLemma] = useState('')
  const [ipa, setIpa] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const supabase = createClient()
    const { data } = await supabase.from('translations')
      .select('*').eq('concept_id', params.id).order('lang_code')
    setItems(data || [])
  }
  useEffect(() => { load() }, [params.id])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const supabase = createClient()
    await supabase.from('translations').insert({
      concept_id: params.id, lang_code: lang, lemma, ipa: ipa || null,
    })
    setLemma(''); setIpa(''); setBusy(false); load()
  }

  async function remove(id: string) {
    if (!confirm('Supprimer cette traduction ?')) return
    const supabase = createClient()
    await supabase.from('translations').delete().eq('id', id)
    load()
  }

  return (
    <Container className="max-w-3xl space-y-4">
      <Button variant="ghost" size="sm" onClick={() => router.back()}>← Retour</Button>
      <h1 className="text-xl font-bold text-primary-900">Traductions</h1>

      <Card>
        <h2 className="font-bold text-primary-700 mb-3">Ajouter une traduction</h2>
        <form onSubmit={add} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Langue</label>
            <select className="w-full px-3 py-2 border border-rule rounded-xl text-sm"
              value={lang} onChange={e => setLang(e.target.value)}>
              {LANGS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <Input label="Lemme" value={lemma} onChange={e => setLemma(e.target.value)} required />
          <Input label="IPA (optionnel)" value={ipa} onChange={e => setIpa(e.target.value)} placeholder="/həˈləʊ/" />
          <Button type="submit" disabled={busy || !lemma}>Ajouter</Button>
        </form>
      </Card>

      <Card>
        <h2 className="font-bold text-primary-700 mb-3">Existantes ({items.length})</h2>
        <ul className="divide-y divide-rule">
          {items.map(t => (
            <li key={t.id} className="py-2 flex items-center gap-3 text-sm">
              <span className="font-mono text-xs bg-primary-50 text-primary-700 px-2 py-1 rounded">{t.lang_code}</span>
              <span className="font-semibold flex-1">{t.lemma}</span>
              <span className="font-mono text-primary-500 text-xs">{t.ipa || '—'}</span>
              <button onClick={() => remove(t.id)} className="text-warn text-xs font-semibold">🗑</button>
            </li>
          ))}
        </ul>
      </Card>
    </Container>
  )
}
