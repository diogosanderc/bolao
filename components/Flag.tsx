import { teamById } from '@/lib/copa2026'

export function Flag({ teamId, size = 24 }: { teamId: string; size?: number }) {
  const team = teamById[teamId]
  if (!team) return null
  return (
    <img
      src={`https://flagcdn.com/w40/${team.iso2}.png`}
      alt={team.name}
      width={size}
      height={Math.round(size * 0.67)}
      className="rounded-sm object-cover inline-block"
      style={{ width: size, height: Math.round(size * 0.67) }}
    />
  )
}
