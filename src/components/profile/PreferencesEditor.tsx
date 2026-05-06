/**
 * v3.21 — Composant client pour éditer les préférences utilisateur.
 * Affiche les prefs en lecture, avec bouton ✏ pour modifier chaque champ.
 * Persistance directe via Supabase (RLS user owns its row).
 */
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Prefs {
  mode?: string | null
  themes?: string[] | null
  goals?: string[] | null
  grc_enabled?: boolean | null
  grc_level?: string | null
  ipa_display?: string | null
}

interface Props {
  initialPrefs: Prefs | null
  userId: string
}

const MODE_OPTIONS = [
  { value: 'complet', label: 'Complet (oral + écrit)' },
  { value: 'oral', label: 'Oral uniquement' },
  { value: 'ecrit', label: 'Écrit uniquement' },
]
const IPA_OPTIONS = [
  { value: 'permanent', label: 'Toujours visible' },
  { value: 'on_demand', label: 'Sur demande' },
  { value: 'never', label: 'Jamais' },
]
const THEMES_OPTIONS = ['Vie quotidienne', 'GRC', 'Voyage', 'Travail', 'Études', 'Loisirs', 'Famille', 'Santé']
const GRC_LEVEL_OPTIONS = ['junior', 'confirme', 'senior', 'expert']

export function PreferencesEditor({ initialPrefs, userId }: Props) {
  const [prefs, setPrefs] = useState<Prefs>(initialPrefs || {})
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function save(field: keyof Prefs, value: any) {
    setSaving(true)
    setMsg(null)
    try {
      const supabase = createClient()
      const newPrefs = { ...prefs, [field]: value }
      // upsert : crée la ligne si inexistante, update sinon
      const { error } = await supabase.from('user_preferences')
        .upsert({ user_id: userId, ...newPrefs }, { onConflict: 'user_id' })
      if (error) throw error
      setPrefs(newPrefs)
      setEditing(null)
      setMsg('✓ Sauvegardé')
      setTimeout(() => setMsg(null), 2000)
    } catch (e: any) {
      setMsg(`Erreur : ${e.message?.slice(0, 80)}`)
    } finally {
      setSaving(false)
    }
  }

  function toggleTheme(t: string) {
    const current = prefs.themes || []
    const next = current.includes(t) ? current.filter(x => x !== t) : [...current, t]
    save('themes', next)
  }

  return (
    <div className="space-y-1">
      {msg && <div className={`text-xs px-2 py-1 rounded ${msg.startsWith('✓') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{msg}</div>}

      {/* Mode */}
      <PrefRow
        label="Mode"
        value={MODE_OPTIONS.find(o => o.value === prefs.mode)?.label || prefs.mode || 'complet'}
        editing={editing === 'mode'}
        onEdit={() => setEditing(editing === 'mode' ? null : 'mode')}
      >
        <div className="flex flex-col gap-1">
          {MODE_OPTIONS.map(o => (
            <label key={o.value} className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="radio" checked={prefs.mode === o.value} onChange={() => save('mode', o.value)} disabled={saving} />
              {o.label}
            </label>
          ))}
        </div>
      </PrefRow>

      {/* Thèmes */}
      <PrefRow
        label="Thèmes"
        value={(prefs.themes || []).join(', ') || '—'}
        editing={editing === 'themes'}
        onEdit={() => setEditing(editing === 'themes' ? null : 'themes')}
      >
        <div className="flex flex-wrap gap-1.5">
          {THEMES_OPTIONS.map(t => {
            const active = (prefs.themes || []).includes(t)
            return (
              <button key={t} disabled={saving} onClick={() => toggleTheme(t)}
                className={`px-2 py-1 text-xs rounded-full border transition ${active ? 'bg-primary-700 text-white border-primary-700' : 'bg-white text-gray-700 border-rule hover:border-primary-400'}`}>
                {active && '✓ '}{t}
              </button>
            )
          })}
        </div>
      </PrefRow>

      {/* GRC */}
      <PrefRow
        label="GRC (métier)"
        value={prefs.grc_enabled ? `Activé (${prefs.grc_level || 'junior'})` : 'Désactivé'}
        editing={editing === 'grc'}
        onEdit={() => setEditing(editing === 'grc' ? null : 'grc')}
      >
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input type="checkbox" checked={!!prefs.grc_enabled} onChange={e => save('grc_enabled', e.target.checked)} disabled={saving} />
            Activer le mode GRC professionnel
          </label>
          {prefs.grc_enabled && (
            <div className="flex flex-wrap gap-1.5 pl-6">
              {GRC_LEVEL_OPTIONS.map(lvl => (
                <button key={lvl} disabled={saving} onClick={() => save('grc_level', lvl)}
                  className={`px-2 py-1 text-xs rounded-full border ${prefs.grc_level === lvl ? 'bg-primary-700 text-white border-primary-700' : 'bg-white text-gray-700 border-rule'}`}>
                  {lvl}
                </button>
              ))}
            </div>
          )}
        </div>
      </PrefRow>

      {/* IPA */}
      <PrefRow
        label="Affichage IPA"
        value={IPA_OPTIONS.find(o => o.value === prefs.ipa_display)?.label || 'Toujours visible'}
        editing={editing === 'ipa'}
        onEdit={() => setEditing(editing === 'ipa' ? null : 'ipa')}
      >
        <div className="flex flex-col gap-1">
          {IPA_OPTIONS.map(o => (
            <label key={o.value} className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="radio" checked={(prefs.ipa_display || 'permanent') === o.value} onChange={() => save('ipa_display', o.value)} disabled={saving} />
              {o.label}
            </label>
          ))}
        </div>
      </PrefRow>
    </div>
  )
}

function PrefRow({ label, value, editing, onEdit, children }: { label: string; value: string; editing: boolean; onEdit: () => void; children?: React.ReactNode }) {
  return (
    <div className="border-b border-rule py-2">
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-700">{label}</span>
        <div className="flex items-center gap-2">
          <b className="text-primary-700 text-sm">{value}</b>
          <button onClick={onEdit} className="text-xs px-2 py-0.5 rounded bg-primary-50 hover:bg-primary-100 text-primary-700">
            {editing ? '✕' : '✏ Modifier'}
          </button>
        </div>
      </div>
      {editing && <div className="mt-2 p-2 bg-gray-50 rounded">{children}</div>}
    </div>
  )
}
