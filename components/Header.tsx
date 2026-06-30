'use client'
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
      title="Aumentar / reduzir fonte"
      className="text-white/80 hover:text-white transition-colors font-bold text-xs leading-none px-1.5 py-1 rounded bg-white/10 hover:bg-white/20 shrink-0"
    >
      {idx === 0 ? 'A+' : idx === 1 ? 'A++' : 'A'}
    </button>
  )
}

export function Header() {
  const pathname = usePathname()
  const isAuthPage = ['/login', '/cadastro', '/esqueci-senha', '/resetar-senha'].includes(pathname)
  const [open, setOpen] = useState(false)

  useEffect(() => { setOpen(false) }, [pathname])

  const navLinks = (mobile: boolean) => (
    <>
      <a
        href="/"
        onClick={() => setOpen(false)}
        className={`hover:text-yellow-300 transition-colors text-white font-semibold tracking-wide uppercase ${mobile ? 'py-2 text-base' : 'text-sm'} ${pathname === '/' ? 'text-yellow-300' : ''}`}
      >
        Classificação
      </a>
      <a
        href="/classificacao-copa"
        onClick={() => setOpen(false)}
        className={`hover:text-yellow-300 transition-colors text-white font-semibold tracking-wide uppercase ${mobile ? 'py-2 text-base' : 'text-sm'} ${pathname === '/classificacao-copa' ? 'text-yellow-300' : ''}`}
      >
        Tabela Copa
      </a>
      <a
        href="/simulador"
        onClick={() => setOpen(false)}
        className={`hover:text-yellow-300 transition-colors text-white font-semibold tracking-wide uppercase ${mobile ? 'py-2 text-base' : 'text-sm'} ${pathname === '/simulador' ? 'text-yellow-300' : ''}`}
      >
        Simulador
      </a>
      <a
        href="/estatisticas"
        onClick={() => setOpen(false)}
        className={`hover:text-yellow-300 transition-colors text-white font-semibold tracking-wide uppercase ${mobile ? 'py-2 text-base' : 'text-sm'} ${pathname.startsWith('/estatisticas') ? 'text-yellow-300' : ''}`}
      >
        Estatísticas
      </a>
      <a
        href="/regras"
        onClick={() => setOpen(false)}
        className={`hover:text-yellow-300 transition-colors text-white font-semibold tracking-wide uppercase ${mobile ? 'py-2 text-base' : 'text-sm'} ${pathname === '/regras' ? 'text-yellow-300' : ''}`}
      >
        Regras
      </a>
      <a
        href="/admin"
        onClick={() => setOpen(false)}
        className={`hover:text-yellow-300 transition-colors text-white opacity-50 hover:opacity-100 uppercase ${mobile ? 'py-2 text-sm' : 'text-xs'}`}
      >
        Admin
      </a>
    </>
  )

  return (
    <header className="bg-[#00bf63] shadow-lg relative z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
        <a href="/" className="flex items-center gap-2.5 no-underline group">
          <span className="flex items-center justify-center w-10 h-10 rounded-full bg-white/15 ring-2 ring-white/30 shadow-inner transition-transform group-hover:scale-105">
            <svg className="w-[22px] h-[22px] text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" />
              <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
            </svg>
          </span>
          <h1 className="font-bold text-lg leading-tight text-white">Bolão Copa do Mundo 2026</h1>
        </a>

        {!isAuthPage && (
          <>
            {/* Desktop nav */}
            <nav className="ml-auto hidden sm:flex items-center gap-5 text-sm">
              {navLinks(false)}
              <FontSizeToggle />
            </nav>

            {/* Mobile: font toggle + hamburger */}
            <div className="ml-auto sm:hidden flex items-center gap-2">
              <FontSizeToggle />
              <button
                className="text-white p-1 rounded focus:outline-none"
                onClick={() => setOpen(o => !o)}
                aria-label="Menu"
              >
                {open ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Mobile dropdown */}
      {!isAuthPage && open && (
        <nav className="sm:hidden bg-[#00bf63] border-t border-white/20 px-4 py-2 flex flex-col">
          {navLinks(true)}
        </nav>
      )}
    </header>
  )
}
