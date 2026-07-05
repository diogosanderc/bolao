'use client'

import { useEffect, useLayoutEffect, useRef, useState, ReactNode } from 'react'
import { LeaderboardEntry } from '@/lib/types'
import { Flag } from '@/components/Flag'
import { ParticipantModal } from '@/components/ParticipantModal'
import { Scoreboard } from '@/components/Scoreboard'
import { AnimatedNumber } from '@/components/AnimatedNumber'
import { BroadcastBadges } from '@/components/BroadcastBadges'
import { broadcastersForMatchId } from '@/lib/broadcasters'
import { matchById } from '@/lib/copa2026'
import { chipCode } from '@/lib/names'
import { positionMessage } from '@/lib/positionMessage'
import { Onboarding } from '@/components/Onboarding'
import { Icon, IconName } from '@/components/Icon'

type RecentMatch = {
  matchId: string
  score1: number
  score2: number
  team1: { id: string; name: string; flag: string }
  team2: { id: string; name: string; flag: string }
}
type LastMatch = RecentMatch | null

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
  date?: string
  dateBRT: string
  venue: string
  inProgress: boolean
  suspended?: boolean
  liveScore1?: number
  liveScore2?: number
  clock?: string
  goals?: GoalEvent[]
  isPenalties?: boolean
  penaltyScore1?: number
  penaltyScore2?: number
}

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardEntry[]>([])
  const [lastMatch, setLastMatch] = useState<LastMatch>(null)
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([])
  const [recentIdx, setRecentIdx] = useState(0)
  const recentRef = useRef<HTMLDivElement>(null)
  const [nextMatch, setNextMatch] = useState<ScheduleMatch | null>(null)
  const [nextMatches, setNextMatches] = useState<ScheduleMatch[]>([])
  const [upcoming, setUpcoming] = useState<ScheduleMatch[]>([])
  const [liveMatches, setLiveMatches] = useState<ScheduleMatch[]>([])
  const [carouselIdx, setCarouselIdx] = useState(0)
  const carouselRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [projectionMode, setProjectionMode] = useState(false)
  const [remainingMatches, setRemainingMatches] = useState(0)
  const [leaderboardHasLive, setLeaderboardHasLive] = useState(false)
  const [activeUsers, setActiveUsers] = useState<number | null>(null)
  const [selectedParticipant, setSelectedParticipant] = useState<{ id: string; name: string } | null>(null)
  const [matchModal, setMatchModal] = useState<{ matchId: string; label: string; t1?: string; t2?: string } | null>(null)
  // Tracks whether any modal/overlay is open, so background polling can pause
  // (avoids reflowing the leaderboard — and the scroll-restore jump that follows — behind a locked modal)
  const overlayOpenRef = useRef(false)
  useEffect(() => {
    overlayOpenRef.current = selectedParticipant !== null || matchModal !== null
  }, [selectedParticipant, matchModal])
  const [matchPredictions, setMatchPredictions] = useState<{ name: string; score1: number; score2: number }[]>([])
  const [matchResult, setMatchResult] = useState<{ score1: number; score2: number } | null>(null)
  const [matchPredLoading, setMatchPredLoading] = useState(false)
  const [sharingImage, setSharingImage] = useState(false)
  const [imagePicker, setImagePicker] = useState(false)
  const [reloading, setReloading] = useState(false)
  const [scheduleLoaded, setScheduleLoaded] = useState(false)
  const [now, setNow] = useState(0)
  const [rowsIn, setRowsIn] = useState(false)
  const rowsStartedRef = useRef(false)

  const [zoneFilter, setZoneFilter] = useState<'all' | 'top7' | 'red'>('all')
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [roundDismissed, setRoundDismissed] = useState<string | null>(null)
  const [ujOpen, setUjOpen] = useState<string | null>(null)
  const [myId, setMyId] = useState<string | null>(null)
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map())
  const prevRects = useRef<Map<string, DOMRect>>(new Map())
  const prevMyLiveRef = useRef(0)
  const prevMyRankRef = useRef<number | null>(null)
  type ImageColumn = 'uj' | 'u2' | 'u2grupos' | 'jmata'
  const [imageColumn, setImageColumn] = useState<ImageColumn>('uj')
  const leaderboardRef = useRef<HTMLDivElement>(null)

  function openMatchPredictions(matchId: string, label: string, liveScore?: { score1: number; score2: number }, teams?: { t1: string; t2: string }) {
    setMatchModal({ matchId, label, t1: teams?.t1, t2: teams?.t2 })
    setMatchPredictions([])
    setMatchResult(liveScore ?? null)
    setMatchPredLoading(true)
    fetch(`/api/match/${matchId}/predictions`)
      .then(r => r.json())
      .then(d => {
        setMatchPredictions(d.predictions ?? [])
        // Final result wins; otherwise keep the live score passed in (if any)
        if (d.result) setMatchResult({ score1: d.result.score1, score2: d.result.score2 })
        setMatchPredLoading(false)
      })
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
    return fetch('/api/leaderboard')
      .then(r => r.json())
      .then(d => {
        setData(Array.isArray(d.leaderboard) ? d.leaderboard : [])
        setLastMatch(d.lastMatch ?? null)
        setRecentMatches(Array.isArray(d.recentMatches) ? d.recentMatches : (d.lastMatch ? [d.lastMatch] : []))
        setRemainingMatches(d.remainingMatches ?? 0)
        setLeaderboardHasLive(d.hasLive ?? false)
        setLastRefresh(new Date())
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  function fetchSchedule() {
    return fetch('/api/schedule')
      .then(r => r.json())
      .then(d => {
        setNextMatch(d.nextMatch ?? null)
        setNextMatches(Array.isArray(d.nextMatches) ? d.nextMatches : [])
        setUpcoming(Array.isArray(d.upcoming) ? d.upcoming : [])
        setLiveMatches(Array.isArray(d.live) ? d.live : [])
        setScheduleLoaded(true)
      })
      .catch(() => setScheduleLoaded(true))
  }

  // Light haptic feedback when supported (no-op on desktop/iOS Safari)
  function haptic(ms = 10) {
    try { navigator.vibrate?.(ms) } catch {}
  }

  // Header refresh button: full page reload so every section comes back fresh
  async function doRefresh() {
    if (reloading) return
    setReloading(true)
    haptic(8)
    await fetch('/api/sync/live', { method: 'POST' }).catch(() => {})
    window.location.reload()
  }

  function openParticipant(id: string, name: string) {
    haptic(8)
    setSelectedParticipant({ id, name })
  }

  function toggleMe(id: string) {
    setMyId(prev => {
      const next = prev === id ? null : id
      if (next) localStorage.setItem('bolao_me', next)
      else localStorage.removeItem('bolao_me')
      // Record the identification server-side for the admin overview
      fetch('/api/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next ? { participantId: next } : { prevId: prev }),
      }).catch(() => {})
      // Associate this device's push subscription with the chosen participant
      // (or clear it), so background "you moved" pushes target the right person.
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready
          .then(reg => reg.pushManager.getSubscription())
          .then(sub => {
            if (!sub) return
            fetch('/api/push/identify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ endpoint: sub.endpoint, participantId: next }),
            }).catch(() => {})
          })
          .catch(() => {})
      }
      return next
    })
  }

  // In-app toast + OS notification (when enabled) for the "me" participant
  async function notifyMe(title: string, body: string) {
    haptic(40)
    showToast(`${title} — ${body}`)
    try {
      if ('Notification' in window && Notification.permission === 'granted' && 'serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready
        reg.showNotification(title, { body, icon: '/icon-192.png', badge: '/icon-192.png', tag: 'bolao-pos', renotify: true } as NotificationOptions)
      }
    } catch {}
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

    fetchSchedule()
    const interval = setInterval(() => { if (!overlayOpenRef.current) fetchSchedule() }, 10_000)
    return () => {
      clearInterval(presenceInterval)
      clearInterval(interval)
    }
  }, [])

  // While any match is live — per /api/schedule OR per the leaderboard's own
  // provisional scoring — keep the leaderboard polling fast and force an ESPN sync.
  const isLiveNow = liveMatches.length > 0 || leaderboardHasLive
  useEffect(() => {
    if (!isLiveNow) return
    const leaderboardInterval = setInterval(() => { if (!overlayOpenRef.current) fetchLeaderboard() }, 10_000)
    const syncInterval = setInterval(() => {
      fetch('/api/sync/live', { method: 'POST' }).catch(() => {})
    }, 30_000) // background poller handles real-time; this is a fallback only
    // Trigger sync immediately when a live match is first detected
    fetch('/api/sync/live', { method: 'POST' }).catch(() => {})
    return () => {
      clearInterval(leaderboardInterval)
      clearInterval(syncInterval)
    }
  }, [isLiveNow])

  function formatCountdown(iso?: string): string | null {
    if (!iso || !now) return null
    const diff = new Date(iso).getTime() - now
    if (diff <= 0 || diff > 7 * 24 * 3600_000) return null
    const h = Math.floor(diff / 3600_000)
    const m = Math.floor((diff % 3600_000) / 60_000)
    const s = Math.floor((diff % 60_000) / 1000)
    if (h > 0) return `${h}h${String(m).padStart(2, '0')}`
    if (m > 0) return `${m}min ${String(s).padStart(2, '0')}s`
    return `${s}s`
  }

  const trophies: Record<number, ReactNode> = {
    1: <Icon name="medal" size={16} className="inline text-yellow-500" />,
    2: <Icon name="medal" size={16} className="inline text-gray-400" />,
    3: <Icon name="medal" size={16} className="inline text-amber-600" />,
  }

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

  // Load identified "me" from localStorage
  useEffect(() => {
    setMyId(localStorage.getItem('bolao_me'))
  }, [])

  // Detect rank changes: buzz + celebrate podium entries (movement itself is FLIP-animated)
  useEffect(() => {
    if (data.length === 0) return
    const newRanks = new Map<string, number>()
    data.forEach(entry => {
      newRanks.set(entry.participant.id, data.filter(e => e.totalPoints > entry.totalPoints).length + 1)
    })
    let anyChange = false
    if (prevRanksRef.current.size > 0) {
      for (const [id, newRank] of newRanks) {
        const prev = prevRanksRef.current.get(id)
        if (prev !== undefined && prev !== newRank) anyChange = true
      }
    }
    prevRanksRef.current = newRanks
    if (anyChange) haptic(15)
  }, [data])

  // Buzz + highlight when a live goal changes MY points (original behaviour)
  useEffect(() => {
    if (!myId) return
    const me = data.find(e => e.participant.id === myId) as any
    const lp = me?.livePoints ?? 0
    if (leaderboardHasLive && lp > prevMyLiveRef.current && prevMyLiveRef.current >= 0) {
      const gain = lp - prevMyLiveRef.current
      haptic(40)
      showToast(`⚽ Você ganhou +${gain} ao vivo!`)
      setFlashMap(m => ({ ...m, [myId]: 'up' }))
      const t = setTimeout(() => setFlashMap(m => { const n = { ...m }; delete n[myId]; return n }), 2200)
      prevMyLiveRef.current = lp
      return () => clearTimeout(t)
    }
    prevMyLiveRef.current = lp
  }, [data, myId, leaderboardHasLive])

  const prevAllLiveRef = useRef<Map<string, number>>(new Map())

  // Flash all OTHER participants when their live points change
  useEffect(() => {
    if (!leaderboardHasLive) return
    const newFlash: Record<string, 'up' | 'down'> = {}
    for (const entry of data) {
      if (entry.participant.id === myId) continue  // "me" is handled above
      const lp = (entry as any).livePoints ?? 0
      const prev = prevAllLiveRef.current.get(entry.participant.id) ?? 0
      if (lp !== prev && prevAllLiveRef.current.size > 0) {
        newFlash[entry.participant.id] = lp > prev ? 'up' : 'down'
      }
      prevAllLiveRef.current.set(entry.participant.id, lp)
    }
    if (Object.keys(newFlash).length > 0) {
      setFlashMap(m => ({ ...m, ...newFlash }))
      const t = setTimeout(() => setFlashMap(m => {
        const n = { ...m }
        for (const id of Object.keys(newFlash)) delete n[id]
        return n
      }), 2200)
      return () => clearTimeout(t)
    }
  }, [data, myId, leaderboardHasLive])

  // Notify the "me" participant about position changes after a live round
  useEffect(() => {
    if (!myId || data.length === 0) return
    const idx = data.findIndex(e => e.participant.id === myId)
    if (idx < 0) { prevMyRankRef.current = null; return }
    const rank = data.filter(e => e.totalPoints > data[idx].totalPoints).length + 1
    const prev = prevMyRankRef.current
    prevMyRankRef.current = rank
    if (prev === null || prev === rank) return // first read or no change

    const msg = positionMessage(prev, rank, data.length)
    if (msg) notifyMe(msg.title, msg.body)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, myId])

  // FLIP: smoothly slide rows to their new positions when the order changes
  useLayoutEffect(() => {
    const newRects = new Map<string, DOMRect>()
    rowRefs.current.forEach((el, id) => newRects.set(id, el.getBoundingClientRect()))
    newRects.forEach((newRect, id) => {
      const old = prevRects.current.get(id)
      if (!old) return
      const dy = old.top - newRect.top
      if (Math.abs(dy) > 1) {
        const el = rowRefs.current.get(id)
        if (!el) return
        el.style.transition = 'none'
        el.style.transform = `translateY(${dy}px)`
        requestAnimationFrame(() => {
          el.style.transition = 'transform 0.45s cubic-bezier(0.22,0.61,0.36,1)'
          el.style.transform = ''
        })
      }
    })
    prevRects.current = newRects
  }, [data])

  // Stagger-animate leaderboard rows once, on first data load
  useEffect(() => {
    if (!rowsStartedRef.current && data.length > 0) {
      rowsStartedRef.current = true
      setRowsIn(true)
      const t = setTimeout(() => setRowsIn(false), 1500)
      return () => clearTimeout(t)
    }
  }, [data.length])

  // Countdown ticker — only runs while there's an upcoming match with a date
  const nextStart = nextMatches[0]?.date ?? nextMatch?.date
  useEffect(() => {
    if (!nextStart) return
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [nextStart])

  // Floating "back to top" button visibility
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 700)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    try { setRoundDismissed(localStorage.getItem('bolao_round_dismissed')) } catch {}
  }, [])
  function dismissRound(matchId: string) {
    try { localStorage.setItem('bolao_round_dismissed', matchId) } catch {}
    setRoundDismissed(matchId)
  }

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
        body: JSON.stringify({ endpoint: sub.endpoint, keys: { p256dh, auth }, participantId: myId ?? undefined }),
      })
      if (!r.ok) { showToast('⚠️ Erro ao salvar assinatura no servidor'); return }
      setNotifState('subscribed')
      showToast('🔔 Notificações ativadas! Você receberá alertas de gols e resultados.')
    } catch (err: any) {
      showToast('⚠️ Erro: ' + (err?.message ?? 'falhou'))
    }
  }

  async function shareImage(col: ImageColumn = imageColumn) {
    if (sharingImage) return
    setSharingImage(true)
    const selectedCol = col
    try {
      const DPR = 2
      const W = 700
      const ROW_H = 26
      const PAD = 12
      const half = Math.ceil(data.length / 2)
      const colH = half * ROW_H
      const headerH = (lastMatch ? 56 : 40) + 18
      const H = headerH + colH + 40
      const canvas = document.createElement('canvas')
      canvas.width = W * DPR
      canvas.height = H * DPR
      const ctx = canvas.getContext('2d')!
      ctx.scale(DPR, DPR)

      // Background
      ctx.fillStyle = '#111827'
      ctx.fillRect(0, 0, W, H)

      // Title
      ctx.font = 'bold 16px system-ui'
      ctx.fillStyle = '#facc15'
      ctx.textAlign = 'center'
      ctx.fillText('🏆 Classificação Bolão Copa 2026', W / 2, 26)

      const colLabel: Record<ImageColumn, string> = {
        uj: 'UJ = pts último jogo',
        u2: 'U2 = (penúltimo + último)',
        u2grupos: 'U2 + Grupos = (penúltimo + último) +bonus grupos/R16',
        jmata: 'Mata-mata (último jogo) = (resultado + regra do mata-mata)',
      }
      let headerY = 40
      if (lastMatch) {
        ctx.font = '11px system-ui'
        ctx.fillStyle = '#9ca3af'
        ctx.fillText(`Último jogo: ${lastMatch.team1.name} ${lastMatch.score1}×${lastMatch.score2} ${lastMatch.team2.name}`, W / 2, headerY)
        headerY += 16
      }
      ctx.font = '10px system-ui'
      ctx.fillStyle = '#00bf63'
      ctx.fillText(colLabel[selectedCol], W / 2, headerY)
      headerY += 16

      const colW = (W - PAD * 3) / 2
      const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

      for (let c = 0; c < 2; c++) {
        const start = c === 0 ? 0 : half
        const end = c === 0 ? half : data.length
        const x = PAD + c * (colW + PAD)

        for (let i = start; i < end; i++) {
          const entry = data[i]
          const rowIdx = i - start
          const y = headerY + rowIdx * ROW_H
          const rank = ranks[i]
          const tier = tierOf(entry.totalPoints)
          const isBot = isRelated(entry.totalPoints)
          const isWarn = isWarning(entry.totalPoints)
          const first = isFirstOfRank[i]

          const isTop7 = !isBot && !isWarn && tier > 3 && rank >= 4 && rank <= 7

          // Row background
          ctx.fillStyle = isBot ? '#3b0a0a' : isWarn ? '#2d1a06' : tier === 1 ? '#2d1f06' : isTop7 ? '#052e16' : i % 2 === 0 ? '#1f2937' : '#1a2231'
          ctx.beginPath()
          const r = 4
          ctx.moveTo(x + r, y + 1)
          ctx.arcTo(x + colW, y + 1, x + colW, y + ROW_H - 1, r)
          ctx.arcTo(x + colW, y + ROW_H - 1, x, y + ROW_H - 1, r)
          ctx.arcTo(x, y + ROW_H - 1, x, y + 1, r)
          ctx.arcTo(x, y + 1, x + colW, y + 1, r)
          ctx.closePath()
          ctx.fill()

          const midY = y + ROW_H / 2 + 4

          // Rank / medal
          const medal = medals[tier]
          ctx.font = '12px system-ui'
          ctx.textAlign = 'center'
          if (medal && first) {
            ctx.fillText(medal, x + 14, midY)
          } else if (first) {
            ctx.fillStyle = isBot ? '#f87171' : '#6b7280'
            ctx.fillText(String(rank), x + 14, midY)
          }

          // Position change arrow — drawn LEFT of name so right side stays clear
          const change: number | undefined = (entry as any).positionChange
          ctx.font = 'bold 9px system-ui'
          ctx.textAlign = 'left'
          if (change && change !== 0) {
            ctx.fillStyle = change > 0 ? '#60a5fa' : '#f87171'
            ctx.fillText(change > 0 ? '▲' : '▼', x + 23, midY)
          }

          // Name
          const nameColor = isBot ? '#fca5a5' : isWarn ? '#fde68a' : tier === 1 ? '#fde68a' : tier === 2 ? '#d1d5db' : tier === 3 ? '#d97706' : isTop7 ? '#00bf63' : '#e5e7eb'
          ctx.fillStyle = nameColor
          ctx.font = 'bold 11px system-ui'
          ctx.textAlign = 'left'
          const maxNameW = colW - 115
          let name = entry.participant.name
          while (ctx.measureText(name).width > maxNameW && name.length > 3) name = name.slice(0, -1)
          if (name !== entry.participant.name) name = name.trimEnd() + '…'
          ctx.fillText(name, x + 33, midY)

          // Extra column — right-aligned, clear of total pts
          const p = entry as any
          ctx.font = '10px system-ui'
          ctx.textAlign = 'right'
          if (selectedCol === 'uj') {
            const v = p.lastMatchPts ?? entry.lastMatchPoints ?? 0
            if (v > 0) {
              ctx.fillStyle = '#00bf63'
              ctx.fillText(`+${v}`, x + colW - 36, midY)
            }
          } else if (selectedCol === 'u2') {
            const a = p.secondLastMatchPts ?? 0
            const b = p.lastMatchPts ?? 0
            ctx.fillStyle = '#00bf63'
            ctx.fillText(`(${a}+${b})`, x + colW - 36, midY)
          } else if (selectedCol === 'u2grupos') {
            const a = p.secondLastMatchPts ?? 0
            const b = p.lastMatchPts ?? 0
            const u2 = a + b
            const z = p.groupBonus ?? 0
            ctx.fillStyle = '#00bf63'
            ctx.fillText(`(${u2}+${z})`, x + colW - 36, midY)
          } else if (selectedCol === 'jmata') {
            // Last knockout game only: X = result pts, Y = mata-mata rule pts
            const xPts = p.lastKoResultPts ?? 0
            const yPts = p.lastKoRulePts ?? 0
            ctx.fillStyle = '#00bf63'
            ctx.fillText(`(${xPts}+${yPts})`, x + colW - 36, midY)
          }

          // Total points (right column)
          ctx.fillStyle = isBot ? '#f87171' : '#facc15'
          ctx.font = 'bold 12px system-ui'
          ctx.textAlign = 'right'
          ctx.fillText(String(entry.totalPoints), x + colW - 4, midY)
        }
      }

      // Footer
      ctx.textAlign = 'center'
      const stamp = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      ctx.fillStyle = '#4b5563'; ctx.font = '10px system-ui'
      ctx.fillText(`Bolão Copa 2026 · ${stamp}`, W / 2, H - 22)
      ctx.fillStyle = '#374151'; ctx.font = '10px system-ui'
      ctx.fillText('bolao-production-cf4b.up.railway.app', W / 2, H - 8)

      const blob: Blob | null = await new Promise(res => canvas.toBlob(res, 'image/png'))
      if (!blob) throw new Error('Falha ao gerar imagem')
      const file = new File([blob], 'classificacao-bolao.png', { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Classificação Bolão Copa 2026', text: 'https://bolao-production-cf4b.up.railway.app' })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'classificacao-bolao.png'
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') alert(`Erro ao compartilhar: ${err?.message ?? err}`)
    } finally {
      setSharingImage(false)
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
      const trophyEmoji: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }
      const medal = isRelated(entry.totalPoints) ? (isFirstOfRank[idx] ? `${rank}.` : '   ') : isWarning(entry.totalPoints) ? '⚠️' : (trophyEmoji[tier] ?? (rank >= 4 && rank <= 7 && isFirstOfRank[idx] ? '⭐' : (isFirstOfRank[idx] ? `${rank}.` : '   ')))
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
      {/* Refresh indicator (header button) */}
      {reloading && (
        <div
          className="fixed left-0 right-0 top-0 z-40 flex justify-center pointer-events-none"
          style={{ transform: 'translateY(12px)' }}
        >
          <span className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-800/90 border border-gray-700 shadow-lg">
            <svg className="w-5 h-5 text-gray-200 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-200 dark:text-yellow-400">
          BOLÃO DA COPA 2026
        </h2>
        <div className="flex items-center gap-2">
          {notifState !== 'unsupported' && (
            <div className="relative">
              <button
                onClick={toggleNotifications}
                title={notifState === 'subscribed' ? 'Notificações ativas — clique para desativar' : notifState === 'denied' ? 'Notificações bloqueadas no browser' : 'Ativar notificações de gol e resultado'}
                className={`flex items-center justify-center w-10 h-10 rounded-full transition-colors ${
                  notifState === 'subscribed' ? 'text-[#00bf63] hover:bg-gray-800' :
                  notifState === 'denied' ? 'text-gray-600 cursor-not-allowed' :
                  'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                }`}
                disabled={notifState === 'denied'}
              >
                {notifState === 'denied' ? (
                  <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.7 3A6 6 0 0 1 18 8c0 3 .5 4.5 1.5 6M6 8c0-.7.1-1.4.3-2M5 8c0 5-2 6-2 6h13M9 18a3 3 0 0 0 6 0" /><line x1="3" y1="3" x2="21" y2="21" /></svg>
                ) : (
                  <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" /><path d="M9 18a3 3 0 0 0 6 0" /></svg>
                )}
              </button>
              {notifState === 'subscribed' && (
                <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-green-400 rounded-full border border-gray-950" />
              )}
            </div>
          )}
          {!loading && data.length > 0 && (
            <div className="flex items-center gap-2 relative">
              {imagePicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setImagePicker(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 bg-gray-800 border border-gray-700 rounded-xl shadow-xl p-2 flex flex-col gap-1 min-w-[200px]">
                  {([
                    ['uj', 'UJ — pts do último jogo'],
                    ['u2', 'U2 — (penúltimo + último)'],
                    ['u2grupos', 'U2 + Grupos — (pen.+últ.) +bonus'],
                    ['jmata', 'Mata-mata — (resultado + regra) do último jogo'],
                  ] as [ImageColumn, string][]).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => { setImageColumn(val); setImagePicker(false); shareImage(val) }}
                      className={`text-left text-sm px-3 py-2 rounded-lg transition-colors font-medium ${imageColumn === val ? 'bg-[#00bf63] text-white' : 'text-gray-300 hover:bg-gray-700'}`}
                    >
                      {label}
                    </button>
                  ))}
                  </div>
                </>
              )}
              <button
                onClick={() => setImagePicker(p => !p)}
                disabled={sharingImage}
                title="Compartilhar tabela como imagem"
                className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-800 disabled:opacity-50 text-[#00bf63] transition-colors shrink-0"
              >
                {sharingImage ? (
                  <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                )}
              </button>
            </div>
          )}
          <button
            onClick={doRefresh}
            disabled={reloading}
            className="flex items-center justify-center w-10 h-10 rounded-full text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors shrink-0"
            aria-label="Atualizar"
          >
            <svg className={`w-6 h-6 ${reloading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>
      </div>

      {!scheduleLoaded && liveMatches.length === 0 && !lastMatch && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 space-y-2">
          <div className="skeleton h-3 w-24" />
          <div className="skeleton h-5 w-full" />
        </div>
      )}

      {liveMatches.length > 0 && (
        <div className="space-y-3">
          <div className={`grid gap-3 ${liveMatches.length > 1 ? 'sm:grid-cols-2' : ''}`}>
          {liveMatches.map(m => (
            <div
              key={m.matchId}
              onClick={() => openMatchPredictions(m.matchId, `${m.team1.name} vs ${m.team2.name}`, m.liveScore1 !== undefined && m.liveScore2 !== undefined ? { score1: m.liveScore1, score2: m.liveScore2 } : undefined, { t1: m.team1.id, t2: m.team2.id })}
              className={`border rounded-lg px-4 py-2.5 cursor-pointer transition-shadow hover:shadow-lg ${m.suspended ? 'bg-yellow-50 dark:bg-yellow-950/60 border-yellow-400 dark:border-yellow-700' : 'bg-red-50 dark:bg-red-950/60 border-red-400 dark:border-red-700'}`}
            >
              <div className="flex items-center justify-between mb-1">
                {m.suspended
                  ? <span className="flex items-center gap-1.5 text-xs text-yellow-700 dark:text-yellow-400 uppercase tracking-wider font-bold"><Icon name="cloud-rain" size={14} /> Paralisado</span>
                  : <span className="flex items-center gap-1.5 text-xs text-red-700 dark:text-red-400 uppercase tracking-wider font-bold"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Ao vivo</span>}
                {m.clock && <span className={`text-xs font-semibold ${m.suspended ? 'text-yellow-700 dark:text-yellow-300' : 'text-red-800 dark:text-red-300'}`}>{m.clock}</span>}
              </div>
              <div className="flex items-center gap-2.5 text-sm text-gray-200 dark:text-white">
                <span className="flex items-center gap-1.5 min-w-0"><Flag teamId={m.team1.id} size={22} /><span className="truncate">{m.team1.name}</span></span>
                <div className="flex flex-col items-center shrink-0">
                  <Scoreboard score1={m.liveScore1} score2={m.liveScore2} pending={m.liveScore1 === undefined} size="md" live={!m.suspended} />
                  {m.isPenalties && m.penaltyScore1 !== undefined && m.penaltyScore2 !== undefined && (
                    <span className="text-[10px] font-semibold text-red-700 dark:text-red-400 tabular-nums mt-0.5">
                      Pên: {m.penaltyScore1} – {m.penaltyScore2}
                    </span>
                  )}
                </div>
                <span className="flex items-center gap-1.5 min-w-0"><Flag teamId={m.team2.id} size={22} /><span className="truncate">{m.team2.name}</span></span>
              </div>
              {m.goals && m.goals.length > 0 && (() => {
                const t1Goals = m.goals.filter(g => g.teamId === m.team1.id)
                const t2Goals = m.goals.filter(g => g.teamId === m.team2.id)
                return (
                  <div className="mt-2 space-y-0.5">
                    {[{ team: m.team1, goals: t1Goals }, { team: m.team2, goals: t2Goals }].map(({ team, goals }) => {
                      if (goals.length === 0) return null
                      // Group goals by player: "Neymar 34', 67'" instead of repeating the name
                      const byPlayer = new Map<string, string[]>()
                      for (const g of goals) {
                        const key = g.playerName || '?'
                        if (!byPlayer.has(key)) byPlayer.set(key, [])
                        if (g.minute) byPlayer.get(key)!.push(`${g.minute}'`)
                      }
                      return (
                        <div key={team.id} className="flex items-center gap-1.5 flex-wrap">
                          <Flag teamId={team.id} size={14} />
                          {[...byPlayer.entries()].map(([player, minutes]) => (
                            <span key={player} className="text-xs text-red-800 dark:text-red-200 inline-flex items-center gap-0.5">
                              <span className="shrink-0 leading-none">⚽</span> {player}{minutes.length > 0 && <span className="text-red-700 dark:text-red-400"> {minutes.join(', ')}</span>}
                            </span>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
              <p className="flex items-center justify-end gap-1 text-[10px] text-gray-500 dark:text-gray-400 mt-1.5"><Icon name="eye" size={12} /> toque para ver os palpites</p>
            </div>
          ))}
          </div>
          {lastRefresh && (
            <p className="text-right text-xs text-gray-600 pr-1">
              atualizado {lastRefresh.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          )}
        </div>
      )}

      {liveMatches.length > 0 && (() => {
        const next = nextMatches.filter(m => !liveMatches.some(l => l.matchId === m.matchId))
        if (next.length === 0) return null
        return (
          <div className={`grid gap-3 ${next.length > 1 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-3'}`}>
            {next.map(m => (
              <div key={m.matchId} className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Próximo jogo</span>
                  <span className="text-xs text-green-700 dark:text-yellow-500 font-semibold">{m.dateBRT}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <span className="flex items-center gap-1.5"><Flag teamId={m.team1.id} size={18} />{m.team1.name}</span>
                  <span className="text-gray-600">vs</span>
                  <span className="flex items-center gap-1.5"><Flag teamId={m.team2.id} size={18} />{m.team2.name}</span>
                </div>
                <BroadcastBadges channels={broadcastersForMatchId(m.matchId, m.team1.id, m.team2.id, matchById[m.matchId]?.phase)} />
              </div>
            ))}
          </div>
        )
      })()}

      {recentMatches.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-gray-500 uppercase tracking-wider">{recentMatches.length > 1 ? 'Últimos jogos' : 'Último jogo'}</span>
            <span className="text-[10px] text-gray-600 sm:hidden">{recentMatches.length > 1 ? 'deslize para o lado →' : ''}</span>
          </div>
          <div
            ref={recentRef}
            onScroll={() => {
              const el = recentRef.current
              if (!el) return
              const card = el.firstElementChild as HTMLElement | null
              const w = (card?.getBoundingClientRect().width ?? 1) + 12
              setRecentIdx(Math.round(el.scrollLeft / w))
            }}
            className="flex gap-3 overflow-x-auto snap-x snap-mandatory no-scrollbar -mx-4 px-4 pb-1 sm:grid sm:grid-cols-2 xl:grid-cols-4 sm:overflow-visible sm:mx-0 sm:px-0 sm:snap-none"
          >
            {recentMatches.map(rm => (
              <button
                key={rm.matchId}
                onClick={() => openMatchPredictions(rm.matchId, `${rm.team1.name} vs ${rm.team2.name}`, { score1: rm.score1, score2: rm.score2 }, { t1: rm.team1.id, t2: rm.team2.id })}
                className="snap-center shrink-0 w-[86%] sm:w-auto sm:snap-none text-left bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 hover:border-gray-600 rounded-lg px-4 py-2.5 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Último jogo</span>
                  <span className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400"><Icon name="eye" size={12} /> palpites</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm text-gray-300">
                  <span className="flex items-center gap-1.5 min-w-0"><Flag teamId={rm.team1.id} size={20} /><span className="truncate">{rm.team1.name}</span></span>
                  <Scoreboard score1={rm.score1} score2={rm.score2} size="sm" />
                  <span className="flex items-center gap-1.5 min-w-0"><Flag teamId={rm.team2.id} size={20} /><span className="truncate">{rm.team2.name}</span></span>
                </div>
              </button>
            ))}
          </div>
          {recentMatches.length > 1 && (
            <div className="flex justify-center gap-1.5 mt-2 sm:hidden">
              {recentMatches.map((_, i) => (
                <span key={i} className={`h-1.5 rounded-full transition-all ${i === recentIdx ? 'w-4 bg-gray-400' : 'w-1.5 bg-gray-700'}`} />
              ))}
            </div>
          )}
        </div>
      )}

      {liveMatches.length === 0 && upcoming.length > 0 && (() => {
        // Show today's + tomorrow's matches (BRT); fall back to the next few if none
        const brtDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
        const today = brtDay(new Date())
        const tomorrow = brtDay(new Date(Date.now() + 86_400_000))
        const todayAndTomorrow = upcoming.filter(m => {
          if (!m.date) return false
          const d = brtDay(new Date(m.date))
          return d === today || d === tomorrow
        })
        const filtered = todayAndTomorrow.length > 0
        const items = (filtered ? todayAndTomorrow : upcoming).slice(0, 12)
        const heading = items.length <= 1 ? 'Próximo jogo' : filtered ? 'Jogos de hoje e amanhã' : 'Próximos jogos'
        return (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-gray-500 uppercase tracking-wider">{heading}</span>
              <span className="text-[10px] text-gray-600 sm:hidden">{items.length > 1 ? 'deslize para o lado →' : ''}</span>
            </div>
            <div
              ref={carouselRef}
              onScroll={() => {
                const el = carouselRef.current
                if (!el) return
                const card = el.firstElementChild as HTMLElement | null
                const w = (card?.getBoundingClientRect().width ?? 1) + 12
                setCarouselIdx(Math.round(el.scrollLeft / w))
              }}
              className="flex gap-3 overflow-x-auto snap-x snap-mandatory no-scrollbar -mx-4 px-4 pb-1 sm:grid sm:grid-cols-2 xl:grid-cols-3 sm:overflow-visible sm:mx-0 sm:px-0 sm:snap-none"
            >
              {items.map(m => (
                <button
                  key={m.matchId}
                  onClick={() => openMatchPredictions(m.matchId, `${m.team1.name} vs ${m.team2.name}`, undefined, { t1: m.team1.id, t2: m.team2.id })}
                  className="snap-center shrink-0 w-[86%] sm:w-auto sm:snap-none bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 hover:border-gray-600 rounded-lg px-4 py-2.5 text-left transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Próximo jogo</span>
                    <span className="flex items-center gap-2">
                      {formatCountdown(m.date) && (
                        <span className="text-[10px] font-bold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-950/50 px-1.5 py-0.5 rounded tabular-nums inline-flex items-center gap-1"><Icon name="clock" size={11} /> {formatCountdown(m.date)}</span>
                      )}
                      <span className="text-xs text-green-700 dark:text-yellow-500 font-semibold">{m.dateBRT}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                    <span className="flex items-center gap-1.5 min-w-0"><Flag teamId={m.team1.id} size={18} /><span className="truncate">{m.team1.name}</span></span>
                    <span className="text-gray-600">vs</span>
                    <span className="flex items-center gap-1.5 min-w-0"><Flag teamId={m.team2.id} size={18} /><span className="truncate">{m.team2.name}</span></span>
                  </div>
                  <BroadcastBadges channels={broadcastersForMatchId(m.matchId, m.team1.id, m.team2.id, matchById[m.matchId]?.phase)} />
                </button>
              ))}
            </div>
            {items.length > 1 && (
              <div className="flex justify-center gap-1.5 mt-2 sm:hidden">
                {items.map((_, i) => (
                  <span key={i} className={`h-1.5 rounded-full transition-all ${i === carouselIdx ? 'w-4 bg-gray-400' : 'w-1.5 bg-gray-700'}`} />
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {loading && (
        <div className="rounded-xl border border-gray-800 overflow-hidden">
          <div className="skeleton h-10 w-full opacity-60" style={{ borderRadius: 0 }} />
          <div className="divide-y divide-gray-800">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="skeleton w-5 h-5 rounded-full shrink-0" />
                <div className="skeleton h-4 flex-1" style={{ maxWidth: `${50 + ((i * 7) % 35)}%` }} />
                <div className="skeleton h-4 w-8 shrink-0" />
                <div className="skeleton h-5 w-10 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && data.length === 0 && (
        <div className="flex flex-col items-center text-center py-16 px-6">
          <div className="flex items-center justify-center w-20 h-20 rounded-full bg-gray-900 border border-gray-800 mb-4">
            <Icon name="clipboard" size={36} className="text-gray-500" strokeWidth={1.4} />
          </div>
          <p className="text-gray-300 font-semibold">Nenhum participante cadastrado ainda</p>
          <p className="text-sm mt-1 text-gray-500">
            <a href="/admin" className="text-yellow-500 hover:underline font-medium">Acesse o painel admin</a> para adicionar participantes.
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
          <Icon name="bars" size={16} /> {projectionMode ? 'Ocultar Projeção' : 'Ver Projeção'}
        </button>
      )}

      {leaderboardHasLive && data.length > 0 && (
        <div ref={leaderboardRef} className="rounded-xl border-2 border-red-500/70 dark:border-red-600/60 bg-red-50/80 dark:bg-red-950/20 overflow-hidden shadow-[0_0_18px_2px_rgba(239,68,68,0.18)] dark:shadow-[0_0_24px_4px_rgba(239,68,68,0.22)] animate-live-glow">
          <div className="px-4 py-2 border-b border-red-200/60 dark:border-red-900/30 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
            <span className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider flex-1">Classificação ao vivo</span>
            <span className="text-xs text-gray-500 dark:text-gray-600">se acabasse agora</span>
          </div>
          <div className="divide-y divide-red-100 dark:divide-red-900/20">
            {data.map((entry, idx) => {
              const rank = ranks[idx]
              const tier = tierOf(entry.totalPoints)
              const p = entry as any
              const change: number | undefined = p.positionChange
              const liveGain: number = p.livePoints ?? 0
              const isMe = myId === entry.participant.id
              const first = isFirstOfRank[idx]
              return (
                <div
                  key={entry.participant.id}
                  className={`flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors ${isMe ? 'shadow-[inset_3px_0_0_0_#00bf63] bg-[#00bf63]/5' : ''}`}
                  onClick={() => openParticipant(entry.participant.id, entry.participant.name)}
                >
                  <span className="w-5 text-right shrink-0 font-bold text-sm">
                    {isRelated(entry.totalPoints)
                      ? (first ? <span className="text-red-500">{rank}</span> : null)
                      : isWarning(entry.totalPoints)
                      ? (first ? <span className="text-yellow-500">{rank}</span> : null)
                      : trophies[tier]
                      ?? (rank >= 4 && rank <= 7
                          ? (first ? <span className="text-green-600 dark:text-green-400">{rank}</span> : null)
                          : (first ? <span className="text-gray-500">{rank}</span> : null))}
                  </span>
                  {isMe && <Icon name="star" size={13} className="shrink-0 text-[#00bf63]" />}
                  <span className="text-gray-200 text-sm font-semibold flex-1 min-w-0 truncate">{entry.participant.name}</span>
                  {liveGain > 0
                    ? <span className="text-green-700 dark:text-green-400 text-xs font-bold w-9 text-right shrink-0 tabular-nums">+{liveGain}</span>
                    : <span className="text-gray-500 dark:text-gray-600 text-xs font-bold w-9 text-right shrink-0">0</span>
                  }
                  <span className="w-9 text-right shrink-0 flex items-center justify-end">
                    {change === undefined || change === 0
                      ? <span className="w-2 h-2 rounded-sm bg-gray-400 dark:bg-gray-600 inline-block" />
                      : change > 0
                        ? <span className="text-blue-700 dark:text-blue-300 text-[10px] font-bold tabular-nums inline-flex items-center"><Icon name="arrow-up" size={10} />{change}</span>
                        : <span className="text-red-700 dark:text-red-400 text-[10px] font-bold tabular-nums inline-flex items-center"><Icon name="arrow-down" size={10} />{Math.abs(change)}</span>
                    }
                  </span>
                  <span className="text-gray-200 dark:text-yellow-400 font-bold text-base shrink-0 w-10 text-right font-score"><AnimatedNumber value={entry.totalPoints} /></span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {projectionMode && data.length > 0 && (
        <div className="rounded-xl border border-purple-200 dark:border-purple-800 overflow-hidden">
          <div className="bg-purple-50 dark:bg-purple-950/60 px-4 py-2.5 border-b border-purple-200 dark:border-purple-800">
            <p className="text-xs text-purple-700 dark:text-purple-300 font-semibold uppercase tracking-wider flex items-center gap-1.5"><Icon name="bars" size={13} /> Projeção — {remainingMatches} jogos restantes</p>
            <p className="text-xs text-purple-500 mt-0.5">Máximo estimado: pts atuais + {remainingMatches} × 8 pts/jogo</p>
          </div>
          <div className="divide-y divide-purple-100 dark:divide-purple-900/40">
            {data.map((entry, idx) => {
              const p = entry as any
              const rank = ranks[idx]
              return (
                <div key={entry.participant.id} className="px-4 py-3 bg-gray-900 dark:bg-gray-950/40 flex items-center gap-3">
                  <span className="text-gray-500 text-xs w-5 text-right shrink-0">{rank}</span>
                  <span className="text-gray-200 text-sm font-semibold flex-1 min-w-0 truncate">{entry.participant.name}</span>
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
                        ? <span className="text-green-600 dark:text-green-400 text-xs font-bold inline-flex items-center gap-1">Top 7 <Icon name="check" size={12} /></span>
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
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500 shrink-0">Filtre por:</span>
            {([['all', 'Todos', ''], ['top7', 'Top 7', 'bg-[#00bf63]'], ['red', 'Pagões', 'bg-red-500']] as const).map(([val, label, dot]) => (
              <button
                key={val}
                onClick={() => setZoneFilter(val)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border font-medium transition-colors ${zoneFilter === val ? 'border-[#00bf63] text-[#00bf63] bg-[#00bf63]/10' : 'border-gray-700 text-gray-500 hover:text-gray-300'}`}
              >
                {dot && <span className={`w-2 h-2 rounded-full ${dot}`} />}
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {!loading && data.length > 0 && !leaderboardHasLive && (
        <div ref={leaderboardRef} className="rounded-xl border border-gray-800">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wider">
                <th className="pl-2 pr-1 py-3 text-center w-8">#</th>
                <th className="px-1 py-3 text-left">Participante</th>
                <th className="px-1 py-3 text-right cursor-help w-9" title="Pontuação do último jogo">UJ</th>
                <th className="px-1 py-3 text-right cursor-help w-9" title="Classificação no mata-mata: pontos de avanço do último jogo (+4/+6/+8/+10/+12)">MM</th>
                <th className="pl-1 pr-2 py-3 text-right w-12">PTS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {data.map((entry, idx) => {
                const rank = ranks[idx]
                const tier = tierOf(entry.totalPoints)
                const p = entry as any
                const flash = flashMap[entry.participant.id]
                const isMe = myId === entry.participant.id
                if (zoneFilter === 'top7' && !(rank >= 1 && rank <= 7)) return null
                if (zoneFilter === 'red' && !isRelated(entry.totalPoints)) return null
                return (
                <tr
                  key={entry.participant.id}
                  ref={el => { if (el) rowRefs.current.set(entry.participant.id, el); else rowRefs.current.delete(entry.participant.id) }}
                  onClick={() => openParticipant(entry.participant.id, entry.participant.name)}
                  style={rowsIn ? { animationDelay: `${Math.min(idx, 25) * 28}ms` } : undefined}
                  className={`cursor-pointer transition-colors ${rowsIn ? 'animate-row-in' : ''} ${
                    isRelated(entry.totalPoints) ? 'bg-red-50 hover:bg-red-100 dark:bg-red-950/50 dark:hover:bg-red-950/70' :
                    isWarning(entry.totalPoints) ? 'bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-950/20 dark:hover:bg-yellow-950/30' :
                    tier === 1 ? 'bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-950/40 dark:hover:bg-yellow-950/60' :
                    tier === 2 ? 'bg-gray-800/30 hover:bg-gray-800/60' :
                    tier === 3 ? 'bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/30 dark:hover:bg-orange-950/50' :
                    (rank >= 4 && rank <= 7) ? 'bg-green-50 hover:bg-green-100 dark:bg-green-950/40 dark:hover:bg-green-950/60' :
                    (idx % 2 === 1 ? 'bg-gray-900/40 hover:bg-gray-900/70' : 'hover:bg-gray-900/50')
                  } ${rank === 1 ? 'shadow-[inset_3px_0_0_0_#facc15]' : ''} ${isMe ? 'shadow-[inset_3px_0_0_0_#00bf63] ring-1 ring-inset ring-[#00bf63]/40' : ''} ${flash === 'up' ? 'animate-flash-up' : flash === 'down' ? 'animate-flash-down' : ''}`}
                >
                  <td className="pl-2 pr-1 py-3 text-center font-bold">
                    {isRelated(entry.totalPoints)
                      ? (isFirstOfRank[idx] ? <span className="text-red-500 text-sm">{rank}</span> : null)
                      : isWarning(entry.totalPoints)
                      ? (isFirstOfRank[idx] ? <span className="text-yellow-500 text-sm">{rank}</span> : null)
                      : trophies[tier]
                      ?? (rank >= 4 && rank <= 7
                          ? (isFirstOfRank[idx] ? <span className="text-green-600 dark:text-green-400 text-sm">{rank}</span> : null)
                          : (isFirstOfRank[idx] ? <span className="text-gray-500 text-sm">{rank}</span> : null))}
                  </td>
                  <td className={`px-1 py-3 font-semibold ${
                    isRelated(entry.totalPoints) ? 'text-red-700 dark:text-red-300' :
                    isWarning(entry.totalPoints) ? 'text-yellow-600 dark:text-yellow-400' :
                    tier === 1 ? 'text-yellow-700 dark:text-yellow-300' :
                    tier === 2 ? 'text-gray-300' :
                    tier === 3 ? 'text-amber-600' :
                    (rank >= 4 && rank <= 7) ? 'text-green-600 dark:text-green-400' :
                    ''
                  }`}>
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isMe && <Icon name="star" size={13} className="shrink-0 text-[#00bf63]" />}
                      <span className="truncate">{entry.participant.name}</span>
                      {(() => {
                        const ch: number | undefined = p.positionChange
                        if (ch === undefined || ch === 0) return null
                        return ch > 0
                          ? <span className="text-blue-600 dark:text-blue-400 text-[10px] font-bold shrink-0 tabular-nums inline-flex items-center"><Icon name="arrow-up" size={10} />{ch}</span>
                          : <span className="text-red-600 dark:text-red-400 text-[10px] font-bold shrink-0 tabular-nums inline-flex items-center"><Icon name="arrow-down" size={10} />{Math.abs(ch)}</span>
                      })()}
                    </div>
                  </td>
                  <td className="px-1 py-3 text-right relative">
                    <button
                      onClick={e => { e.stopPropagation(); setUjOpen(o => o === entry.participant.id ? null : entry.participant.id) }}
                      className="w-full text-right"
                    >
                      {entry.lastMatchPoints > 0
                        ? <span className="text-green-600 dark:text-green-400 font-semibold underline decoration-dotted underline-offset-2">+{entry.lastMatchPoints}</span>
                        : <span className="text-gray-400 dark:text-gray-500 underline decoration-dotted underline-offset-2">0</span>}
                    </button>
                    {ujOpen === entry.participant.id && (
                      <>
                        <div className="fixed inset-0 z-30" onClick={e => { e.stopPropagation(); setUjOpen(null) }} />
                        <div onClick={e => e.stopPropagation()} className="absolute right-0 top-full mt-1 z-40 w-44 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-2.5 text-left animate-fade-in">
                          <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Último jogo</p>
                          {lastMatch ? (
                            <>
                              <p className="text-xs text-gray-300 font-semibold truncate">{lastMatch.team1.name} {lastMatch.score1}×{lastMatch.score2} {lastMatch.team2.name}</p>
                              <div className="flex items-center justify-between mt-1.5 text-xs">
                                <span className="text-gray-400">Palpite: <span className="text-gray-200 font-semibold font-score">{p.lastMatchPred ? `${p.lastMatchPred.score1}×${p.lastMatchPred.score2}` : '—'}</span></span>
                                <span className={`font-bold ${entry.lastMatchPoints > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}`}>+{entry.lastMatchPoints}</span>
                              </div>
                            </>
                          ) : <p className="text-xs text-gray-500">Nenhum jogo ainda.</p>}
                        </div>
                      </>
                    )}
                  </td>
                  <td className="px-1 py-3 text-right">
                    {(() => {
                      const mm = p.lastKoRulePts ?? 0
                      return mm > 0
                        ? <span className="text-blue-600 dark:text-blue-400 font-semibold">+{mm}</span>
                        : <span className="text-gray-400 dark:text-gray-500">0</span>
                    })()}
                  </td>
                  <td className="pl-1 pr-2 py-3 text-right">
                    <span className={`font-bold text-lg font-score ${isRelated(entry.totalPoints) ? 'text-red-600 dark:text-red-400' : isWarning(entry.totalPoints) ? 'text-gray-200 dark:text-yellow-500' : 'text-gray-200 dark:text-yellow-400'}`}>
                      <AnimatedNumber value={entry.totalPoints} />
                    </span>
                  </td>
                </tr>
              )}
            )}
            </tbody>
          </table>

          <div className="px-3 py-2 border-t border-gray-800">
            <span className="text-xs text-gray-600">Toque num participante para ver os palpites</span>
          </div>
          <div className="px-4 pb-3 pt-1 text-[11px] text-gray-400 space-y-1.5 border-t border-gray-800">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <span><span className="font-bold text-gray-300">UJ</span> — pontos do último jogo</span>
              <span><span className="font-bold text-gray-300">MM</span> — avanço no mata-mata (+4/+6/+8/+10/+12)</span>
              <span><span className="font-bold text-gray-300">PTS</span> — total acumulado</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 border-t border-gray-800/60">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-yellow-500 inline-block" /> Líder</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-green-600 inline-block" /> Zona Top 7 (4º–7º)</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-yellow-600 inline-block" /> Alerta</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" /> Zona de risco</span>
            </div>
          </div>
          {lastRefresh && (
            <p className="text-center text-[10px] text-gray-600 pb-2">
              Atualizado às {lastRefresh.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      )}

      {selectedParticipant && (
        <ParticipantModal
          participantId={selectedParticipant.id}
          name={selectedParticipant.name}
          isMe={myId === selectedParticipant.id}
          onToggleMe={() => toggleMe(selectedParticipant.id)}
          onClose={() => setSelectedParticipant(null)}
        />
      )}

      {/* "Sua posição" mini-bar (mobile, when identified) */}
      {myId && !loading && !selectedParticipant && (() => {
        const meIdx = data.findIndex(e => e.participant.id === myId)
        if (meIdx < 0) return null
        const me = data[meIdx] as any
        const rank = ranks[meIdx]
        const gapUp = meIdx > 0 ? data[meIdx - 1].totalPoints - me.totalPoints : 0
        const mm = me.lastKoRulePts ?? 0
        return (
          <button
            onClick={() => openParticipant(me.participant.id, me.participant.name)}
            className="sm:hidden fixed inset-x-3 z-30 bottom-[80px] flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gray-900/95 backdrop-blur-md border border-[#00bf63]/40 shadow-lg shadow-black/40"
            style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
          >
            <Icon name="star" size={14} className="text-[#00bf63] shrink-0" />
            <span className="text-xs font-bold text-gray-200 shrink-0">{rank}º</span>
            <span className="text-xs text-gray-400 truncate flex-1 text-left">{me.participant.name}</span>
            {mm > 0 && <span className="text-[10px] font-bold text-blue-400 shrink-0">MM +{mm}</span>}
            {rank > 1 && gapUp > 0 && <span className="text-[10px] text-gray-500 shrink-0">−{gapUp} p/ {rank - 1}º</span>}
            <span className="font-score font-bold text-yellow-400 text-sm shrink-0">{me.totalPoints}</span>
          </button>
        )
      })()}

      {/* Scroll to top */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Voltar ao topo"
          className="fixed right-4 bottom-[132px] sm:bottom-6 z-30 w-11 h-11 flex items-center justify-center rounded-full bg-gray-800/90 backdrop-blur border border-gray-700 text-gray-200 shadow-lg active:scale-95 transition-transform"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
        </button>
      )}

      <Onboarding />

      {/* Resumo da rodada — popup, uma vez por rodada */}
      {!loading && !leaderboardHasLive && lastMatch && data.length > 0 && roundDismissed !== lastMatch.matchId && !selectedParticipant && !matchModal && (() => {
        // Who predicted the exact score of the last match
        const exactScorers = (data as any[]).filter(e => {
          const pred = e.lastMatchPred
          return pred && pred.score1 === lastMatch.score1 && pred.score2 === lastMatch.score2
        })
        const climber = [...data].map(e => e as any).filter(e => (e.positionChange ?? 0) > 0).sort((a, b) => b.positionChange - a.positionChange)[0]
        const faller = [...data].map(e => e as any).filter(e => (e.positionChange ?? 0) < 0).sort((a, b) => a.positionChange - b.positionChange)[0]
        if (!climber && exactScorers.length === 0) return null
        return (
          <div className="fixed inset-0 z-[55] flex items-center justify-center p-5" onClick={() => dismissRound(lastMatch.matchId)}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" />
            <div className="relative w-full max-w-sm bg-gray-950 border border-gray-800 rounded-2xl p-5 animate-slide-up" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-1">
                <span className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-gray-300"><Icon name="clipboard" size={16} /> Resumo da rodada</span>
                <button onClick={() => dismissRound(lastMatch.matchId)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white" aria-label="Fechar"><Icon name="x" size={16} /></button>
              </div>
              <p className="text-xs text-gray-500 mb-4 flex items-center gap-1.5">
                <Flag teamId={lastMatch.team1.id} size={16} /> {lastMatch.team1.name} <span className="font-score text-gray-300">{lastMatch.score1}×{lastMatch.score2}</span> <Flag teamId={lastMatch.team2.id} size={16} /> {lastMatch.team2.name}
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5">
                  <Icon name="target" size={22} className={exactScorers.length > 0 ? 'text-green-400 shrink-0' : 'text-gray-600 shrink-0'} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-wide text-gray-500">Placar exato</p>
                    {exactScorers.length === 0 && (
                      <p className="text-sm text-gray-500 italic">Ninguém acertou</p>
                    )}
                    {exactScorers.length === 1 && (
                      <p className="text-sm text-gray-200 font-bold truncate">{exactScorers[0].participant.name}</p>
                    )}
                    {exactScorers.length > 1 && (
                      <>
                        <p className="text-sm text-gray-200 font-bold">{exactScorers.length} participantes</p>
                        <p className="text-[10px] text-gray-500 truncate">{exactScorers.map((e: any) => e.participant.name).join(', ')}</p>
                      </>
                    )}
                  </div>
                  {exactScorers.length > 0 && (
                    <span className="text-green-400 font-score font-bold text-sm shrink-0">{lastMatch.score1}–{lastMatch.score2}</span>
                  )}
                </div>
                {climber && (
                  <div className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5">
                    <Icon name="arrow-up" size={22} className="text-blue-400 shrink-0" />
                    <div className="min-w-0 flex-1"><p className="text-[10px] uppercase tracking-wide text-gray-500">Maior subida</p><p className="text-sm text-gray-200 font-bold truncate">{climber.participant.name}</p></div>
                    <span className="text-blue-400 font-score font-bold text-lg shrink-0 inline-flex items-center"><Icon name="arrow-up" size={16} />{climber.positionChange}</span>
                  </div>
                )}
                {faller && (
                  <div className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5">
                    <Icon name="arrow-down" size={22} className="text-red-400 shrink-0" />
                    <div className="min-w-0 flex-1"><p className="text-[10px] uppercase tracking-wide text-gray-500">Maior queda</p><p className="text-sm text-gray-200 font-bold truncate">{faller.participant.name}</p></div>
                    <span className="text-red-400 font-score font-bold text-lg shrink-0 inline-flex items-center"><Icon name="arrow-down" size={16} />{Math.abs(faller.positionChange)}</span>
                  </div>
                )}
              </div>
              <button onClick={() => dismissRound(lastMatch.matchId)} className="mt-4 w-full py-2.5 rounded-xl bg-[#00bf63] hover:bg-[#00a854] text-white font-semibold text-sm transition-colors">
                Entendi
              </button>
            </div>
          </div>
        )
      })()}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8">
        {([
          { label: 'Resultado certo', pts: '4 pts', icon: 'check' },
          { label: 'Placar exato', pts: '+2 pts', icon: 'target' },
          { label: 'Gols de um time', pts: '1 pt/time', icon: 'ball' },
          { label: 'Acertar gols do vencedor (≥ 4 gols)', pts: '+2 pts', icon: 'flame' },
        ] as { label: string; pts: string; icon: IconName }[]).map(item => (
          <div key={item.label} className="bg-gray-900 rounded-lg p-3 text-center border border-gray-800">
            <div className="flex justify-center mb-1.5"><Icon name={item.icon} size={22} className="text-[#00bf63]" /></div>
            <div className="text-xs text-gray-400">{item.label}</div>
            <div className="text-green-600 dark:text-green-400 font-bold text-sm">{item.pts}</div>
          </div>
        ))}
      </div>

      <div className="text-center text-xs text-gray-600 mt-4">
        Classificação atualizada em tempo real conforme resultados são lançados
      </div>

      {matchModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ touchAction: 'none' }} onClick={() => setMatchModal(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full sm:max-w-2xl bg-gray-900 border border-gray-700 rounded-t-3xl sm:rounded-2xl max-h-[92vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-2 shrink-0">
              <div className="min-w-0">
                <h3 className="font-bold text-gray-200 text-base flex items-center gap-1.5 flex-wrap">
                  {matchModal.t1 && <Flag teamId={matchModal.t1} size={20} />}
                  <span>{matchModal.label.split(' vs ')[0]}</span>
                  <span className="text-gray-500 font-normal text-sm">vs</span>
                  {matchModal.t2 && <Flag teamId={matchModal.t2} size={20} />}
                  <span>{matchModal.label.split(' vs ')[1]}</span>
                </h3>
                {matchResult && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wide">Resultado</span>
                    <Scoreboard score1={matchResult.score1} score2={matchResult.score2} size="sm" />
                  </div>
                )}
              </div>
              <button onClick={() => setMatchModal(null)} className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white text-base transition-colors"><Icon name="x" size={16} /></button>
            </div>

            {matchPredLoading ? (
              <p className="text-center text-gray-500 py-6">Carregando palpites...</p>
            ) : matchPredictions.length === 0 ? (
              <p className="text-center text-gray-500 py-6">Nenhum palpite registrado ainda.</p>
            ) : (
              <>
                <div className="flex-1 min-h-0 overflow-y-auto px-4 divide-y divide-gray-800">
                  {(() => {
                    const total = matchPredictions.length
                    return Object.entries(
                      matchPredictions.reduce<Record<string, string[]>>((acc, p) => {
                        const key = `${p.score1}×${p.score2}`
                        acc[key] = [...(acc[key] ?? []), p.name]
                        return acc
                      }, {})
                    )
                      .sort((a, b) => b[1].length - a[1].length)
                      .map(([score, names]) => {
                        const isExact = matchResult ? score === `${matchResult.score1}×${matchResult.score2}` : false
                        const pct = Math.round((names.length / total) * 100)
                        return (
                          <div key={score} className={`py-1.5 px-2 -mx-2 rounded ${isExact ? 'bg-green-100 dark:bg-green-950/40' : ''}`}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex flex-wrap gap-0.5 flex-1">
                                {names.sort().map(name => (
                                  <span key={name} title={name} className={`text-[10px] leading-tight rounded px-1 py-px ${isExact ? 'bg-green-200 text-green-800 dark:bg-green-900/60 dark:text-green-200 font-semibold' : 'bg-gray-800 text-gray-300'}`}>{chipCode(name)}</span>
                                ))}
                              </div>
                              <div className="shrink-0 text-right flex items-baseline gap-1.5">
                                <span className={`text-[13px] font-bold flex items-center gap-1 ${isExact ? 'text-green-700 dark:text-green-300' : 'text-green-400'}`}>
                                  {isExact && <Icon name="target" size={12} className="shrink-0" />}{score}
                                </span>
                                <span className="text-[9px] text-gray-500 whitespace-nowrap">{names.length}/{total} · {pct}%</span>
                              </div>
                            </div>
                          </div>
                        )
                      })
                  })()}
                </div>
                <div className="shrink-0 px-4 py-3 border-t border-gray-800 bg-gray-900">
                <button
                  onClick={() => shareMatchPredictions(matchModal.label.split(' vs ')[0], matchModal.label.split(' vs ')[1], '')}
                  className="w-full flex items-center justify-center gap-2 bg-[#00bf63] hover:bg-[#00a854] text-[white] py-2.5 rounded-xl font-semibold text-sm transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Compartilhar palpites
                </button>
                </div>
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
