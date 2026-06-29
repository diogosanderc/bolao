'use client'

import { AnimatedNumber } from '@/components/AnimatedNumber'
import { Icon } from '@/components/Icon'

export type PodiumTier = {
  rank: number
  points: number
  members: { id: string; name: string }[]
}

type Props = {
  tiers: PodiumTier[] // up to 3 tiers, by distinct points (1st, 2nd, 3rd)
  onSelect: (id: string, name: string) => void
  celebrate?: Set<string>
}

// Visual order: 2nd, 1st, 3rd (champion centered + taller)
const SLOTS = [
  { rank: 2, medalColor: 'text-gray-400', h: 'h-20', ring: 'ring-gray-400/60', glow: '', from: 'from-gray-300/15' },
  { rank: 1, medalColor: 'text-yellow-400', h: 'h-28', ring: 'ring-yellow-400/70', glow: 'shadow-[0_0_24px_-4px_rgba(250,204,21,0.5)]', from: 'from-yellow-400/20' },
  { rank: 3, medalColor: 'text-amber-600', h: 'h-16', ring: 'ring-amber-600/60', glow: '', from: 'from-amber-600/15' },
]

export function Podium({ tiers, onSelect, celebrate }: Props) {
  if (tiers.length === 0) return null
  const byRank: Record<number, PodiumTier> = {}
  for (const t of tiers) byRank[t.rank] = t

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3 items-end">
      {SLOTS.map(slot => {
        const tier = byRank[slot.rank]
        if (!tier) return <div key={slot.rank} />
        const isFirst = slot.rank === 1
        const celebrating = tier.members.some(m => celebrate?.has(m.id))
        const multi = tier.members.length > 1
        return (
          <div key={slot.rank} className={`flex flex-col items-center ${celebrating ? 'animate-celebrate' : ''}`}>
            <div className="relative mb-1.5">
              {celebrating && <span className="absolute -top-3 left-1/2 -translate-x-1/2 animate-bounce"><Icon name="sparkles" size={18} className="text-yellow-400" /></span>}
              <span
                className={`flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-900 ring-2 ${slot.ring} ${slot.glow}`}
                style={{ width: isFirst ? 56 : 44, height: isFirst ? 56 : 44 }}
              >
                <Icon name="medal" size={isFirst ? 30 : 24} className={slot.medalColor} strokeWidth={1.4} />
              </span>
              {multi && (
                <span className="absolute -bottom-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-gray-700 text-white text-[10px] font-bold border border-gray-900">
                  {tier.members.length}
                </span>
              )}
            </div>

            <div className="flex flex-col items-center gap-0.5 w-full px-0.5">
              {tier.members.map(m => (
                <button
                  key={m.id}
                  onClick={() => onSelect(m.id, m.name)}
                  className={`text-[11px] sm:text-xs font-semibold text-center leading-tight truncate w-full transition-transform active:scale-95 ${isFirst ? 'text-yellow-600 dark:text-yellow-300' : 'text-gray-700 dark:text-gray-200'} ${multi ? 'hover:underline' : 'hover:opacity-80'}`}
                >
                  {m.name}
                </button>
              ))}
            </div>

            <div className={`mt-1.5 w-full rounded-t-lg bg-gradient-to-t ${slot.from} to-transparent border-t border-x border-gray-200 dark:border-gray-800 flex flex-col items-center justify-end pb-1.5 pt-2 ${slot.h}`}>
              <span className={`font-score font-bold leading-none ${isFirst ? 'text-2xl text-yellow-600 dark:text-yellow-400' : 'text-xl text-gray-700 dark:text-gray-200'}`}>
                <AnimatedNumber value={tier.points} />
              </span>
              <span className="text-[9px] text-gray-500 uppercase tracking-wide mt-0.5">pts</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
