'use client'

import { useEffect, useRef, useState } from 'react'
import { Flag } from '@/components/Flag'
import { PHASE_LABELS, Phase } from '@/lib/types'
import { AnimatedNumber } from '@/components/AnimatedNumber'
import { Icon } from '@/components/Icon'

type TeamRef = { id: string; name: string; flag: string }

type PredEntry = {
  matchId: string
  matchNumber: number
  phase: Phase
  groupId?: string
  team1: TeamRef
  team2: TeamRef
  date: string | null
  dateBRT: string | null
  prediction: { score1: number; score2: number } | null
  result: { score1: number; score2: number } | null
  points?: number
  correctResult?: boolean
  correctScore?: boolean
  correctGoals?: [boolean, boolean]
}

type GroupDetail = {
  groupId: string
  predicted: TeamRef[]
  actual: TeamRef[]
  correct: boolean
  pts: number
}

type R32Entry = {
  teamId: string
  name: string
  flag: string
  groupId: string
  pts: number
  via3rd?: boolean
}

type GroupPredRow = {
  groupId: string
  predicted: TeamRef[]
  actual: TeamRef[] | null
  complete: boolean
  r32Qualified: boolean[]
}

type ParticipantData = {
  participant: { id: string; name: string }
  predictions: PredEntry[]
  summary: {
    totalPoints: number
    matchPoints: number
    correctResults: number
    correctScores: number
    matchesPlayed: number
    groupOrderPoints: number
    r32Points: number
    thirdPlacePoints: number
    advancementPoints: number
    championPoints: number
    phasePoints: number
    rank: number | null
    totalParticipants: number
  }
  groupDetail: GroupDetail[]
  r32Detail: R32Entry[]
  advancementDetail: Record<string, { points: number; pointsEach: number; teams: TeamRef[] }>
  championTeam: TeamRef | null
  groupPredictions: GroupPredRow[]
}

// Team chip that shows "a definir" while the knockout slot isn't decided yet
function TeamMini({ id }: { id: string }) {
  if (id === 'TBD') {
    return (
      <span className="flex items-center gap-1.5 text-gray-500">
        <span className="inline-flex items-center justify-center w-5 h-[14px] rounded-sm bg-gray-800 border border-gray-700 text-[9px]">?</span>
        <span className="text-xs italic">a definir</span>
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1.5">
      <Flag teamId={id} size={20} />
      <span className="text-gray-300 font-semibold">{id}</span>
    </span>
  )
}

type Props = { participantId: string; name: string; isMe?: boolean; onToggleMe?: () => void; onClose: () => void }

export function ParticipantModal({ participantId, name, isMe, onToggleMe, onClose }: Props) {
  const [data, setData] = useState<ParticipantData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'played' | 'selecoes' | 'upcoming'>('played')
  const [sharingCard, setSharingCard] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const [dragY, setDragY] = useState(0)
  const [resetting, setResetting] = useState(false)
  const [closing, setClosing] = useState(false)
  const [slideDir, setSlideDir] = useState<'l' | 'r'>('r')
  const tabRef = useRef(tab)
  useEffect(() => { tabRef.current = tab }, [tab])

  useEffect(() => {
    fetch(`/api/participante/${participantId}`)
      .then(r => r.json())
      .then(d => {
        setData(d)
        setLoading(false)
        requestAnimationFrame(() => {
          if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        })
      })
      .catch(() => setLoading(false))
  }, [participantId])

  useEffect(() => {
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
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const TAB_ORDER = ['played', 'selecoes', 'upcoming'] as const
  function switchTab(t: typeof TAB_ORDER[number]) {
    if (t === tabRef.current) return
    setSlideDir(TAB_ORDER.indexOf(t) > TAB_ORDER.indexOf(tabRef.current) ? 'r' : 'l')
    setTab(t)
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = t === 'played' ? scrollRef.current.scrollHeight : 0
    })
  }
  function goTab(dir: 1 | -1) {
    const i = TAB_ORDER.indexOf(tabRef.current)
    const ni = i + dir
    if (ni >= 0 && ni < TAB_ORDER.length) switchTab(TAB_ORDER[ni])
  }
  // Slide the sheet down and out, then unmount
  function closeSheet() {
    setClosing(true)
    setResetting(true)
    setDragY(typeof window !== 'undefined' ? window.innerHeight : 900)
    setTimeout(onClose, 230)
  }

  // Generate and share a clean image card with this participant's numbers
  async function shareCard() {
    if (!data || sharingCard) return
    setSharingCard(true)
    try {
      const s = data.summary
      const pct = s.matchesPlayed > 0 ? Math.round((s.correctResults / s.matchesPlayed) * 100) : 0
      const DPR = 3, W = 460, H = 300
      const canvas = document.createElement('canvas')
      canvas.width = W * DPR; canvas.height = H * DPR
      const ctx = canvas.getContext('2d')!
      ctx.scale(DPR, DPR)
      // Background
      const bg = ctx.createLinearGradient(0, 0, W, H)
      bg.addColorStop(0, '#0b1220'); bg.addColorStop(1, '#05070d')
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = '#00bf63'; ctx.fillRect(0, 0, W, 5)
      // Header
      ctx.fillStyle = '#9ca3af'; ctx.font = '600 12px system-ui'; ctx.textAlign = 'left'
      ctx.fillText('BOLÃO COPA 2026', 22, 30)
      // Rank + name
      ctx.fillStyle = '#facc15'; ctx.font = '800 40px system-ui'
      const rankTxt = s.rank != null ? `${s.rank}º` : '—'
      ctx.fillText(rankTxt, 22, 78)
      ctx.fillStyle = '#ffffff'; ctx.font = '700 22px system-ui'
      let nm = name
      while (ctx.measureText(nm).width > W - 120 && nm.length > 3) nm = nm.slice(0, -1)
      if (nm !== name) nm = nm.trimEnd() + '…'
      ctx.fillText(nm, 92, 72)
      if (s.totalParticipants) { ctx.fillStyle = '#6b7280'; ctx.font = '500 12px system-ui'; ctx.fillText(`de ${s.totalParticipants} participantes`, 92, 90) }
      // Big points
      ctx.textAlign = 'right'
      ctx.fillStyle = '#facc15'; ctx.font = '800 54px system-ui'; ctx.fillText(String(s.totalPoints), W - 22, 84)
      ctx.fillStyle = '#6b7280'; ctx.font = '600 12px system-ui'; ctx.fillText('PONTOS', W - 22, 102)
      // Stats grid
      const stats: [string, string, string][] = [
        [String(s.correctResults), 'resultados', '#34d399'],
        [String(s.correctScores), 'placares', '#fbbf24'],
        [`${pct}%`, 'aproveit.', '#60a5fa'],
        [`+${s.phasePoints}`, 'bônus', '#d1d5db'],
      ]
      const gx = 22, gy = 150, gw = (W - 44) / 4
      stats.forEach(([val, lbl, color], i) => {
        const cx = gx + gw * i + gw / 2
        ctx.textAlign = 'center'
        ctx.fillStyle = '#111a2b'; ctx.fillRect(gx + gw * i + 4, gy, gw - 8, 78)
        ctx.fillStyle = color; ctx.font = '800 26px system-ui'; ctx.fillText(val, cx, gy + 38)
        ctx.fillStyle = '#9ca3af'; ctx.font = '500 11px system-ui'; ctx.fillText(lbl, cx, gy + 60)
      })
      // Footer
      ctx.textAlign = 'center'; ctx.fillStyle = '#4b5563'; ctx.font = '500 11px system-ui'
      ctx.fillText('Classificação do Bolão da Copa do Mundo 2026', W / 2, H - 18)

      const blob: Blob | null = await new Promise(res => canvas.toBlob(res, 'image/png'))
      if (!blob) throw new Error('falha')
      const file = new File([blob], 'meu-bolao.png', { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${name} — Bolão Copa 2026` })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = 'meu-bolao.png'; a.click()
        URL.revokeObjectURL(url)
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') alert('Erro ao gerar imagem: ' + (err?.message ?? err))
    } finally {
      setSharingCard(false)
    }
  }

  // Touch gestures: swipe down (from top) to close, swipe left/right to change tabs
  useEffect(() => {
    const el = sheetRef.current
    if (!el) return
    let sx = 0, sy = 0, mode: 'none' | 'v' | 'h' | 'scroll' = 'none', st = 0
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0]; sx = t.clientX; sy = t.clientY; mode = 'none'
      st = scrollRef.current?.scrollTop ?? 0
    }
    const onMove = (e: TouchEvent) => {
      const t = e.touches[0]
      const dx = t.clientX - sx, dy = t.clientY - sy
      if (mode === 'none') {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
        if (Math.abs(dx) > Math.abs(dy)) mode = 'h'
        else if (dy > 0 && st <= 0) mode = 'v'
        else mode = 'scroll'
        if (mode === 'v' || mode === 'h') setResetting(false)
      }
      if (mode === 'v') { e.preventDefault(); setDragY(Math.max(0, dy)) }
      else if (mode === 'h') { e.preventDefault() }
    }
    const onEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0]
      const dx = t.clientX - sx, dy = t.clientY - sy
      const vy = dy // simple velocity proxy via distance
      const m = mode; mode = 'none'
      if (m === 'v') {
        if (dy > 90 || vy > 130) { closeSheet(); return }
        setResetting(true); setDragY(0); setTimeout(() => setResetting(false), 280)
      } else if (m === 'h') {
        if (dx <= -45) goTab(1)
        else if (dx >= 45) goTab(-1)
      }
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const played = data?.predictions.filter(p => p.result !== null) ?? []
  const upcoming = (data?.predictions.filter(p => p.result === null && p.prediction !== null) ?? [])
    .slice()
    .sort((a, b) => {
      if (a.date && !b.date) return -1
      if (!a.date && b.date) return 1
      if (a.date && b.date && a.date !== b.date) return a.date < b.date ? -1 : 1
      return a.matchNumber - b.matchNumber
    })

  function rowColor(p: PredEntry) {
    if (!p.result) return ''
    if (p.correctScore) return 'bg-green-100 dark:bg-green-950/50 border-l-2 border-green-500'
    if (p.correctResult) return 'bg-blue-100 dark:bg-blue-950/30 border-l-2 border-blue-500 dark:border-blue-700'
    return 'border-l-2 border-transparent'
  }

  const hasPhaseBonus = (data?.summary.phasePoints ?? 0) > 0
  const hasGroupDetail = (data?.groupDetail.length ?? 0) > 0
  const hasR32Detail = (data?.r32Detail.length ?? 0) > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={closeSheet}
      style={{ touchAction: 'none' }}
    >
      {/* Backdrop — fades as the sheet is dragged down */}
      <div
        className={`absolute inset-0 bg-black/70 backdrop-blur-sm ${dragY > 0 || closing ? '' : 'animate-fade-in'}`}
        style={{
          opacity: dragY > 0 || closing ? Math.max(0, 1 - dragY / 520) : undefined,
          transition: resetting ? 'opacity 0.28s ease' : undefined,
        }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="relative bg-gray-950 border border-gray-800 border-b-0 rounded-t-2xl w-full max-w-2xl flex flex-col animate-slide-up"
        style={{
          maxHeight: '82vh', paddingBottom: 'env(safe-area-inset-bottom)', touchAction: 'pan-y',
          transform: (dragY > 0 || resetting) ? `translateY(${dragY}px)` : undefined,
          transition: resetting ? 'transform 0.34s cubic-bezier(0.22, 1, 0.36, 1)' : undefined,
          willChange: 'transform',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-700" />
        </div>

        {/* Header */}
        <div className="px-5 py-3 border-b border-gray-800 shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-3">
              {data?.summary.rank != null && (
                <span className={`shrink-0 flex flex-col items-center justify-center w-11 h-11 rounded-xl font-score leading-none ${
                  data.summary.rank === 1 ? 'bg-yellow-400/20 text-yellow-400 border border-yellow-500/40' :
                  data.summary.rank <= 3 ? 'bg-gray-400/15 text-gray-200 border border-gray-500/40' :
                  data.summary.rank <= 7 ? 'bg-green-500/15 text-green-400 border border-green-600/40' :
                  'bg-gray-800 text-gray-400 border border-gray-700'
                }`}>
                  <span className="text-[9px] text-gray-500 -mb-0.5">POS</span>
                  <span className="text-lg font-bold">{data.summary.rank}</span>
                </span>
              )}
              <h2 className="text-lg font-bold text-white truncate">{name}</h2>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {data && (
                <button
                  onClick={shareCard}
                  disabled={sharingCard}
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors disabled:opacity-50"
                  title="Compartilhar card"
                  aria-label="Compartilhar"
                >
                  {sharingCard
                    ? <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                    : <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>}
                </button>
              )}
              {onToggleMe && (
                <button
                  onClick={onToggleMe}
                  className={`flex items-center gap-1 h-9 px-2.5 rounded-full text-xs font-semibold transition-colors ${isMe ? 'bg-[#00bf63] text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'}`}
                  title={isMe ? 'Você marcou como sendo você' : 'Marcar como você'}
                >
                  <><Icon name={isMe ? 'star' : 'star-outline'} size={13} /> Sou eu</>
                </button>
              )}
              <button
                onClick={closeSheet}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xl font-bold transition-colors"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
          </div>

          {data && (() => {
            const pct = data.summary.matchesPlayed > 0
              ? Math.round((data.summary.correctResults / data.summary.matchesPlayed) * 100)
              : 0
            return (
              <div className="mt-3 space-y-2.5">
                {/* Summary cards */}
                <div className="grid grid-cols-4 gap-2">
                  <div className="rounded-lg bg-gray-900 border border-gray-800 px-2 py-1.5 text-center">
                    <div className="text-yellow-600 dark:text-yellow-400 font-score font-bold text-xl leading-none"><AnimatedNumber value={data.summary.totalPoints} /></div>
                    <div className="text-[9px] text-gray-500 uppercase tracking-wide mt-1">Pontos</div>
                  </div>
                  <div className="rounded-lg bg-gray-900 border border-gray-800 px-2 py-1.5 text-center">
                    <div className="text-green-700 dark:text-green-400 font-score font-bold text-xl leading-none">{data.summary.correctResults}</div>
                    <div className="text-[9px] text-gray-500 uppercase tracking-wide mt-1">Result.</div>
                  </div>
                  <div className="rounded-lg bg-gray-900 border border-gray-800 px-2 py-1.5 text-center">
                    <div className="text-yellow-700 dark:text-yellow-300 font-score font-bold text-xl leading-none">{data.summary.correctScores}</div>
                    <div className="text-[9px] text-gray-500 uppercase tracking-wide mt-1">Placares</div>
                  </div>
                  <div className="rounded-lg bg-gray-900 border border-gray-800 px-2 py-1.5 text-center">
                    <div className="text-gray-300 font-score font-bold text-xl leading-none">+{data.summary.phasePoints}</div>
                    <div className="text-[9px] text-gray-500 uppercase tracking-wide mt-1">Bônus</div>
                  </div>
                </div>
                {/* Accuracy bar */}
                {data.summary.matchesPlayed > 0 && (
                  <div>
                    <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
                      <span>Aproveitamento (resultados certos)</span>
                      <span className="font-semibold text-gray-300">{pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${pct >= 60 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })()}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800 shrink-0">
          <button
            onClick={() => switchTab('played')}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${tab === 'played' ? 'text-yellow-600 dark:text-yellow-400 border-b-2 border-yellow-600 dark:border-yellow-400' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Jogados ({played.length})
          </button>
          <button
            onClick={() => switchTab('selecoes')}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${tab === 'selecoes' ? 'text-yellow-600 dark:text-yellow-400 border-b-2 border-yellow-600 dark:border-yellow-400' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Seleções
          </button>
          <button
            onClick={() => switchTab('upcoming')}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${tab === 'upcoming' ? 'text-yellow-600 dark:text-yellow-400 border-b-2 border-yellow-600 dark:border-yellow-400' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Próximos ({upcoming.length})
          </button>
        </div>

        {/* Body */}
        <div ref={scrollRef} className="overflow-y-auto flex-1 px-1">
          {loading && (
            <div className="divide-y divide-gray-800/60">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-2 px-3 py-3">
                  <div className="skeleton h-4 w-28" />
                  <div className="flex items-center gap-2">
                    <div className="skeleton h-5 w-12" />
                    <div className="skeleton h-4 w-6" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && tab === 'played' && (
            <div key={`played-${slideDir}`} className={`divide-y divide-gray-800/60 ${slideDir === 'r' ? 'animate-tab-in-right' : 'animate-tab-in-left'}`}>
              {played.length === 0 && <p className="text-center py-10 text-gray-600">Nenhum jogo disputado ainda.</p>}
              {played.map(p => (
                <div key={p.matchId} className={`px-3 py-2.5 ${rowColor(p)}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-sm min-w-0 shrink-0">
                      <Flag teamId={p.team1.id} size={20} />
                      <span className="text-gray-300 font-semibold">{p.team1.id}</span>
                      <span className="text-gray-600 mx-0.5">×</span>
                      <Flag teamId={p.team2.id} size={20} />
                      <span className="text-gray-300 font-semibold">{p.team2.id}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 text-xs">
                      <span className="text-gray-500 font-score">{p.result!.score1}–{p.result!.score2}</span>
                      <span className={`font-bold px-2 py-0.5 rounded ${
                        p.correctScore ? 'text-green-800 bg-green-200 dark:text-green-300 dark:bg-green-950' :
                        p.correctResult ? 'text-blue-800 bg-blue-200 dark:text-blue-300 dark:bg-blue-950/50' :
                        'text-gray-400 bg-gray-800'
                      }`}>
                        {p.prediction ? `${p.prediction.score1}–${p.prediction.score2}` : '—'}
                      </span>
                      <span className={`w-8 text-right font-bold ${(p.points ?? 0) > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-600'}`}>
                        {p.points !== undefined ? `+${p.points}` : '—'}
                      </span>
                    </div>
                  </div>
                  {p.correctScore && <p className="text-[10px] text-green-700 dark:text-green-400 mt-0.5 pl-0.5"><Icon name="target" size={11} className="inline -mt-0.5 mr-0.5" /> Placar exato!</p>}
                  {!p.correctScore && p.correctResult && <p className="text-[10px] text-blue-700 dark:text-blue-400 mt-0.5 pl-0.5"><Icon name="check" size={11} className="inline -mt-0.5 mr-0.5" /> Resultado certo</p>}
                  {!p.correctResult && p.result && <p className="text-[10px] text-red-600 dark:text-red-500 mt-0.5 pl-0.5"><Icon name="x" size={11} className="inline -mt-0.5 mr-0.5" /> Errou</p>}
                </div>
              ))}

              {/* Group order bonus section */}
              {hasGroupDetail && (
                <div className="px-3 pt-4 pb-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide"><Icon name="bars" size={13} /> Ordem dos Grupos</span>
                    <span className="text-xs font-bold text-gray-300">+{data!.summary.groupOrderPoints} pts</span>
                  </div>
                  <div className="space-y-1.5">
                    {data!.groupDetail.map(g => (
                      <div key={g.groupId} className="rounded-lg px-3 py-2 text-xs bg-gray-900 border border-gray-800">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-gray-400">Grupo {g.groupId}</span>
                          <span className={`font-bold ${g.correct ? 'text-green-400' : 'text-red-500'}`}>
                            {g.correct ? <span className="flex items-center gap-0.5"><Icon name="check" size={12} /> +2</span> : <span className="flex items-center gap-0.5"><Icon name="x" size={12} /> 0</span>}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-1 text-[10px]">
                          <div>
                            <p className="text-gray-600 mb-0.5">Seu palpite</p>
                            <div className="flex gap-1.5 flex-wrap">
                              {g.predicted.map((t, i) => (
                                <span key={t.id} className={`flex items-center gap-0.5 ${i < 2 ? 'text-gray-300' : 'text-gray-500'}`}>
                                  {i + 1}º <Flag teamId={t.id} size={14} />
                                </span>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-gray-600 mb-0.5">Real</p>
                            <div className="flex gap-1.5 flex-wrap">
                              {g.actual.map((t, i) => (
                                <span key={t.id} className={`flex items-center gap-0.5 ${i < 2 ? 'text-gray-300' : 'text-gray-500'}`}>
                                  {i + 1}º <Flag teamId={t.id} size={14} />
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* R32 advancement bonus section */}
              {hasR32Detail && (
                <div className="px-3 pt-3 pb-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide"><Icon name="trophy" size={13} /> Classificados para 16-avos</span>
                    <span className="text-xs font-bold text-gray-300">+{data!.summary.r32Points} pts</span>
                  </div>
                  {data!.summary.thirdPlacePoints > 0 && (
                    <div className="flex items-center justify-between rounded-lg bg-amber-100 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-900/50 px-3 py-1.5">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-300"><Icon name="medal" size={13} /> Classificados como melhor 3º lugar</span>
                      <span className="text-xs font-bold text-amber-800 dark:text-amber-300">+{data!.summary.thirdPlacePoints} pts</span>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {data!.r32Detail.map(t => (
                      <div key={`${t.groupId}-${t.teamId}`} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs border ${t.via3rd ? 'bg-amber-100 dark:bg-amber-950/30 border-amber-300 dark:border-amber-900/50' : 'bg-gray-900 border-gray-800'}`}>
                        <Flag teamId={t.teamId} size={16} />
                        <span className={`font-medium ${t.via3rd ? 'text-amber-800 dark:text-amber-200' : 'text-gray-300'}`}>{t.name}</span>
                        {t.via3rd && <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold">3º</span>}
                        <span className={`font-bold ml-1 ${t.via3rd ? 'text-amber-800 dark:text-amber-300' : 'text-gray-400'}`}>+3</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Knockout advancement bonus (oitavas / quartas / semi / final) */}
              {([
                ['round_of_16', 'Oitavas de Final', 'swords'],
                ['quarterfinal', 'Quartas de Final', 'flame'],
                ['semifinal', 'Semifinal', 'zap'],
                ['final', 'Final', 'trophy'],
              ] as const).map(([key, label, icon]) => {
                const d = data?.advancementDetail?.[key]
                if (!d || d.teams.length === 0) return null
                return (
                  <div key={key} className="px-3 pt-3 pb-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide"><Icon name={icon} size={13} /> {label}</span>
                      <span className="text-xs font-bold text-gray-300">+{d.points} pts</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {d.teams.map(t => (
                        <div key={t.id} className="flex items-center gap-1.5 bg-gray-900 border border-gray-800 rounded-lg px-2.5 py-1.5 text-xs">
                          <Flag teamId={t.id} size={16} />
                          <span className="text-gray-300 font-medium">{t.name}</span>
                          <span className="text-gray-400 font-bold ml-1">+{d.pointsEach}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}

              {/* Champion bonus (+12) */}
              {data && data.summary.championPoints > 0 && data.championTeam && (
                <div className="px-3 pt-3 pb-4">
                  <div className="flex items-center justify-between rounded-lg bg-yellow-100 dark:bg-yellow-950/30 border border-yellow-300 dark:border-yellow-900/50 px-3 py-2">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-yellow-800 dark:text-yellow-300"><Icon name="crown" size={14} /> Campeão — <Flag teamId={data.championTeam.id} size={16} /> {data.championTeam.name}</span>
                    <span className="text-xs font-bold text-yellow-800 dark:text-yellow-300">+{data.summary.championPoints} pts</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {!loading && tab === 'selecoes' && (
            <div key={`selecoes-${slideDir}`} className={`p-3 space-y-3 ${slideDir === 'r' ? 'animate-tab-in-right' : 'animate-tab-in-left'}`}>
              {(!data?.groupPredictions?.length) && (
                <p className="text-center py-10 text-gray-600">Sem palpites de classificação registrados.</p>
              )}
              {/* Summary */}
              {data && (
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-900 border border-gray-800">
                  <span className="text-xs text-gray-400">Bônus classificação 16-avos</span>
                  <span className="text-sm font-bold text-yellow-400">+{data.summary.r32Points} pts</span>
                </div>
              )}
              {data?.groupPredictions?.map(g => {
                const picks = g.predicted.slice(0, 3)
                if (picks.length === 0) return null
                return (
                  <div key={g.groupId} className="rounded-lg border border-gray-800 bg-gray-900 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800/50">
                      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Grupo {g.groupId}</span>
                      {!g.complete && <span className="text-[9px] font-semibold uppercase text-amber-700 bg-amber-200 dark:text-amber-400 dark:bg-amber-500/10 px-1.5 py-0.5 rounded">em jogo</span>}
                    </div>
                    <div className="flex flex-col divide-y divide-gray-800/40">
                      {picks.map((team, i) => {
                        const qualified = g.r32Qualified[i]
                        const posLabel = ['1º', '2º', '3º'][i]
                        const posColor = i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : 'text-amber-600'
                        return (
                          <div key={team.id} className={`flex items-center gap-2.5 px-3 py-2 ${qualified ? 'bg-green-50 dark:bg-green-950/20' : ''}`}>
                            <span className={`text-[11px] font-bold w-5 shrink-0 ${posColor}`}>{posLabel}</span>
                            <Flag teamId={team.id} size={22} />
                            <span className={`text-sm font-semibold flex-1 ${qualified ? 'text-green-700 dark:text-green-300' : g.complete ? 'text-gray-500' : 'text-gray-300'}`}>
                              {team.name}
                            </span>
                            {qualified
                              ? <span className="text-xs font-bold text-green-800 bg-green-200 dark:text-green-400 dark:bg-green-900/40 px-2 py-0.5 rounded font-score">+3 pts</span>
                              : g.complete
                              ? <span className="text-gray-600"><Icon name="x" size={12} /></span>
                              : null}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {!loading && tab === 'upcoming' && (
            <div key={`upcoming-${slideDir}`} className={`divide-y divide-gray-800/60 ${slideDir === 'r' ? 'animate-tab-in-right' : 'animate-tab-in-left'}`}>
              {upcoming.length === 0 && <p className="text-center py-10 text-gray-600">Sem palpites futuros registrados.</p>}
              {upcoming.map(p => (
                <div key={p.matchId} className="px-3 py-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-sm min-w-0 shrink-0">
                    <TeamMini id={p.team1.id} />
                    <span className="text-gray-600 mx-0.5">×</span>
                    <TeamMini id={p.team2.id} />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {p.dateBRT && <span className="text-xs text-gray-600">{p.dateBRT}</span>}
                    <span className="font-bold text-yellow-800 bg-yellow-200 dark:text-yellow-400 dark:bg-yellow-950/40 text-xs px-2 py-0.5 rounded font-score">
                      {p.prediction ? `${p.prediction.score1}–${p.prediction.score2}` : '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-800 px-5 py-3 shrink-0 space-y-2">
          <div className="flex gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500 inline-block" /> Placar exato</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-700 inline-block" /> Resultado certo</span>
            <span>Resultado | Palpite | Pts</span>
          </div>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-semibold text-sm transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
