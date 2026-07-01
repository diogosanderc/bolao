'use client'

type Props = {
  score1?: number
  score2?: number
  /** show 'vs' when scores are absent */
  pending?: boolean
  size?: 'sm' | 'md' | 'lg'
  live?: boolean
}

const SIZES = {
  sm: { box: 'min-w-[26px] px-1.5 py-1 text-base', gap: 'gap-1', sep: 'text-sm' },
  md: { box: 'min-w-[30px] px-2 py-1 text-lg', gap: 'gap-1.5', sep: 'text-sm' },
  lg: { box: 'min-w-[38px] px-2.5 py-1.5 text-2xl', gap: 'gap-2', sep: 'text-base' },
}

/** Stadium-style scoreboard: two dark digit panels split by a colon. */
export function Scoreboard({ score1, score2, pending, size = 'md' }: Props) {
  const s = SIZES[size]
  const hasScore = score1 !== undefined && score2 !== undefined && !pending

  if (!hasScore) {
    return (
      <span className="font-score text-gray-500 dark:text-gray-500 font-semibold uppercase text-xs tracking-widest px-1">
        vs
      </span>
    )
  }

  // Neutral dark panel for every state (live just keeps the red card/badge around it)
  const panel = `scoreboard-digit inline-flex items-center justify-center rounded-md text-white tabular-nums bg-gradient-to-b from-gray-700 to-gray-900 shadow-inner shadow-black/40 ${s.box}`

  return (
    <span className={`inline-flex items-center ${s.gap} align-middle`}>
      <span className={panel}>{score1}</span>
      <span className={`${s.sep} select-none leading-none`}>⚽</span>
      <span className={panel}>{score2}</span>
    </span>
  )
}
