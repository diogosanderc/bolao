'use client'
import { useState } from 'react'
import { Icon } from '@/components/Icon'

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      setSent(true) // Sempre mostra sucesso (não vaza se email existe)
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
          <div className="flex justify-center mb-3"><Icon name="key" size={48} className="text-[#00bf63]" strokeWidth={1.4} /></div>
          <h1 className="text-2xl font-bold text-white">Esqueci a senha</h1>
          <p className="text-gray-400 text-sm mt-1">Vamos enviar um link de redefinição por e-mail</p>
        </div>

        {sent ? (
          <div className="bg-green-950/40 border border-green-800 rounded-2xl p-6 text-center space-y-3">
            <div className="flex justify-center"><Icon name="mail" size={32} className="text-green-400" strokeWidth={1.4} /></div>
            <p className="text-green-300 font-semibold">E-mail enviado!</p>
            <p className="text-gray-400 text-sm">
              Se o endereço <strong>{email}</strong> estiver cadastrado, você receberá um link em breve.
            </p>
            <a href="/login" className="block mt-4 text-green-400 hover:text-green-300 text-sm">← Voltar para o login</a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Seu e-mail cadastrado</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500 transition-colors"
                placeholder="seu@email.com" />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button type="submit" disabled={loading}
              className="w-full bg-green-700 hover:bg-green-600 disabled:bg-gray-700 text-white font-bold rounded-xl py-3 transition-colors">
              {loading ? 'Enviando...' : 'Enviar link'}
            </button>

            <p className="text-center text-sm">
              <a href="/login" className="text-gray-500 hover:text-gray-300">← Voltar para o login</a>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
