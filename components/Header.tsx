'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<{ name: string } | null>(null)
  const [checked, setChecked] = useState(false)

  const isAuthPage = ['/login', '/cadastro', '/esqueci-senha', '/resetar-senha'].includes(pathname)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => { if (d.name) setUser(d) })
      .catch(() => {})
      .finally(() => setChecked(true))
  }, [pathname])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    router.push('/login')
  }

  return (
    <header className="bg-gradient-to-r from-green-800 via-green-700 to-yellow-600 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
        <a href="/" className="flex items-center gap-2 no-underline">
          <span className="text-3xl">🏆</span>
          <div>
            <h1 className="font-bold text-lg leading-tight text-white">Bolão Copa do Mundo 2026</h1>
            <p className="text-xs text-green-100 opacity-80">EUA · México · Canadá</p>
          </div>
        </a>

        {!isAuthPage && checked && (
          <nav className="ml-auto flex items-center gap-4 text-sm font-medium">
            <a href="/" className="hover:text-yellow-300 transition-colors text-white">Classificação</a>
            {user ? (
              <>
                <a href="/palpite" className="hover:text-yellow-300 transition-colors text-white">
                  Meus palpites
                </a>
                <span className="text-green-200 text-xs hidden sm:block">Olá, {user.name.split(' ')[0]}</span>
                <button onClick={logout}
                  className="bg-black/20 hover:bg-black/40 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
                  Sair
                </button>
              </>
            ) : (
              <>
                <a href="/login" className="hover:text-yellow-300 transition-colors text-white">Entrar</a>
                <a href="/cadastro" className="bg-black/20 hover:bg-black/40 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
                  Cadastrar
                </a>
              </>
            )}
            <a href="/admin" className="hover:text-yellow-300 transition-colors text-white opacity-50 hover:opacity-100 text-xs">Admin</a>
          </nav>
        )}
      </div>
    </header>
  )
}
