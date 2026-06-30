'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

const FONT_SIZES = [13, 15, 17] as const

function FontSizeToggle() {
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    const saved = parseInt(localStorage.getItem('fontSize') ?? '0', 10)
    const i = FONT_SIZES.indexOf(saved as any)
    const initial = i >= 0 ? i : 0
    setIdx(initial)
    document.documentElement.style.fontSize = `${FONT_SIZES[initial]}px`
  }, [])

  function cycle() {
    const next = (idx + 1) % FONT_SIZES.length
    setIdx(next)
    const size = FONT_SIZES[next]
    document.documentElement.style.fontSize = `${size}px`
    localStorage.setItem('fontSize', String(size))
  }

  return (
    <button
      onClick={cycle}
      className="flex items-center gap-4 w-full text-left px-6 py-3.5 text-gray-200 hover:bg-gray-800/60 transition-colors"
    >
      <span className="w-6 text-center font-bold text-sm text-gray-400">{idx === 0 ? 'A+' : idx === 1 ? 'A++' : 'A'}</span>
      <span className="font-semibold">Tamanho da fonte</span>
    </button>
  )
}

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
function SimulatorIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  )
}
function BookIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  )
}
function SettingsIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

const MAIN_ITEMS = [
  { href: '/', lines: ['Classificação'], Icon: TrophyIcon },
  { href: '/classificacao-copa', lines: ['Tabela'], Icon: TableIcon },
  { href: '/palpites', lines: ['Palpites'], Icon: TargetIcon },
  { href: '/estatisticas', lines: ['Stats'], Icon: StatsIcon },
] as const

const MORE_ITEMS = [
  { href: '/simulador', label: 'Simulador', Icon: SimulatorIcon },
  { href: '/regras', label: 'Regras', Icon: BookIcon },
  { href: '/admin', label: 'Admin', Icon: SettingsIcon },
] as const

const HIDDEN = ['/login', '/cadastro', '/esqueci-senha', '/resetar-senha']

export function BottomNav() {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => { setMoreOpen(false) }, [pathname])

  if (HIDDEN.includes(pathname)) return null

  const moreActive = MORE_ITEMS.some(({ href }) => pathname.startsWith(href))

  return (
    <>
      {/* Overlay behind drawer (z-[45] covers the nav bar at z-40) */}
      {moreOpen && (
        <div className="fixed inset-0 z-[45]" onClick={() => setMoreOpen(false)} />
      )}

      {/* Slide-up drawer — bottom-0 so translate-y-full hides it fully off-screen */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 bg-gray-950 border-t border-gray-800 transition-transform duration-200 ease-out ${moreOpen ? 'translate-y-0' : 'translate-y-full pointer-events-none'}`}
        style={{ paddingBottom: 'calc(56px + env(safe-area-inset-bottom))' }}
      >
        {MORE_ITEMS.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={() => setMoreOpen(false)}
            className={`flex items-center gap-4 px-6 py-3.5 transition-colors ${pathname.startsWith(href) ? 'text-[#00bf63]' : 'text-gray-200 hover:bg-gray-800/60'}`}
          >
            <Icon className="w-5 h-5 shrink-0" />
            <span className="font-semibold">{label}</span>
          </Link>
        ))}
        <div className="border-t border-gray-800/60">
          <FontSizeToggle />
        </div>
      </div>

      {/* Bottom bar */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 bg-gray-950/95 backdrop-blur-md border-t border-gray-800"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex max-w-7xl mx-auto">
          {MAIN_ITEMS.map(({ href, lines, Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                prefetch
                onClick={() => setMoreOpen(false)}
                className={`relative flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors ${active ? 'text-[#00bf63]' : 'text-gray-400 active:text-gray-200'}`}
              >
                {active && <span className="absolute inset-x-2 inset-y-1 rounded-xl bg-[#00bf63]/15" />}
                <Icon className={`relative w-[24px] h-[24px] transition-transform ${active ? 'scale-110' : ''}`} />
                <span className="relative text-[10px] font-bold tracking-tight leading-tight text-center">
                  {lines[0]}
                </span>
                {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-[#00bf63]" />}
              </Link>
            )
          })}

          {/* Mais */}
          <button
            onClick={() => setMoreOpen(o => !o)}
            className={`relative flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors ${moreOpen || moreActive ? 'text-[#00bf63]' : 'text-gray-400 active:text-gray-200'}`}
          >
            {(moreOpen || moreActive) && <span className="absolute inset-x-2 inset-y-1 rounded-xl bg-[#00bf63]/15" />}
            {moreOpen ? (
              <svg className="relative w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            ) : (
              <svg className="relative w-[22px] h-[22px]" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="1.8" />
                <circle cx="12" cy="12" r="1.8" />
                <circle cx="19" cy="12" r="1.8" />
              </svg>
            )}
            <span className="relative text-[10px] font-bold tracking-tight">Mais</span>
            {(moreActive && !moreOpen) && <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-[#00bf63]" />}
          </button>
        </div>
      </nav>
    </>
  )
}
