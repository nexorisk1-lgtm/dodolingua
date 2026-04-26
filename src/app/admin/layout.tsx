import Link from 'next/link'
import { requireAdmin } from '@/lib/admin'
import { Container } from '@/components/ui/Container'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <header className="bg-primary-900 text-white border-b border-rule">
        <Container className="max-w-5xl flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="font-extrabold">⚙ Admin</Link>
            <span className="text-xs opacity-70">Confidentiel</span>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/admin/concepts" className="hover:underline">Concepts</Link>
            <Link href="/dashboard" className="opacity-70 hover:opacity-100">← Sortir</Link>
          </nav>
        </Container>
      </header>
      <main className="py-6">{children}</main>
    </div>
  )
}
