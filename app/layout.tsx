import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Bolão Copa do Mundo 2026',
  description: 'Bolão da Copa do Mundo 2026',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-gray-950 text-white antialiased">
        <header className="bg-gradient-to-r from-green-800 via-green-700 to-yellow-600 shadow-lg">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
            <span className="text-3xl">🏆</span>
            <div>
              <h1 className="font-bold text-lg leading-tight">Bolão Copa do Mundo 2026</h1>
              <p className="text-xs text-green-100 opacity-80">EUA · México · Canadá</p>
            </div>
            <nav className="ml-auto flex gap-4 text-sm font-medium">
              <a href="/" className="hover:text-yellow-300 transition-colors">Classificação</a>
              <a href="/admin" className="hover:text-yellow-300 transition-colors">Admin</a>
            </nav>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  )
}
