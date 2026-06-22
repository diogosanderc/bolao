import { NextResponse } from 'next/server'
import { readDB } from '@/lib/db'
import { getPollerStatus } from '@/lib/livePoller'

export async function GET() {
  const db = await readDB()
  const liveStates = (db as any).liveMatchStates ?? {}
  const subs = (db.pushSubscriptions ?? []).length
  const { started, tickCount, lastTickAt, lastSyncAt } = getPollerStatus()

  return NextResponse.json({
    poller: { started, tickCount, lastTickAt, lastSyncAt },
    pushSubscriptions: subs,
    liveMatchStates: liveStates,
    runtime: process.env.NEXT_RUNTIME ?? 'undefined',
  })
}
