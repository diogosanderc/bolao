'use client'

import { useEffect, useRef, useState } from 'react'
import { LeaderboardEntry } from '@/lib/types'
import { Flag } from '@/components/Flag'
import { ParticipantModal } from '@/components/ParticipantModal'

type LastMatch = {
  matchId: string
  score1: number
  score2: number
  team1: { id: string; name: string; flag: string }
  team2: { id: string; name: string; flag: string }
} | null

type GoalEvent = {
  minute: string
  playerName: string
  teamId: string
  ownGoal: boolean
}

type ScheduleMatch = {
  matchId: string
  team1: { id: string; name: string; flag: string }
  team2: { id: string; name: string; flag: string }
  dateBRT: string
  venue: string
  inProgress: boolean
  suspended?: boolean
  liveScore1?: number
  liveScore2?: number
  clock?: string
  goals?: GoalEvent[]
}

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardEntry[]>([])
  const [lastMatch, setLastMatch] = useState<LastMatch>(null)
  const [nextMatch, setNextMatch] = useState<ScheduleMatch | null>(null)
  const [liveMatches, setLiveMatches] = useState<ScheduleMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [projectionMode, setProjectionMode] = useState(false)
  const [remainingMatches, setRemainingMatches] = useState(0)
  const [leaderboardHasLive, setLeaderboardHasLive] = useState(false)
  const [activeUsers, setActiveUsers] = useState<number | null>(null)
  const [selectedParticipant, setSelectedParticipant] = useState<{ id: string; name: string } | null>(null)
  const [matchModal, setMatchModal] = useState<{ matchId: string; label: string } | null>(null)
  const [matchPredictions, setMatchPredictions] = useState<{ name: string; score1: number; score2: number }[]>([])
  const [matchPredLoading, setMatchPredLoading] = useState(false)

  function openMatchPredictions(matchId: string, label: string) {
    setMatchModal({ matchId, label })
    setMatchPredictions([])
    setMatchPredLoading(true)
    fetch(`/api/match/${matchId}/predictions`)
      .then(r => r.json())
      .then(d => { setMatchPredictions(d.predictions ?? []); setMatchPredLoading(false) })
      .catch(() => setMatchPredLoading(false))
  }

  function shareMatchPredictions(t1: string, t2: string, dateBRT: string) {
    if (!matchModal) return
    const grouped = matchPredictions.reduce<Record<string, string[]>>((acc, p) => {
      const key = `${p.score1}×${p.score2}`
      acc[key] = [...(acc[key] ?? []), p.name]
      return acc
    }, {})
    const lines = [`🏆 *Palpites — ${t1} vs ${t2}*`]
    if (dateBRT) lines.push(`📅 ${dateBRT}`)
    lines.push('')
    Object.entries(grouped)
      .sort((a, b) => b[1].length - a[1].length)
      .forEach(([score, names]) => lines.push(`*${score}* — ${names.join(', ')}`))
    lines.push('', '_Bolão Copa 2026_')
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank')
  }
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  function fetchLeaderboard() {
    fetch('/api/leaderboard')
      .then(r => r.json())
      .then(d => {
        setData(Array.isArray(d.leaderboard) ? d.leaderboard : [])
        setLastMatch(d.lastMatch ?? null)
        setRemainingMatches(d.remainingMatches ?? 0)
        setLeaderboardHasLive(d.hasLive ?? false)
        setLastRefresh(new Date())
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchLeaderboard()

    // Count this session as a visit once (dedup via sessionStorage)
    if (!sessionStorage.getItem('bolao_visited')) {
      sessionStorage.setItem('bolao_visited', '1')
      fetch('/api/visit', { method: 'POST' }).catch(() => {})
    }

    // Presence heartbeat — anonymous ID persisted in localStorage
    let presenceId = localStorage.getItem('bolao_pid')
    if (!presenceId) {
      presenceId = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
      localStorage.setItem('bolao_pid', presenceId)
    }
    function pingPresence() {
      fetch('/api/presence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: presenceId }) })
        .then(r => r.json())
        .then(d => { if (typeof d.active === 'number') setActiveUsers(d.active) })
        .catch(() => {})
    }
    pingPresence()
    const presenceInterval = setInterval(pingPresence, 30_000)

    function fetchSchedule() {
      fetch('/api/schedule')
        .then(r => r.json())
        .then(d => {
          setNextMatch(d.nextMatch ?? null)
          setLiveMatches(Array.isArray(d.live) ? d.live : [])
        })
        .catch(() => {})
    }
    fetchSchedule()
    const interval = setInterval(fetchSchedule, 10_000)
    return () => {
      clearInterval(presenceInterval)
      clearInterval(interval)
    }
  }, [])

  // When there are live matches, refresh leaderboard every 15s and trigger ESPN sync every 30s
  useEffect(() => {
    if (liveMatches.length === 0) return
    const leaderboardInterval = setInterval(fetchLeaderboard, 10_000)
    const syncInterval = setInterval(() => {
      fetch('/api/sync/live', { method: 'POST' }).catch(() => {})
    }, 30_000) // background poller handles real-time; this is a fallback only
    // Trigger sync immediately when a live match is first detected
    fetch('/api/sync/live', { method: 'POST' }).catch(() => {})
    return () => {
      clearInterval(leaderboardInterval)
      clearInterval(syncInterval)
    }
  }, [liveMatches.length])

  const trophies: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

  const uniquePoints = [...new Set(data.map(e => e.totalPoints))].sort((a, b) => b - a)
  const tierOf = (pts: number) => uniquePoints.indexOf(pts) + 1

  const ranks = data.map((entry) =>
    data.filter(e => e.totalPoints > entry.totalPoints).length + 1
  )

  const cutoffScore = data.length >= 7 ? data[data.length - 7].totalPoints : -Infinity
  const isRelated = (pts: number) => data.length >= 7 && pts <= cutoffScore
  const isWarning = (pts: number) => !isRelated(pts) && data.length >= 7 && pts <= cutoffScore + 2

  const isFirstOfRank = data.map((_, idx) => idx === 0 || ranks[idx] !== ranks[idx - 1])

  // Lock body scroll when any modal is open (iOS-safe)
  useEffect(() => {
    const isOpen = matchModal !== null || selectedParticipant !== null
    if (!isOpen) return
    const scrollY = window.scrollY
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      document.body.style.overflow = ''
      window.scrollTo(0, scrollY)
    }
  }, [matchModal, selectedParticipant])

  const prevRanksRef = useRef<Map<string, number>>(new Map())
  const [flashMap, setFlashMap] = useState<Record<string, 'up' | 'down'>>({})

  // Detect rank changes to trigger flash animation
  useEffect(() => {
    if (data.length === 0) return
    const newRanks = new Map<string, number>()
    data.forEach(entry => {
      newRanks.set(entry.participant.id, data.filter(e => e.totalPoints > entry.totalPoints).length + 1)
    })
    const changes: Record<string, 'up' | 'down'> = {}
    if (prevRanksRef.current.size > 0) {
      for (const [id, newRank] of newRanks) {
        const prev = prevRanksRef.current.get(id)
        if (prev !== undefined && prev !== newRank) {
          changes[id] = prev > newRank ? 'up' : 'down'
        }
      }
    }
    prevRanksRef.current = newRanks
    if (Object.keys(changes).length > 0) {
      setFlashMap(changes)
      const t = setTimeout(() => setFlashMap({}), 2200)
      return () => clearTimeout(t)
    }
  }, [data])

  const [notifState, setNotifState] = useState<'default' | 'subscribed' | 'denied' | 'unsupported'>('default')
  const [notifToast, setNotifToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setNotifToast(msg)
    setTimeout(() => setNotifToast(null), 3000)
  }

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setNotifState('unsupported')
    } else if (Notification.permission === 'denied') {
      setNotifState('denied')
    } else {
      // Check if already subscribed
      navigator.serviceWorker.ready.then(reg => reg.pushManager.getSubscription()).then(sub => {
        if (!sub) return
        setNotifState('subscribed')
        // Re-register with server in case it lost the subscription (e.g. redeploy)
        const json = sub.toJSON()
        const p256dh = json.keys?.p256dh
        const auth = json.keys?.auth
        if (p256dh && auth) {
          fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint, keys: { p256dh, auth } }),
          }).catch(() => {})
        }
      }).catch(() => {})
    }
  }, [])

  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
  }

  async function toggleNotifications() {
    if (!('serviceWorker' in navigator)) return
    const reg = await navigator.serviceWorker.ready
    if (notifState === 'subscribed') {
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/subscribe', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) })
        await sub.unsubscribe()
      }
      setNotifState('default')
      showToast('🔕 Notificações desativadas')
      return
    }
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') { setNotifState('denied'); showToast('🚫 Permissão negada pelo browser'); return }
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_KEY
    if (!vapidKey) { showToast('⚠️ Configuração incompleta (VAPID)'); return }
    try {
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) })
      const json = sub.toJSON()
      const p256dh = json.keys?.p256dh
      const auth = json.keys?.auth
      if (!p256dh || !auth) { showToast('⚠️ Erro ao obter chaves de assinatura'); return }
      const r = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint, keys: { p256dh, auth } }),
      })
      if (!r.ok) { showToast('⚠️ Erro ao salvar assinatura no servidor'); return }
      setNotifState('subscribed')
      showToast('🔔 Notificações ativadas! Você receberá alertas de gols e resultados.')
    } catch (err: any) {
      showToast('⚠️ Erro: ' + (err?.message ?? 'falhou'))
    }
  }

  function shareWhatsApp() {
    const lines: string[] = ['🏆 *Classificação Bolão Copa 2026*']
    if (lastMatch) {
      lines.push(`⚽ Último jogo: ${lastMatch.team1.name} ${lastMatch.score1}×${lastMatch.score2} ${lastMatch.team2.name}`)
    }
    lines.push('')
    data.forEach((entry, idx) => {
      const rank = ranks[idx]
      const tier = tierOf(entry.totalPoints)
      const medal = isRelated(entry.totalPoints) ? '💸' : isWarning(entry.totalPoints) ? '⚠️' : (trophies[tier] ?? (rank >= 4 && rank <= 7 && isFirstOfRank[idx] ? '⭐' : (isFirstOfRank[idx] ? `${rank}.` : '   ')))
      const pts = `${entry.totalPoints}pts`
      const last = entry.lastMatchPoints > 0 ? ` (+${entry.lastMatchPoints})` : ''
      lines.push(`${medal} *${entry.participant.name}* — ${pts}${last}`)
    })
    lines.push('')
    lines.push(`_Classificação gerada em ${new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}_`)
    const text = encodeURIComponent(lines.join('\n'))
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-200 dark:text-yellow-400">
          Classificação
        </h2>
        <div className="flex items-center gap-3">
          {notifState !== 'unsupported' && (
            <div className="relative">
              <button
                onClick={toggleNotifications}
                title={notifState === 'subscribed' ? 'Notificações ativas — clique para desativar' : notifState === 'denied' ? 'Notificações bloqueadas no browser' : 'Ativar notificações de gol e resultado'}
                className={`text-xl px-2 py-1 rounded-lg transition-colors ${
                  notifState === 'subscribed' ? 'text-yellow-400' :
                  notifState === 'denied' ? 'text-gray-600 cursor-not-allowed' :
                  'text-gray-500 hover:text-gray-300'
                }`}
                disabled={notifState === 'denied'}
              >
                {notifState === 'denied' ? '🔕' : '🔔'}
              </button>
              {notifState === 'subscribed' && (
                <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-green-400 rounded-full border border-gray-950" />
              )}
            </div>
          )}
          {!loading && data.length > 0 && (
            <button
              onClick={shareWhatsApp}
              className="flex items-center gap-1.5 text-sm bg-[#00bf63] hover:bg-[#00a854] text-[white] px-3 py-1.5 rounded-lg transition-colors font-semibold"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Compartilhar
            </button>
          )}
          <button
            onClick={() => location.reload()}
            className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
            aria-label="Atualizar"
          >
            ↻
          </button>
        </div>
      </div>

      {liveMatches.length > 0 && (
        <div className="space-y-1.5">
          {liveMatches.map(m => (
            <div key={m.matchId} className={`border rounded-lg px-4 py-2.5 ${m.suspended ? 'bg-yellow-50 dark:bg-yellow-950/60 border-yellow-400 dark:border-yellow-700' : 'bg-red-50 dark:bg-red-950/60 border-red-400 dark:border-red-700 animate-pulse'}`}>
              <div className="flex items-center justify-between mb-1">
                {m.suspended
                  ? <span className="text-xs text-yellow-700 dark:text-yellow-400 uppercase tracking-wider font-bold">⛈️ Paralisado</span>
                  : <span className="text-xs text-red-700 dark:text-red-400 uppercase tracking-wider font-bold">🔴 Ao vivo</span>}
                {m.clock && <span className={`text-xs font-semibold ${m.suspended ? 'text-yellow-700 dark:text-yellow-300' : 'text-red-800 dark:text-red-300'}`}>{m.clock}</span>}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-200 dark:text-white">
                <span className="flex items-center gap-1.5"><Flag teamId={m.team1.id} size={18} />{m.team1.name}</span>
                <span className="font-bold text-gray-200 dark:text-white text-base px-1">
                  {m.liveScore1 !== undefined && m.liveScore2 !== undefined
                    ? `${m.liveScore1} × ${m.liveScore2}`
                    : <span className="text-red-500 dark:text-red-300">vs</span>}
                </span>
                <span className="flex items-center gap-1.5"><Flag teamId={m.team2.id} size={18} />{m.team2.name}</span>
              </div>
              {m.goals && m.goals.length > 0 && (() => {
                const t1Goals = m.goals.filter(g => g.teamId === m.team1.id)
                const t2Goals = m.goals.filter(g => g.teamId === m.team2.id)
                return (
                  <div className="mt-2 space-y-0.5">
                    {[{ team: m.team1, goals: t1Goals }, { team: m.team2, goals: t2Goals }].map(({ team, goals }) =>
                      goals.length > 0 ? (
                        <div key={team.id} className="flex items-center gap-1.5 flex-wrap">
                          <Flag teamId={team.id} size={14} />
                          {goals.map((g, i) => (
                            <span key={i} className="text-xs text-red-800 dark:text-red-200">
                              ⚽{g.minute && <span className="text-red-700 dark:text-red-400"> {g.minute}</span>} {g.playerName}
                            </span>
                          ))}
                        </div>
                      ) : null
                    )}
                  </div>
                )
              })()}
            </div>
          ))}
          {lastRefresh && (
            <p className="text-right text-xs text-gray-600 pr-1">
              atualizado {lastRefresh.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          )}
        </div>
      )}

      {nextMatch && liveMatches.length > 0 && !liveMatches.some(m => m.matchId === nextMatch.matchId) && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500 uppercase tracking-wider">Próximo jogo</span>
            <span className="text-xs text-yellow-500 font-semibold">{nextMatch.dateBRT}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <span className="flex items-center gap-1.5"><Flag teamId={nextMatch.team1.id} size={18} />{nextMatch.team1.name}</span>
            <span className="text-gray-600">vs</span>
            <span className="flex items-center gap-1.5"><Flag teamId={nextMatch.team2.id} size={18} />{nextMatch.team2.name}</span>
          </div>
        </div>
      )}

      {lastMatch && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Último jogo</div>
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <span className="flex items-center gap-1.5"><Flag teamId={lastMatch.team1.id} size={18} />{lastMatch.team1.name}</span>
            <span className="font-bold text-white">{lastMatch.score1} × {lastMatch.score2}</span>
            <span className="flex items-center gap-1.5"><Flag teamId={lastMatch.team2.id} size={18} />{lastMatch.team2.name}</span>
          </div>
        </div>
      )}

      {nextMatch && liveMatches.length === 0 && (
        <button
          onClick={() => openMatchPredictions(nextMatch.matchId, `${nextMatch.team1.name} vs ${nextMatch.team2.name}`)}
          className="w-full bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-lg px-4 py-2.5 text-left transition-colors"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500 uppercase tracking-wider">Próximo jogo</span>
            <span className="text-xs text-yellow-500 font-semibold">{nextMatch.dateBRT} →</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <span className="flex items-center gap-1.5"><Flag teamId={nextMatch.team1.id} size={18} />{nextMatch.team1.name}</span>
            <span className="text-gray-600">vs</span>
            <span className="flex items-center gap-1.5"><Flag teamId={nextMatch.team2.id} size={18} />{nextMatch.team2.name}</span>
          </div>
        </button>
      )}

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

      {!loading && data.length > 0 && remainingMatches > 0 && !leaderboardHasLive && (
        <button
          onClick={() => setProjectionMode(p => !p)}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border font-semibold text-sm transition-colors ${
            projectionMode
              ? 'bg-purple-900/60 border-purple-600 text-purple-200'
              : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
          }`}
        >
          📊 {projectionMode ? 'Ocultar Projeção' : 'Ver Projeção'}
        </button>
      )}

      {leaderboardHasLive && data.length > 0 && (
        <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/80 dark:bg-red-950/20 overflow-hidden">
          <div className="px-4 py-2 border-b border-red-200/60 dark:border-red-900/30 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
            <span className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider flex-1">Classificação ao vivo</span>
            <span className="text-xs text-gray-500 dark:text-gray-600">se acabasse agora</span>
          </div>
          <div className="divide-y divide-red-100 dark:divide-red-900/20">
            {data.map((entry, idx) => {
              const rank = ranks[idx]
              const p = entry as any
              const change: number | undefined = p.positionChange
              const liveGain: number = p.livePoints ?? 0
              return (
                <div
                  key={entry.participant.id}
                  className="flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors"
                  onClick={() => setSelectedParticipant({ id: entry.participant.id, name: entry.participant.name })}
                >
                  <span className="text-gray-500 text-xs w-5 text-right shrink-0 font-semibold">{rank}</span>
                  <span className="text-gray-200 text-sm font-semibold flex-1 min-w-0 truncate">{entry.participant.name}</span>
                  {liveGain > 0
                    ? <span className="text-green-700 dark:text-green-400 text-xs font-bold w-9 text-right shrink-0 tabular-nums">+{liveGain}</span>
                    : <span className="text-gray-500 dark:text-gray-600 text-xs font-bold w-9 text-right shrink-0">0</span>
                  }
                  <span className="w-9 text-right shrink-0 flex items-center justify-end">
                    {change === undefined || change === 0
                      ? <span className="w-2 h-2 rounded-sm bg-gray-400 dark:bg-gray-600 inline-block" />
                      : change > 0
                        ? <span className="text-blue-700 dark:text-blue-300 text-[10px] font-bold tabular-nums">▲{change}</span>
                        : <span className="text-red-700 dark:text-red-400 text-[10px] font-bold tabular-nums">▼{Math.abs(change)}</span>
                    }
                  </span>
                  <span className="text-gray-200 dark:text-yellow-400 font-bold text-sm shrink-0 w-10 text-right tabular-nums">{entry.totalPoints}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {projectionMode && data.length > 0 && (
        <div className="rounded-xl border border-purple-200 dark:border-purple-800 overflow-hidden">
          <div className="bg-purple-50 dark:bg-purple-950/60 px-4 py-2.5 border-b border-purple-200 dark:border-purple-800">
            <p className="text-xs text-purple-700 dark:text-purple-300 font-semibold uppercase tracking-wider">📊 Projeção — {remainingMatches} jogos restantes</p>
            <p className="text-xs text-purple-500 mt-0.5">Máximo estimado: pts atuais + {remainingMatches} × 8 pts/jogo</p>
          </div>
          <div className="divide-y divide-purple-100 dark:divide-purple-900/40">
            {data.map((entry, idx) => {
              const p = entry as any
              const rank = ranks[idx]
              return (
                <div key={entry.participant.id} className="px-4 py-3 bg-white dark:bg-gray-950/40 flex items-center gap-3">
                  <span className="text-gray-500 text-xs w-5 text-right shrink-0">{rank}</span>
                  <span className="text-gray-800 dark:text-gray-200 text-sm font-semibold flex-1 min-w-0 truncate">{entry.participant.name}</span>
                  <div className="flex items-center gap-3 shrink-0 text-sm">
                    <span className="text-purple-700 dark:text-purple-300 font-bold">{p.maxPossiblePoints ?? '—'}</span>
                    <span className="text-gray-500 dark:text-gray-600 text-xs">máx.</span>
                    <span className="w-16 text-right">
                      {p.pointsToFirst === 0
                        ? <span className="text-yellow-600 dark:text-yellow-400 font-bold text-xs">Líder</span>
                        : p.canReachFirst
                        ? <span className="text-green-600 dark:text-green-400 text-xs">+{p.pointsToFirst} p/ 1º</span>
                        : <span className="text-gray-500 dark:text-gray-600 text-xs">+{p.pointsToFirst} p/ 1º</span>}
                    </span>
                    <span className="w-16 text-right">
                      {p.isInTop7
                        ? <span className="text-green-600 dark:text-green-400 text-xs font-bold">Top 7 ✓</span>
                        : p.canReachTop7
                        ? <span className="text-yellow-600 dark:text-yellow-400 text-xs">+{p.pointsToTop7} p/ T7</span>
                        : <span className="text-red-600 dark:text-red-500 text-xs">fora</span>}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!loading && data.length > 0 && !leaderboardHasLive && (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left w-10">#</th>
                <th className="px-4 py-3 text-left">Participante</th>
                <th className="px-4 py-3 text-right">Último</th>
                <th className="px-4 py-3 text-right">Últ. 4</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {data.map((entry, idx) => {
                const rank = ranks[idx]
                const tier = tierOf(entry.totalPoints)
                const p = entry as any
                const flash = flashMap[entry.participant.id]
                return (
                <tr
                  key={entry.participant.id}
                  onClick={() => setSelectedParticipant({ id: entry.participant.id, name: entry.participant.name })}
                  className={`cursor-pointer transition-colors ${
                    isRelated(entry.totalPoints) ? 'bg-red-50 hover:bg-red-100 dark:bg-red-950/50 dark:hover:bg-red-950/70' :
                    isWarning(entry.totalPoints) ? 'bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-950/20 dark:hover:bg-yellow-950/30' :
                    tier === 1 ? 'bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-950/40 dark:hover:bg-yellow-950/60' :
                    tier === 2 ? 'bg-gray-800/30 hover:bg-gray-800/60' :
                    tier === 3 ? 'bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/30 dark:hover:bg-orange-950/50' :
                    'hover:bg-gray-900/50'
                  } ${flash === 'up' ? 'animate-flash-up' : flash === 'down' ? 'animate-flash-down' : ''}`}
                >
                  <td className="px-4 py-3 text-center font-bold text-lg">
                    {isRelated(entry.totalPoints)
                      ? '💸'
                      : isWarning(entry.totalPoints)
                      ? (isFirstOfRank[idx] ? <span className="text-yellow-500 text-sm">{rank}</span> : null)
                      : trophies[tier]
                      ?? (rank >= 4 && rank <= 7
                          ? (isFirstOfRank[idx] ? <span className="text-green-600 dark:text-green-400 text-sm">{rank}</span> : null)
                          : (isFirstOfRank[idx] ? <span className="text-gray-500 text-sm">{rank}</span> : null))}
                  </td>
                  <td className={`px-4 py-3 font-semibold ${
                    isRelated(entry.totalPoints) ? 'text-red-700 dark:text-red-300' :
                    isWarning(entry.totalPoints) ? 'text-yellow-600 dark:text-yellow-400' :
                    tier === 1 ? 'text-yellow-700 dark:text-yellow-300' :
                    tier === 2 ? 'text-gray-300' :
                    tier === 3 ? 'text-amber-600' :
                    (rank >= 4 && rank <= 7) ? 'text-green-600 dark:text-green-400' :
                    ''
                  }`}>
                    {entry.participant.name}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {entry.lastMatchPoints > 0
                      ? <span className="text-green-600 dark:text-green-400 font-semibold">+{entry.lastMatchPoints}</span>
                      : <span className="text-gray-400 dark:text-gray-500">0</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {(() => {
                      const pts = p.last4Points ?? 0
                      return <span className={pts > 0 ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-gray-400 dark:text-gray-500'}>{pts}</span>
                    })()}
                  </td>
                  <td className={`px-4 py-3 text-right font-bold text-base ${isRelated(entry.totalPoints) ? 'text-red-600 dark:text-red-400' : isWarning(entry.totalPoints) ? 'text-yellow-600 dark:text-yellow-500' : 'text-yellow-600 dark:text-yellow-400'}`}>
                    {entry.totalPoints}
                  </td>
                </tr>
              )}
            )}
            </tbody>
          </table>
          <p className="text-xs text-gray-700 text-center py-2">Clique num participante para ver seus palpites</p>
        </div>
      )}

      {selectedParticipant && (
        <ParticipantModal
          participantId={selectedParticipant.id}
          name={selectedParticipant.name}
          onClose={() => setSelectedParticipant(null)}
        />
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8">
        {[
          { label: 'Resultado certo', pts: '4 pts', icon: '✅' },
          { label: 'Placar exato', pts: '+2 pts', icon: '🎯' },
          { label: 'Gols de um time', pts: '1 pt/time', icon: '⚽' },
          { label: 'Acertar gols do vencedor (≥ 4 gols)', pts: '+2 pts', icon: '🔥' },
        ].map(item => (
          <div key={item.label} className="bg-gray-900 rounded-lg p-3 text-center border border-gray-800">
            <div className="text-2xl mb-1">{item.icon}</div>
            <div className="text-xs text-gray-400">{item.label}</div>
            <div className="text-green-600 dark:text-green-400 font-bold text-sm">{item.pts}</div>
          </div>
        ))}
      </div>

      <div className="text-center text-xs text-gray-600 mt-4">
        Classificação atualizada em tempo real conforme resultados são lançados
      </div>

      {matchModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ touchAction: 'none' }} onClick={() => setMatchModal(null)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative w-full max-w-lg bg-white dark:bg-gray-950 border border-gray-800 rounded-t-2xl p-4 pb-8 max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-800 dark:text-gray-200 text-base">{matchModal.label}</h3>
              <button onClick={() => setMatchModal(null)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-lg leading-none">✕</button>
            </div>

            {matchPredLoading ? (
              <p className="text-center text-gray-500 py-6">Carregando palpites...</p>
            ) : matchPredictions.length === 0 ? (
              <p className="text-center text-gray-500 py-6">Nenhum palpite registrado ainda.</p>
            ) : (
              <>
                <div className="divide-y divide-gray-200 dark:divide-gray-800 mb-4">
                  {Object.entries(
                    matchPredictions.reduce<Record<string, string[]>>((acc, p) => {
                      const key = `${p.score1}×${p.score2}`
                      acc[key] = [...(acc[key] ?? []), p.name]
                      return acc
                    }, {})
                  )
                    .sort((a, b) => b[1].length - a[1].length)
                    .map(([score, names]) => (
                      <div key={score} className="flex items-start justify-between gap-3 py-2.5">
                        <div className="flex flex-wrap gap-1 flex-1">
                          {names.sort().map(name => (
                            <span key={name} title={name} className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded px-1.5 py-0.5">{name === 'LUCILIO' ? 'LCLI' : name === 'MORELLI' ? 'MRLI' : name.substring(0, 4)}</span>
                          ))}
                        </div>
                        <span className="text-sm font-bold text-green-700 dark:text-yellow-400 shrink-0">{score}</span>
                      </div>
                    ))}
                </div>
                <button
                  onClick={() => shareMatchPredictions(matchModal.label.split(' vs ')[0], matchModal.label.split(' vs ')[1], '')}
                  className="w-full flex items-center justify-center gap-2 bg-[#00bf63] hover:bg-[#00a854] text-[white] py-2.5 rounded-xl font-semibold text-sm transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Compartilhar palpites
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {notifToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-800 border border-gray-700 text-gray-100 text-sm px-4 py-3 rounded-xl shadow-xl max-w-xs w-max text-center animate-fade-in">
          {notifToast}
        </div>
      )}

      {activeUsers !== null && (
        <div className="text-center text-xs text-gray-600 py-4 pb-8">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 align-middle" />
          {activeUsers} {activeUsers === 1 ? 'pessoa online' : 'pessoas online'}
        </div>
      )}
    </div>
  )
}
