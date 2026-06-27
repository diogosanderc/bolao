'use client'

// Deterministic vivid color from a name, so each participant keeps the same hue.
const PALETTE = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e',
]

function colorFor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

type Props = { name: string; size?: number; className?: string }

export function Avatar({ name, size = 28, className = '' }: Props) {
  const color = colorFor(name)
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-bold text-white shrink-0 select-none ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `linear-gradient(135deg, ${color}, ${color}bb)`,
      }}
      aria-hidden
    >
      {initials(name)}
    </span>
  )
}
