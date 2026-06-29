'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS: { href: string; label: string; icon: string }[] = [
  { href: '/', label: 'Classific.', icon: '🏆' },
  { href: '/classificacao-copa', label: 'Tabela', icon: '📋' },
  { href: '/estatisticas', label: 'Stats', icon: '📊' },
  { href: '/palpite', label: 'Palpites', icon: '🎯' },
]

const HIDDEN = ['/login', '/cadastro', '/esqueci-senha', '/resetar-senha']

export function BottomNav() {
  const pathname = usePathname()
  if (HIDDEN.includes(pathname)) return null

  return (
    <nav
      className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-gray-950/95 backdrop-blur-md border-t border-gray-800"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex">
        {ITEMS.map(item => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              className={`relative flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-colors ${active ? 'text-[#00bf63]' : 'text-gray-400 active:text-gray-200'}`}
            >
              <span className={`text-[26px] leading-none transition-transform ${active ? 'scale-110' : ''}`}>{item.icon}</span>
              <span className="text-xs font-semibold tracking-tight">{item.label}</span>
              {active && <span className="absolute top-0 h-0.5 w-10 rounded-full bg-[#00bf63]" />}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
