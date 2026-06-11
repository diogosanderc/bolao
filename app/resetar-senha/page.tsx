'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function ResetForm() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('As senhas não coincidem'); return }
    if (password.length < 6) { setError('Mínimo 6 caracteres'); return }
    setLoading(true)
    try {
      const r = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await r.json()
      if (!r.ok) { setError(data.error); return }
      setDone(true)
      setTimeout(() => router.push('/login'), 2500)
    } catch {
      setError('Erro de conexão')
    } finally {
      setLoading(false)
    }
  }

  if (!token) return (
    <div className="text-center py-20 text-red-400">Link inválido.</div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🔒</div>
          <h1 className="text-2xl font-bold text-white">Nova senha</h1>
        </div>

        {done ? (
          <div className="bg-green-950/40 border border-green-800 rounded-2xl p-6 text-center">
            <div className="text-3xl mb-2">✅</div>
            <p className="text-green-300 font-semibold">Senha redefinida!</p>
            <p className="text-gray-400 text-sm mt-1">Redirecionando para o login...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Nova senha</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500"
                placeholder="Mínimo 6 caracteres" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Confirmar nova senha</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500"
                placeholder="Repita a senha" />
            </div>
            {error && <p className="text-red-400 text-sm bg-red-950/30 border border-red-900 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-green-700 hover:bg-green-600 disabled:bg-gray-700 text-white font-bold rounded-xl py-3 transition-colors">
              {loading ? 'Salvando...' : 'Salvar nova senha'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default function ResetarSenhaPage() {
  return <Suspense><ResetForm /></Suspense>
}
