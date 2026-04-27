'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next') || '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) setError(error.message)
    else router.push(next)
  }

  return (
    <Card className="space-y-5">
      <div className="text-center space-y-1">
        <Link href="/" className="text-primary-700 font-extrabold text-lg">DodoLingua</Link>
        <h1 className="text-2xl font-bold text-primary-900">Connexion</h1>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <Input label="Email" type="email" autoComplete="email" required
          value={email} onChange={e => setEmail(e.target.value)} />
        <Input label="Mot de passe" type="password" autoComplete="current-password" required
          value={password} onChange={e => setPassword(e.target.value)} />
        {error && <p className="text-sm text-warn">{error}</p>}
        <Button type="submit" block disabled={loading}>
          {loading ? 'Connexion…' : 'Se connecter'}
        </Button>
      </form>
      <div className="text-sm text-center space-y-2 text-gray-600">
        <Link href="/forgot-password" className="text-primary-700 hover:underline">
          Mot de passe oublié ?
        </Link>
        <div>
          Pas encore de compte ?{' '}
          <Link href="/register" className="text-primary-700 font-semibold hover:underline">
            Créer un compte
          </Link>
        </div>
      </div>
    </Card>
  )
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center py-12">
      <Container className="max-w-md">
        <Suspense fallback={<Card>Chargement…</Card>}>
          <LoginForm />
        </Suspense>
      </Container>
    </main>
  )
}
