'use client'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

export function Header() {
  const pathname = usePathname()
  const isAuthPage = ['/login', '/cadastro', '/esqueci-senha', '/resetar-senha'].includes(pathname)
  const [open, setOpen] = useState(false)
  const [isDark, setIsDark] = useState(true)

  // Close menu on route change
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
        href="/admin"
        onClick={() => setOpen(false)}
        className={`hover:text-yellow-300 transition-colors text-white opacity-50 hover:opacity-100 uppercase ${mobile ? 'py-2 text-sm' : 'text-xs'}`}
      >
        Admin
      </a>
    </>
  )

  return (
    <header className="bg-green-800 shadow-lg relative z-50">
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
              <button onClick={toggleTheme} className="text-white hover:text-yellow-300 transition-colors text-xs font-medium" aria-label="Alternar tema">
                {isDark ? 'Tema claro' : 'Tema escuro'}
              </button>
            </nav>

            {/* Hamburger button (mobile only) */}
            <button
              className="ml-auto sm:hidden text-white p-1 rounded focus:outline-none"
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
          </>
        )}
      </div>

      {/* Mobile dropdown */}
      {!isAuthPage && open && (
        <nav className="sm:hidden bg-green-900 border-t border-green-700 px-4 py-2 flex flex-col">
          {navLinks(true)}
          <button onClick={toggleTheme} className="py-2 text-white hover:text-yellow-300 transition-colors text-sm font-medium text-left" aria-label="Alternar tema">
            {isDark ? 'Tema claro' : 'Tema escuro'}
          </button>
        </nav>
      )}
    </header>
  )
}
