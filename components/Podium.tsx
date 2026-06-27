'use client'

import { LeaderboardEntry } from '@/lib/types'
import { AnimatedNumber } from '@/components/AnimatedNumber'

type Props = {
  top3: LeaderboardEntry[]
  onSelect: (id: string, name: string) => void
  celebrate?: Set<string>
}

// Visual order: 2nd, 1st, 3rd (champion centered + taller)
const SLOTS = [
  { rank: 2, medal: '🥈', h: 'h-20', ring: 'ring-gray-400/60', glow: '', from: 'from-gray-300/15' },
  { rank: 1, medal: '🥇', h: 'h-28', ring: 'ring-yellow-400/70', glow: 'shadow-[0_0_24px_-4px_rgba(250,204,21,0.5)]', from: 'from-yellow-400/20' },
  { rank: 3, medal: '🥉', h: 'h-16', ring: 'ring-amber-600/60', glow: '', from: 'from-amber-600/15' },
]

export function Podium({ top3, onSelect, celebrate }: Props) {
  if (top3.length < 3) return null
  const byRank: Record<number, LeaderboardEntry> = { 1: top3[0], 2: top3[1], 3: top3[2] }

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3 items-end">
      {SLOTS.map(slot => {
        const entry = byRank[slot.rank]
        if (!entry) return <div key={slot.rank} />
        const isFirst = slot.rank === 1
        const celebrating = celebrate?.has(entry.participant.id)
        return (
          <button
            key={slot.rank}
            onClick={() => onSelect(entry.participant.id, entry.participant.name)}
            className={`flex flex-col items-center group ${celebrating ? 'animate-celebrate' : ''}`}
          >
            <div className="relative mb-1.5">
              {celebrating && <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-lg animate-bounce">🎉</span>}
              <span
                className={`flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-900 ring-2 ${slot.ring} ${slot.glow} transition-transform group-hover:scale-105`}
                style={{ width: isFirst ? 56 : 44, height: isFirst ? 56 : 44, fontSize: isFirst ? 30 : 24 }}
              >
                {slot.medal}
              </span>
            </div>
            <span className={`text-[11px] sm:text-xs font-semibold text-center leading-tight truncate w-full px-0.5 ${isFirst ? 'text-yellow-600 dark:text-yellow-300' : 'text-gray-700 dark:text-gray-200'}`}>
              {entry.participant.name}
            </span>
            <div className={`mt-1.5 w-full rounded-t-lg bg-gradient-to-t ${slot.from} to-transparent border-t border-x border-gray-200 dark:border-gray-800 flex flex-col items-center justify-end pb-1.5 pt-2 ${slot.h}`}>
              <span className={`font-score font-bold leading-none ${isFirst ? 'text-2xl text-yellow-600 dark:text-yellow-400' : 'text-xl text-gray-700 dark:text-gray-200'}`}>
                <AnimatedNumber value={entry.totalPoints} />
              </span>
              <span className="text-[9px] text-gray-500 uppercase tracking-wide mt-0.5">pts</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
