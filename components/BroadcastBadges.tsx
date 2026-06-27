'use client'

import { useState } from 'react'
import { Broadcaster } from '@/lib/broadcasters'

function Badge({ c }: { c: Broadcaster }) {
  const [logoOk, setLogoOk] = useState(!!c.logo)

  if (logoOk && c.logo) {
    return (
      <span className="inline-flex items-center gap-1 bg-white rounded px-1.5 py-1" title={c.free ? `${c.name} — sinal aberto / grátis` : c.name}>
        <img src={c.logo} alt={c.name} className="h-4 w-auto object-contain" onError={() => setLogoOk(false)} />
        {c.free && <span className="w-1.5 h-1.5 rounded-full bg-green-500" title="grátis" />}
      </span>
    )
  }

  // Fallback: colored brand chip
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold leading-none"
      style={{ background: c.bg, color: c.fg }}
      title={c.free ? `${c.name} — sinal aberto / grátis` : c.name}
    >
      {c.name}
      {c.free && <span className="text-[8px] font-semibold opacity-80">FREE</span>}
    </span>
  )
}

export function BroadcastBadges({ channels }: { channels: Broadcaster[] }) {
  if (!channels.length) return null
  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
      <span className="text-xs" aria-hidden>📺</span>
      {channels.map(c => <Badge key={c.id} c={c} />)}
    </div>
  )
}
