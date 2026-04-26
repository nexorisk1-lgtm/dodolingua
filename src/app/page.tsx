import Link from 'next/link'
import { Container } from '@/components/ui/Container'
import { Button } from '@/components/ui/Button'

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="py-4 border-b border-rule bg-white">
        <Container className="flex items-center justify-between">
          <div className="font-extrabold text-primary-700 text-lg">DodoLingua</div>
          <div className="flex gap-2">
            <Link href="/login"><Button variant="ghost" size="sm">Connexion</Button></Link>
            <Link href="/register"><Button size="sm">Créer un compte</Button></Link>
          </div>
        </Container>
      </header>

      <section className="flex-1 flex items-center py-16 md:py-24">
        <Container className="text-center space-y-8">
          <div className="inline-block bg-primary-50 text-primary-700 text-xs font-bold tracking-wider px-3 py-1 rounded-full">
            APPRENTISSAGE INTELLIGENT · 0 € D&apos;ABONNEMENT
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-primary-900 leading-tight">
            Apprends une langue<br />sans t&apos;ennuyer.
          </h1>
          <p className="text-gray-600 text-base md:text-lg max-w-2xl mx-auto">
            Anglais UK, espagnol, arabe, coréen, chinois. 12 jeux, ligues hebdomadaires,
            coach IA et module métier GRC. Tout pour progresser sérieusement,
            avec rigueur et plaisir.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <Link href="/register"><Button size="lg">Commencer gratuitement →</Button></Link>
            <Link href="/login"><Button variant="ghost" size="lg">J&apos;ai déjà un compte</Button></Link>
          </div>
        </Container>
      </section>

      <section className="bg-white py-12 border-t border-rule">
        <Container>
          <div className="grid md:grid-cols-3 gap-6 text-center">
            <Feature emoji="🎓" title="6 étapes par mot" desc="Affichage, audio, IPA, micro, exemple, validation. Avec auto-évaluation FSRS." />
            <Feature emoji="🏆" title="6 ligues hebdo" desc="Bronze à Obsidienne. Top promus, défis entre amis, classement live." />
            <Feature emoji="🛡️" title="Module GRC" desc="Junior, Confirmé, Senior, Expert. Vocabulaire, simulations, rédaction métier." />
          </div>
        </Container>
      </section>

      <footer className="py-6 text-center text-xs text-gray-500 italic border-t border-rule">
        © Raïssa — Propriété intellectuelle. Document confidentiel.
      </footer>
    </main>
  )
}

function Feature({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <div className="space-y-2">
      <div className="text-3xl">{emoji}</div>
      <h3 className="font-bold text-primary-700">{title}</h3>
      <p className="text-sm text-gray-600">{desc}</p>
    </div>
  )
}
