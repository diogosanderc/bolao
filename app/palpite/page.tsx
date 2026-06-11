'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

// Redireciona o usuário logado para sua página de palpites via token
export default function PalpiteRedirect() {
  const router = useRouter()
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        if (data.token) router.replace(`/palpite/${data.token}`)
        else { setError('Sessão inválida'); router.replace('/login') }
      })
      .catch(() => router.replace('/login'))
  }, [router])

  if (error) return <div className="text-center py-20 text-red-400">{error}</div>
  return <div className="text-center py-20 text-gray-400 animate-pulse">Carregando seus palpites...</div>
}
