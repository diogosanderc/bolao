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

  return NextResponse.json({
    poller: {
      lastRunAt: lastPollerRun,
      secondsAgo: secondsSinceRun,
      healthy: secondsSinceRun !== null && secondsSinceRun < 30,
    },
    pushSubscriptions: subs,
    liveMatchStates: liveStates,
    runtime: process.env.NEXT_RUNTIME ?? 'undefined',
  })
}
