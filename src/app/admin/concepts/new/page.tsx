'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'

export default function NewConceptPage() {
  const router = useRouter()
  const [domain, setDomain] = useState('general')
  const [cefr, setCefr] = useState('A1')
  const [tags, setTags] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    const supabase = createClient()
    const { data, error } = await supabase.from('concepts').insert({
      domain,
      cefr_min: cefr,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    }).select('id').single()
    setBusy(false)
    if (error) { setErr(error.message); return }
    router.push(`/admin/concepts/${data.id}`)
  }

  return (
    <Container className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold text-primary-900">Nouveau concept</h1>
      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <Input label="Domaine" value={domain} onChange={e => setDomain(e.target.value)} placeholder="general, grc_junior, …" />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CEFR minimum</label>
            <select className="w-full px-3 py-2.5 border border-rule rounded-xl text-sm"
              value={cefr} onChange={e => setCefr(e.target.value)}>
              {['A1','A2','B1','B2','C1','C2'].map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
          <Input label="Tags (séparés par virgule)" value={tags} onChange={e => setTags(e.target.value)} placeholder="ex. greeting, politeness" />
          {err && <p className="text-sm text-warn">{err}</p>}
          <Button type="submit" disabled={busy} block>
            {busy ? 'Création…' : 'Créer le concept'}
          </Button>
        </form>
      </Card>
    </Container>
  )
}
