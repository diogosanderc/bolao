'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PalpiteEntryPage() {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    if (name.trim().toUpperCase() === 'TODOS') {
      router.push('/palpite/todos')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/participants/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      const data = await res.json()
      if (data.token) {
        router.push(`/palpite/${data.token}`)
      } else {
        setError(data.error ?? 'Erro ao buscar participante')
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[65vh] gap-8">
      <div className="text-center">
        <div className="text-5xl mb-3">⚽</div>
        <h1 className="text-3xl font-bold text-gray-200">Enviar Palpites</h1>
        <p className="text-gray-400 mt-2 text-sm">Digite seu nome para acessar ou criar seus palpites</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div>
          <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">
            Nome do participante
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex: MACALISTER"
            autoFocus
            autoComplete="off"
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3.5 text-gray-200 text-lg font-semibold uppercase tracking-wide focus:outline-none focus:border-green-500 transition-colors placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-gray-500"
          />
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-950/30 border border-red-900 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="w-full bg-green-700 hover:bg-green-600 disabled:bg-gray-800 disabled:text-gray-600 text-white font-bold py-3.5 rounded-xl transition-colors text-lg tracking-wide"
        >
          {loading ? 'Aguarde...' : 'Acessar Palpites →'}
        </button>
      </form>

      <p className="text-xs text-gray-700 text-center max-w-xs">
        Se você ainda não tem palpites, um novo perfil será criado automaticamente com seu nome.
      </p>
    </div>
  )
}
