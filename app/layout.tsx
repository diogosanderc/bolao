import type { Metadata } from 'next'
import './globals.css'
import { Header } from '@/components/Header'
import { Rajdhani } from 'next/font/google'

const rajdhani = Rajdhani({ subsets: ['latin'], weight: ['400', '500', '600', '700'] })

export const metadata: Metadata = {
  title: 'Bolão Copa do Mundo 2026',
  description: 'Bolão da Copa do Mundo 2026',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`min-h-screen antialiased ${rajdhani.className}`}>
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  )
}
