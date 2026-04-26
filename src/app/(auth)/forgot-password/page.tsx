'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    })
    setLoading(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <main className="min-h-screen flex items-center justify-center py-12">
      <Container className="max-w-md">
        <Card className="space-y-5">
          <div className="text-center space-y-1">
            <Link href="/" className="text-primary-700 font-extrabold text-lg">DodoLingua</Link>
            <h1 className="text-2xl font-bold text-primary-900">Mot de passe oublié</h1>
          </div>
          {sent ? (
            <div className="text-center space-y-2 py-4">
              <div className="text-3xl">✉️</div>
              <p className="text-sm text-gray-700">
                Si un compte existe pour <b>{email}</b>, un email de réinitialisation a été envoyé.
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <Input label="Email" type="email" autoComplete="email" required
                value={email} onChange={e => setEmail(e.target.value)} />
              {error && <p className="text-sm text-warn">{error}</p>}
              <Button type="submit" block disabled={loading}>
                {loading ? 'Envoi…' : 'Envoyer le lien'}
              </Button>
            </form>
          )}
          <div className="text-sm text-center text-gray-600">
            <Link href="/login" className="text-primary-700 hover:underline">← Retour à la connexion</Link>
          </div>
        </Card>
      </Container>
    </main>
  )
}
