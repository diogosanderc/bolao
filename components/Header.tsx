'use client'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

function SunIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
    </svg>
  )
}

export function Header() {
  const pathname = usePathname()
  const isAuthPage = ['/login', '/cadastro', '/esqueci-senha', '/resetar-senha'].includes(pathname)
  const [open, setOpen] = useState(false)
  const [isDark, setIsDark] = useState(true)

  useEffect(() => { setOpen(false) }, [pathname])

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
  }, [])

  const toggleTheme = () => {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

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
        href="/palpite"
        onClick={() => setOpen(false)}
        className={`hover:text-yellow-300 transition-colors text-white font-semibold tracking-wide uppercase ${mobile ? 'py-2 text-base' : 'text-sm'} ${pathname.startsWith('/palpite') ? 'text-yellow-300' : ''}`}
      >
        Palpites
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

  const ThemeToggle = ({ className = '' }: { className?: string }) => (
    <button
      onClick={toggleTheme}
      className={`flex items-center justify-center w-8 h-8 rounded-full text-white hover:text-yellow-300 hover:bg-white/10 transition-colors ${className}`}
      aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
      title={isDark ? 'Tema claro' : 'Tema escuro'}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  )

  return (
    <header className="bg-[#00bf63] shadow-lg relative z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
        <a href="/" className="flex items-center gap-2 no-underline">
          <span className="text-3xl">🏆</span>
          <h1 className="font-bold text-lg leading-tight text-white">Bolão Copa do Mundo 2026</h1>
        </a>

        {!isAuthPage && (
          <>
            {/* Desktop nav */}
            <nav className="ml-auto hidden sm:flex items-center gap-5 text-sm">
              {navLinks(false)}
              <ThemeToggle />
            </nav>

            {/* Mobile: theme toggle + hamburger always visible */}
            <div className="ml-auto sm:hidden flex items-center gap-1">
              <ThemeToggle />
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
        <nav className="sm:hidden bg-[#009f50] border-t border-[#00bf63]/60 px-4 py-2 flex flex-col">
          {navLinks(true)}
        </nav>
      )}
    </header>
  )
}
