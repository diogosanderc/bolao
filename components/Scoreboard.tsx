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
  sm: { box: 'min-w-[28px] px-2 py-1 text-lg', gap: 'gap-1', sep: 'text-sm' },
  md: { box: 'min-w-[38px] px-3 py-1.5 text-2xl', gap: 'gap-1.5', sep: 'text-base' },
  lg: { box: 'min-w-[46px] px-3.5 py-2 text-3xl', gap: 'gap-2', sep: 'text-lg' },
}

/** Stadium-style scoreboard: two dark digit panels split by a colon. */
export function Scoreboard({ score1, score2, pending, size = 'md', live }: Props) {
  const s = SIZES[size]
  const hasScore = score1 !== undefined && score2 !== undefined && !pending

  if (!hasScore) {
    return (
      <span className="font-score text-gray-500 dark:text-gray-500 font-semibold uppercase text-xs tracking-widest px-1">
        vs
      </span>
    )
  }

  const panel = `scoreboard-digit rounded-md text-white tabular-nums text-center ${s.box} ${
    live
      ? 'bg-gradient-to-b from-red-700 to-red-900 shadow-inner shadow-red-950/50'
      : 'bg-gradient-to-b from-gray-700 to-gray-900 shadow-inner shadow-black/40'
  }`

  return (
    <span className={`inline-flex items-center ${s.gap} align-middle`}>
      <span className={panel}>{score1}</span>
      <span className={`font-score font-bold ${s.sep} ${live ? 'text-red-500 dark:text-red-400' : 'text-gray-500'}`}>:</span>
      <span className={panel}>{score2}</span>
    </span>
  )
}
