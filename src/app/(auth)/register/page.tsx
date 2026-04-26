'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { display_name: name } },
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    if (data.user && data.session) router.push('/onboarding')
    else setSuccess(true) // confirmation email envoyé
  }

  if (success) {
    return (
      <main className="min-h-screen flex items-center justify-center py-12">
        <Container className="max-w-md">
          <Card className="text-center space-y-4">
            <div className="text-4xl">✉️</div>
            <h1 className="text-xl font-bold text-primary-900">Vérifie ta boîte mail</h1>
            <p className="text-sm text-gray-600">
              Un lien de confirmation a été envoyé à <b>{email}</b>.
              Clique dessus pour activer ton compte.
            </p>
          </Card>
        </Container>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center py-12">
      <Container className="max-w-md">
        <Card className="space-y-5">
          <div className="text-center space-y-1">
            <Link href="/" className="text-primary-700 font-extrabold text-lg">DodoLingua</Link>
            <h1 className="text-2xl font-bold text-primary-900">Créer un compte</h1>
            <p className="text-xs text-gray-500">100 % gratuit. 0 € d&apos;abonnement.</p>
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <Input label="Prénom" type="text" required value={name} onChange={e => setName(e.target.value)} />
            <Input label="Email" type="email" autoComplete="email" required
              value={email} onChange={e => setEmail(e.target.value)} />
            <Input label="Mot de passe" type="password" autoComplete="new-password" required minLength={8}
              value={password} onChange={e => setPassword(e.target.value)} />
            {error && <p className="text-sm text-warn">{error}</p>}
            <Button type="submit" block disabled={loading}>
              {loading ? 'Création…' : 'Créer mon compte'}
            </Button>
          </form>
          <div className="text-sm text-center text-gray-600">
            Déjà inscrit ?{' '}
            <Link href="/login" className="text-primary-700 font-semibold hover:underline">
              Connexion
            </Link>
          </div>
        </Card>
      </Container>
    </main>
  )
}
