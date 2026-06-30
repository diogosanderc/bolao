import type { Metadata } from 'next'
import './globals.css'
import { BottomNav } from '@/components/BottomNav'
import { PullToRefresh } from '@/components/PullToRefresh'
import { Google_Sans } from 'next/font/google'

const font = Google_Sans({ subsets: ['latin'], weight: ['400', '500', '700'] })
const googleSansVar = Google_Sans({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-google-sans' })

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
    <html lang="pt-BR" className="dark">
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="theme-color" content="#00bf63" />
      </head>
      <body className={`min-h-screen antialiased ${font.className} ${googleSansVar.variable}`}>
        <script dangerouslySetInnerHTML={{ __html: `if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js')}` }} />
        <PullToRefresh />
        <main className="max-w-7xl mx-auto px-4 pt-4 pb-28">{children}</main>
        <footer className="text-center text-xs text-gray-700 py-4 pb-28">
          Criado por Diogo Sander — 2026
        </footer>
        <BottomNav />
      </body>
    </html>
  )
}
