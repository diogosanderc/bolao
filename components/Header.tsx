'use client'
import { usePathname } from 'next/navigation'

export function Header() {
  const pathname = usePathname()
  const isAuthPage = ['/login', '/cadastro', '/esqueci-senha', '/resetar-senha'].includes(pathname)

  return (
    <header className="bg-green-800 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
        <a href="/" className="flex items-center gap-2 no-underline">
          <span className="text-3xl">🏆</span>
          <h1 className="font-bold text-lg leading-tight text-white">Bolão Copa do Mundo 2026</h1>
        </a>

        {!isAuthPage && (
          <nav className="ml-auto flex items-center gap-4 text-sm font-medium">
            <a href="/" className="hover:text-yellow-300 transition-colors text-white">Classificação</a>
            <a href="/simulador" className="hover:text-yellow-300 transition-colors text-white">Simulador</a>
            <span className="text-gray-400 cursor-not-allowed line-through text-xs">Palpites encerrados</span>
            <a href="/admin" className="hover:text-yellow-300 transition-colors text-white opacity-50 hover:opacity-100 text-xs">Admin</a>
          </nav>
        )}
      </div>
    </header>
  )
}
