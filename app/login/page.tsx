'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { Icon } from '@/components/Icon'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const redirect = params.get('redirect') || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await r.json()
      if (!r.ok) { setError(data.error); return }
      router.push(redirect)
    } catch {
      setError('Erro de conexão')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3"><Icon name="trophy" size={48} className="text-[#00bf63]" strokeWidth={1.4} /></div>
          <h1 className="text-2xl font-bold text-white">Bolão Copa 2026</h1>
          <p className="text-gray-400 text-sm mt-1">Entrar na minha conta</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">E-mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500 transition-colors"
              placeholder="seu@email.com" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Senha</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500 transition-colors"
              placeholder="••••••" />
          </div>

          {error && <p className="text-red-400 text-sm bg-red-950/30 border border-red-900 rounded-lg px-3 py-2">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full bg-green-700 hover:bg-green-600 disabled:bg-gray-700 text-white font-bold rounded-xl py-3 transition-colors">
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          <div className="flex items-center justify-between text-sm pt-1">
            <a href="/cadastro" className="text-green-400 hover:text-green-300">Criar conta</a>
            <a href="/esqueci-senha" className="text-gray-500 hover:text-gray-300">Esqueci a senha</a>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>
}
