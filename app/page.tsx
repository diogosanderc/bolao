'use client'

import { useEffect, useState } from 'react'
import { LeaderboardEntry } from '@/lib/types'

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [sharing, setSharing] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(r => r.json())
      .then(d => { setData(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function shareTable() {
    if (data.length === 0) return
    setSharing(true)
    try {
      const dpr = 2
      const W = 520
      const ROW = 34
      const PAD = 18
      const HEADER_H = 72
      const height = HEADER_H + (data.length + 1) * ROW + 28

      const canvas = document.createElement('canvas')
      canvas.width = W * dpr
      canvas.height = height * dpr
      const ctx = canvas.getContext('2d')!
      ctx.scale(dpr, dpr)

      // background
      ctx.fillStyle = '#030712'
      ctx.fillRect(0, 0, W, height)

      // title
      ctx.fillStyle = '#ca8a04'
      ctx.font = 'bold 20px Arial, sans-serif'
      ctx.fillText('Bolao Copa do Mundo 2026', PAD, PAD + 20)
      ctx.fillStyle = '#6b7280'
      ctx.font = '12px Arial, sans-serif'
      ctx.fillText('Classificacao', PAD, PAD + 40)
      const d = new Date()
      const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      ctx.textAlign = 'right'
      ctx.fillText(dateStr, W - PAD, PAD + 40)
      ctx.textAlign = 'left'

      // column header
      const hy = HEADER_H
      ctx.fillStyle = '#111827'
      ctx.fillRect(0, hy, W, ROW)
      ctx.fillStyle = '#9ca3af'
      ctx.font = 'bold 11px Arial, sans-serif'
      ctx.fillText('#', PAD, hy + ROW / 2 + 4)
      ctx.fillText('Participante', PAD + 46, hy + ROW / 2 + 4)
      ctx.textAlign = 'right'
      ctx.fillText('Pts', W - PAD, hy + ROW / 2 + 4)
      ctx.textAlign = 'left'

      // separator
      ctx.fillStyle = '#1f2937'
      ctx.fillRect(0, hy + ROW, W, 1)

      // rows
      data.forEach((entry, idx) => {
        const rank = ranks[idx]
        const tier = tierOf(entry.totalPoints)
        const relegated = isRelated(entry.totalPoints)
        const ry = HEADER_H + (idx + 1) * ROW + 1

        // row bg
        if (relegated) ctx.fillStyle = '#450a0a'
        else if (tier === 1) ctx.fillStyle = '#1c1202'
        else if (tier === 2) ctx.fillStyle = '#0d1117'
        else if (tier === 3) ctx.fillStyle = '#1a0f00'
        else ctx.fillStyle = idx % 2 === 0 ? '#030712' : '#080d14'
        ctx.fillRect(0, ry, W, ROW)

        // rank cell
        const medal = relegated ? '$$' : tier === 1 ? '1o' : tier === 2 ? '2o' : tier === 3 ? '3o' : ''
        if (medal) {
          ctx.fillStyle = relegated ? '#fca5a5' : tier === 1 ? '#fde047' : tier === 2 ? '#d1d5db' : '#d97706'
          ctx.font = 'bold 13px Arial, sans-serif'
          ctx.fillText(medal, PAD, ry + ROW / 2 + 4)
        } else if (isFirstOfRank[idx]) {
          ctx.fillStyle = '#6b7280'
          ctx.font = '12px Arial, sans-serif'
          ctx.fillText(String(rank), PAD, ry + ROW / 2 + 4)
        }

        // name
        ctx.fillStyle = relegated ? '#fca5a5' : tier === 1 ? '#fde047' : tier === 2 ? '#d1d5db' : tier === 3 ? '#d97706' : '#e5e7eb'
        ctx.font = tier <= 3 || relegated ? 'bold 13px Arial, sans-serif' : '13px Arial, sans-serif'
        ctx.fillText(entry.participant.name, PAD + 46, ry + ROW / 2 + 4)

        // points
        ctx.fillStyle = relegated ? '#f87171' : '#ca8a04'
        ctx.font = 'bold 13px Arial, sans-serif'
        ctx.textAlign = 'right'
        ctx.fillText(String(entry.totalPoints), W - PAD, ry + ROW / 2 + 4)
        ctx.textAlign = 'left'

        // divider
        ctx.fillStyle = '#1f2937'
        ctx.fillRect(0, ry + ROW, W, 1)
      })

      const url = canvas.toDataURL('image/png')
      setPreviewUrl(url)
    } catch (err) {
      console.error('shareTable error:', err)
      alert('Erro ao gerar imagem. Tente novamente.')
    } finally {
      setSharing(false)
    }
  }

  async function nativeShare() {
    if (!previewUrl) return
    try {
      const res = await fetch(previewUrl)
      const blob = await res.blob()
      const file = new File([blob], 'classificacao-bolao.png', { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Bolão Copa 2026 — Classificação' })
      }
    } catch {
      // ignore — user cancelled or not supported
    }
  }

  function downloadImage() {
    if (!previewUrl) return
    const a = document.createElement('a')
    a.href = previewUrl
    a.download = 'classificacao-bolao.png'
    a.click()
  }

  function closePreview() {
    setPreviewUrl(null)
  }

  const trophies: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

  // unique sorted point totals → position tier (1st, 2nd, 3rd group of scores)
  const uniquePoints = [...new Set(data.map(e => e.totalPoints))].sort((a, b) => b - a)
  const tierOf = (pts: number) => uniquePoints.indexOf(pts) + 1

  // rank = quantos participantes têm mais pontos + 1 (empates compartilham o mesmo rank)
  const ranks = data.map((entry) =>
    data.filter(e => e.totalPoints > entry.totalPoints).length + 1
  )

  // últimos 7 (ou mais, em caso de empate) pagam — "rebaixados"
  const cutoffScore = data.length >= 7 ? data[data.length - 7].totalPoints : -Infinity
  const isRelated = (pts: number) => data.length >= 7 && pts <= cutoffScore

  // só mostra o número do rank na primeira ocorrência de cada grupo empatado
  const isFirstOfRank = data.map((_, idx) => idx === 0 || ranks[idx] !== ranks[idx - 1])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">Classificação</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={shareTable}
            disabled={sharing || loading || data.length === 0}
            className="text-sm text-gray-400 hover:text-green-400 disabled:opacity-40 transition-colors flex items-center gap-1"
          >
            {sharing ? '⏳' : '📤'} {sharing ? 'Gerando...' : 'Compartilhar'}
          </button>
          <button
            onClick={() => location.reload()}
            className="text-sm text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            ↻ Atualizar
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-center py-20 text-gray-400">Carregando...</div>
      )}

      {!loading && data.length === 0 && (
        <div className="text-center py-20 text-gray-500">
          <p className="text-4xl mb-3">📋</p>
          <p>Nenhum participante cadastrado ainda.</p>
          <p className="text-sm mt-1">
            <a href="/admin" className="text-yellow-400 hover:underline">Acesse o painel admin</a> para adicionar participantes.
          </p>
        </div>
      )}

      {!loading && data.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left w-10">#</th>
                <th className="px-4 py-3 text-left">Participante</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right hidden sm:table-cell">Jogos</th>
                <th className="px-4 py-3 text-right hidden sm:table-cell">Fases</th>
                <th className="px-4 py-3 text-right hidden md:table-cell">Resultados</th>
                <th className="px-4 py-3 text-right hidden md:table-cell">Placares exatos</th>
                <th className="px-4 py-3 text-center hidden lg:table-cell">Palpites</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {data.map((entry, idx) => {
                const rank = ranks[idx]
                const tier = tierOf(entry.totalPoints)
                return (
                <tr
                  key={entry.participant.id}
                  className={`transition-colors ${
                    isRelated(entry.totalPoints) ? 'bg-red-50 hover:bg-red-100 dark:bg-red-950/50 dark:hover:bg-red-950/70' :
                    tier === 1 ? 'bg-yellow-100 dark:bg-yellow-950/40' :
                    tier === 2 ? 'bg-gray-800/30' :
                    tier === 3 ? 'bg-orange-50 dark:bg-orange-950/30' :
                    'hover:bg-gray-900/50'
                  }`}
                >
                  <td className="px-4 py-3 text-center font-bold text-lg">
                    {isRelated(entry.totalPoints)
                      ? '💸'
                      : trophies[tier]
                      ?? (isFirstOfRank[idx] ? <span className="text-gray-500 text-sm">{rank}</span> : null)}
                  </td>
                  <td className={`px-4 py-3 font-semibold ${
                    isRelated(entry.totalPoints) ? 'text-red-700 dark:text-red-300' :
                    tier === 1 ? 'text-yellow-700 dark:text-yellow-300' :
                    tier === 2 ? 'text-gray-300' :
                    tier === 3 ? 'text-amber-600' :
                    ''
                  }`}>
                    {entry.participant.name}
                  </td>
                  <td className={`px-4 py-3 text-right font-bold text-base ${isRelated(entry.totalPoints) ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                    {entry.totalPoints}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300 hidden sm:table-cell">
                    {entry.matchPoints}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300 hidden sm:table-cell">
                    {entry.phasePoints}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400 hidden md:table-cell">
                    {entry.breakdown.correctResults}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400 hidden md:table-cell">
                    {entry.breakdown.correctScores}
                  </td>
                  <td className="px-4 py-3 text-center hidden lg:table-cell">
                    <a
                      href={`/palpite/${entry.participant.token}`}
                      className="text-xs text-blue-400 hover:text-blue-300 hover:underline"
                    >
                      Ver palpites
                    </a>
                  </td>
                </tr>
              )}
            )}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8">
        {[
          { label: 'Resultado certo', pts: '4 pts', icon: '✅' },
          { label: 'Placar exato', pts: '+2 pts', icon: '🎯' },
          { label: 'Gols de um time', pts: '1 pt/time', icon: '⚽' },
          { label: 'Placar c/ 3+ gols', pts: '+2 pts', icon: '🔥' },
        ].map(item => (
          <div key={item.label} className="bg-gray-900 rounded-lg p-3 text-center border border-gray-800">
            <div className="text-2xl mb-1">{item.icon}</div>
            <div className="text-xs text-gray-400">{item.label}</div>
            <div className="text-green-400 font-bold text-sm">{item.pts}</div>
          </div>
        ))}
      </div>

      <div className="text-center text-xs text-gray-600 mt-4">
        Classificação atualizada em tempo real conforme resultados são lançados
      </div>

      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={closePreview}>
          <div className="relative max-w-lg w-full bg-gray-900 rounded-xl shadow-2xl p-4" onClick={e => e.stopPropagation()}>
            <button
              onClick={closePreview}
              className="absolute top-3 right-3 text-gray-400 hover:text-white text-xl leading-none"
              aria-label="Fechar"
            >✕</button>
            <p className="text-center text-sm text-gray-400 mb-3">Classificação gerada — escolha como compartilhar</p>
            <img src={previewUrl} alt="Classificação" className="w-full rounded-lg mb-4" />
            <div className="flex gap-2">
              <button
                onClick={downloadImage}
                className="flex-1 py-2 rounded-lg bg-blue-700 hover:bg-blue-600 text-white font-bold transition-colors text-sm"
              >
                ⬇️ Baixar imagem
              </button>
              {typeof navigator !== 'undefined' && !!navigator.share && (
                <button
                  onClick={nativeShare}
                  className="flex-1 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold transition-colors text-sm"
                >
                  📤 Compartilhar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
