'use client'

import { usePathname } from 'next/navigation'

const ITEMS: { href: string; label: string; icon: string }[] = [
  { href: '/', label: 'Classificação', icon: '🏆' },
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
      className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-gray-950/90 backdrop-blur-md border-t border-gray-800"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex">
        {ITEMS.map(item => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          return (
            <a
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${active ? 'text-[#00bf63]' : 'text-gray-500 active:text-gray-300'}`}
            >
              <span className={`text-lg leading-none transition-transform ${active ? 'scale-110' : ''}`}>{item.icon}</span>
              <span className="text-[10px] font-semibold tracking-wide">{item.label}</span>
            </a>
          )
        })}
      </div>
    </nav>
  )
}
