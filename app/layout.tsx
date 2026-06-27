import type { Metadata } from 'next'
import './globals.css'
import { Header } from '@/components/Header'
import { Plus_Jakarta_Sans, Oswald } from 'next/font/google'

const font = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'] })
// Condensed "scoreboard" face for big numbers (placares, pontos)
const oswald = Oswald({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-oswald' })

export const metadata: Metadata = {
  title: 'Bolão Copa do Mundo 2026',
  description: 'Bolão da Copa do Mundo 2026',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Bolão 2026',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="theme-color" content="#00bf63" />
      </head>
      <body className={`min-h-screen antialiased ${font.className} ${oswald.variable}`}>
        <script dangerouslySetInnerHTML={{ __html: `(function(){var t=localStorage.getItem('theme')||'dark';if(t==='dark')document.documentElement.classList.add('dark')})()` }} />
        <script dangerouslySetInnerHTML={{ __html: `if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js')}` }} />
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
        <footer className="text-center text-xs text-gray-700 py-6 mt-4">
          Criado por Diogo Sander — 2026
        </footer>
      </body>
    </html>
  )
}
