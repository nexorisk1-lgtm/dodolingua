import Link from 'next/link'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'
import { GAME_LIST } from '@/components/games'

export default function GamesHub() {
  return (
    <Container className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-primary-900">🎮 Jeux</h1>
        <p className="text-sm text-gray-600">12 mécaniques. Choisis ton jeu — ou laisse le moteur décider via la quête « Jeu ».</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {GAME_LIST.map(g => (
          <Link key={g.id} href={`/jeux/${g.id}`}>
            <Card className="!p-3 text-center hover:border-primary-500 hover:shadow-soft transition cursor-pointer">
              <div className="text-3xl">{g.emoji}</div>
              <div className="font-semibold text-sm mt-1">{g.name}</div>
              {g.needsImage && <div className="text-[10px] text-gray-400 mt-0.5">image requise</div>}
            </Card>
          </Link>
        ))}
      </div>
    </Container>
  )
}
