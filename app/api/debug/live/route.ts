import { NextResponse } from 'next/server'
import { readDB } from '@/lib/db'

export async function GET() {
  const db = await readDB()
  const liveStates = (db as any).liveMatchStates ?? {}
  const lastPollerRun: string | null = (db as any).lastPollerRun ?? null
  const subs = (db.pushSubscriptions ?? []).length

  const secondsSinceRun = lastPollerRun
    ? Math.round((Date.now() - new Date(lastPollerRun).getTime()) / 1000)
    : null

  // Also show raw ESPN status names for debugging
  let espnRaw: Record<string, string> = {}
  try {
    const res = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard',
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bolao-debug/1.0)' }, cache: 'no-store' }
    )
    if (res.ok) {
      const data = await res.json()
      for (const event of data.events ?? []) {
        const comp = event.competitions?.[0]
        const typeName = comp?.status?.type?.name ?? event.status?.type?.name ?? '?'
        const desc = comp?.status?.type?.shortDetail ?? comp?.status?.type?.description ?? ''
        const teams = (comp?.competitors ?? []).map((c: any) => c.team?.abbreviation ?? '?').join(' vs ')
        espnRaw[teams] = `${typeName}${desc ? ' (' + desc + ')' : ''}`
      }
    }
  } catch { /* ESPN blocked in this env */ }

  return NextResponse.json({
    poller: {
      lastRunAt: lastPollerRun,
      secondsAgo: secondsSinceRun,
      healthy: secondsSinceRun !== null && secondsSinceRun < 30,
    },
    pushSubscriptions: subs,
    liveMatchStates: liveStates,
    espnStatus: Object.keys(espnRaw).length ? espnRaw : 'ESPN not reachable from this request',
    runtime: process.env.NEXT_RUNTIME ?? 'undefined',
  })
}
