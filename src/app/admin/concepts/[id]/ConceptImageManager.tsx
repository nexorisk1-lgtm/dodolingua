'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ConceptImage } from '@/components/ConceptImage'

interface Props {
  conceptId: string
  initialUrl: string | null
  initialAlt: string | null
  initialAttribution: string | null
}

export function ConceptImageManager({ conceptId, initialUrl, initialAlt, initialAttribution }: Props) {
  const router = useRouter()
  const [url, setUrl] = useState(initialUrl || '')
  const [alt, setAlt] = useState(initialAlt || '')
  const [attr, setAttr] = useState(initialAttribution || '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 2 * 1024 * 1024) { setErr('Image trop lourde (>2 MB).'); return }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(f.type)) {
      setErr('Format non supporté (PNG, JPEG, WebP uniquement).'); return
    }
    setBusy(true); setErr(null); setMsg(null)
    const fd = new FormData()
    fd.append('file', f)
    fd.append('alt', alt)
    fd.append('attribution', attr)
    const res = await fetch(`/api/admin/concepts/${conceptId}/image`, { method: 'POST', body: fd })
    const json = await res.json()
    setBusy(false)
    if (!res.ok) { setErr(json.error || 'Erreur upload'); return }
    setUrl(json.url)
    setMsg('Image enregistrée.')
    router.refresh()
  }

  async function saveUrl() {
    setBusy(true); setErr(null); setMsg(null)
    const res = await fetch(`/api/admin/concepts/${conceptId}/image`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, alt, attribution: attr }),
    })
    const json = await res.json()
    setBusy(false)
    if (!res.ok) { setErr(json.error || 'Erreur'); return }
    setMsg('Métadonnées enregistrées.')
    router.refresh()
  }

  async function remove() {
    if (!confirm('Supprimer définitivement cette image ?')) return
    setBusy(true); setErr(null); setMsg(null)
    const res = await fetch(`/api/admin/concepts/${conceptId}/image`, { method: 'DELETE' })
    setBusy(false)
    if (!res.ok) { setErr('Erreur suppression'); return }
    setUrl(''); setAlt(''); setAttr('')
    setMsg('Image supprimée.')
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {url ? (
        <div className="flex flex-col items-center gap-3">
          <ConceptImage url={url} alt={alt} variant="lesson" />
          <span className="text-xs text-gray-500 font-mono break-all max-w-full">{url}</span>
        </div>
      ) : (
        <div className="text-sm text-gray-500 text-center py-6 border-2 border-dashed border-rule rounded-xl">
          Aucune image. Le concept fonctionne sans (parcours utilisateur fluide).
        </div>
      )}

      <div className="flex flex-wrap gap-2 justify-center">
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleFile} />
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
          📤 Uploader (PNG/JPG/WebP, max 2 MB)
        </Button>
        {url && (
          <Button variant="ghost" size="sm" disabled={busy} onClick={remove} className="!text-warn">
            🗑 Supprimer
          </Button>
        )}
      </div>

      <div className="border-t border-rule pt-4 space-y-3">
        <Input label="OU URL externe (https://…)" type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" />
        <Input label="Alt text (accessibilité)" value={alt} onChange={e => setAlt(e.target.value)} placeholder="ex. une maison vue de face" />
        <Input label="Attribution (licence, auteur, source)" value={attr} onChange={e => setAttr(e.target.value)} placeholder="ex. CC0, Photo personnelle" />
        <Button size="sm" disabled={busy} onClick={saveUrl}>
          {busy ? 'Enregistrement…' : 'Enregistrer les métadonnées'}
        </Button>
      </div>

      {err && <p className="text-sm text-warn">{err}</p>}
      {msg && <p className="text-sm text-ok">{msg}</p>}
    </div>
  )
}
