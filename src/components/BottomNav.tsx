'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/dashboard', label: 'Accueil', icon: '🏠' },
  { href: '/jeux',      label: 'Jeux',    icon: '🎮' },
  { href: '/coach',     label: 'Coach',   icon: '💬' },
  { href: '/ligue',     label: 'Ligue',   icon: '🏆' },
  { href: '/profile',   label: 'Profil',  icon: '👤' },
] as const

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-rule shadow-[0_-2px_10px_rgba(0,0,0,0.04)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-2xl mx-auto flex">
        {TABS.map(tab => {
          const active = pathname === tab.href || (tab.href !== '/dashboard' && pathname.startsWith(tab.href))
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center justify-center py-2 text-xs transition ${
                active ? 'text-primary-700' : 'text-gray-500 hover:text-primary-500'
              }`}
            >
              <span className={`text-xl ${active ? 'scale-110' : ''} transition-transform`}>{tab.icon}</span>
              <span className={`mt-0.5 ${active ? 'font-bold' : 'font-medium'}`}>{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
