/**
 * v3.9 — Sélecteur de voix TTS pour la préférence utilisateur.
 * Liste les voix anglaises disponibles via Web Speech API et permet d'en choisir une.
 * Sauvegarde dans user_voice_pref. Limite : les voix dispo varient selon le navigateur+OS.
 */
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { speak, waitForVoices } from '@/components/games/utils'

interface VoiceOpt {
  name: string
  lang: string
  localService: boolean
}

export function VoicePicker({ initialVoice }: { initialVoice?: string | null }) {
  const [voices, setVoices] = useState<VoiceOpt[]>([])
  const [selected, setSelected] = useState<string | null>(initialVoice || null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    (async () => {
      await waitForVoices(2000)
      const all = window.speechSynthesis.getVoices()
      // Garde uniquement les voix EN (UK + US + autres EN), trie par UK first
      const en = all
        .filter(v => v.lang.startsWith('en'))
        .sort((a, b) => {
          const score = (v: SpeechSynthesisVoice) =>
            (v.lang === 'en-GB' ? 0 : v.lang === 'en-US' ? 1 : 2) +
            (/natural|premium|neural|enhanced/i.test(v.name) ? -10 : 0)
          return score(a) - score(b)
        })
        .map(v => ({ name: v.name, lang: v.lang, localService: v.localService }))
      setVoices(en)
    })()
  }, [])

  function preview(voiceName: string) {
    speak('Hello, this is Dodo speaking. How does my voice sound to you?', voiceName)
  }

  async function save() {
    if (!selected) return
    setSaving(true)
    setSaved(false)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('user_voice_pref').upsert({
          user_id: user.id,
          lang_code: 'en-GB',
          voice_name: selected,
        }, { onConflict: 'user_id,lang_code' })
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } catch {}
    setSaving(false)
  }

  if (voices.length === 0) {
    return (
      <div className="text-xs text-gray-500 italic">
        Chargement des voix de ton navigateur…
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="text-[11px] text-gray-600">
        {voices.length} voix anglaise{voices.length > 1 ? 's' : ''} disponible{voices.length > 1 ? 's' : ''} sur ce navigateur. Les voix varient selon ton appareil.
      </div>
      <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
        {voices.map(v => (
          <div key={v.name}
            className={`flex items-center gap-2 p-2 rounded-lg border-2 ${selected === v.name ? 'border-primary-500 bg-primary-50' : 'border-rule bg-white'}`}>
            <input type="radio" name="voice" checked={selected === v.name}
              onChange={() => setSelected(v.name)} className="shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{v.name}</div>
              <div className="text-[10px] text-gray-500">{v.lang} · {v.localService ? 'local' : 'cloud'}</div>
            </div>
            <button onClick={() => preview(v.name)}
              className="text-[10px] px-2 py-1 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100">
              ▶ Tester
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 pt-2">
        <button onClick={save} disabled={!selected || saving}
          className="flex-1 px-4 py-2 rounded-lg bg-primary-700 text-white font-semibold text-sm disabled:opacity-50">
          {saving ? 'Sauvegarde…' : saved ? '✓ Enregistré' : 'Choisir cette voix'}
        </button>
      </div>
    </div>
  )
}
