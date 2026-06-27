'use client'

import { Broadcaster } from '@/lib/broadcasters'

export function BroadcastBadges({ channels }: { channels: Broadcaster[] }) {
  if (!channels.length) return null
  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
      <span className="text-[10px] text-gray-500 uppercase tracking-wide">📺 No Brasil</span>
      {channels.map(c => (
        <span
          key={c.id}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold leading-none"
          style={{ background: c.bg, color: c.fg }}
          title={c.free ? `${c.name} — sinal aberto / grátis` : c.name}
        >
          {c.name}
          {c.free && <span className="text-[8px] font-semibold opacity-80">FREE</span>}
        </span>
      ))}
    </div>
  )
}
