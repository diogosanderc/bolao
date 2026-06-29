'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type IconProps = { className?: string }

function TrophyIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
    </svg>
  )
}
function TableIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M3 14.5h18M9 4v16" />
    </svg>
  )
}
function StatsIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18" />
      <rect x="5" y="11" width="3.5" height="7" rx="0.6" />
      <rect x="10.25" y="6" width="3.5" height="12" rx="0.6" />
      <rect x="15.5" y="13" width="3.5" height="5" rx="0.6" />
    </svg>
  )
}
function TargetIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  )
}

const ITEMS: { href: string; label: string; Icon: (p: IconProps) => React.ReactElement }[] = [
  { href: '/', label: 'Classific.', Icon: TrophyIcon },
  { href: '/classificacao-copa', label: 'Tabela', Icon: TableIcon },
  { href: '/estatisticas', label: 'Stats', Icon: StatsIcon },
  { href: '/palpite', label: 'Palpites', Icon: TargetIcon },
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
        {ITEMS.map(({ href, label, Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              prefetch
              className={`relative flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-colors ${active ? 'text-[#00bf63]' : 'text-gray-400 active:text-gray-200'}`}
            >
              <Icon className={`w-[26px] h-[26px] transition-transform ${active ? 'scale-110' : ''}`} />
              <span className="text-xs font-semibold tracking-tight">{label}</span>
              {active && <span className="absolute top-0 h-0.5 w-10 rounded-full bg-[#00bf63]" />}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
