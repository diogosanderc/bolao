import { NextRequest, NextResponse } from 'next/server'
import { readDB, updateDB } from '@/lib/db'

// GET /api/admin/live-state — inspect liveMatchStates
export async function GET(req: NextRequest) {
  const adminKey = req.headers.get('x-admin-key') ?? req.nextUrl.searchParams.get('key') ?? ''
  if (adminKey !== (process.env.ADMIN_KEY ?? 'admin123')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const db = await readDB()
  return NextResponse.json({ liveMatchStates: (db as any).liveMatchStates ?? {} })
}

// DELETE /api/admin/live-state — clear specific or all stuck in-progress entries
// Body: { adminKey, matchIds?: string[] }
// If matchIds is omitted, clears ALL in-progress (non-completed) entries without an official result.
export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const adminKey = body.adminKey ?? req.headers.get('x-admin-key') ?? ''
  if (adminKey !== (process.env.ADMIN_KEY ?? 'admin123')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const matchIds: string[] | undefined = body.matchIds

  let cleared: string[] = []
  await updateDB(db => {
    const states: Record<string, any> = { ...((db as any).liveMatchStates ?? {}) }
    const playedIds = new Set(db.results.map((r: any) => r.matchId))
    const inProgress = new Set(['in', 'halftime', 'extratime', 'et_halftime', 'penalties'])

    if (matchIds && matchIds.length > 0) {
      for (const id of matchIds) {
        if (states[id]) { delete states[id]; cleared.push(id) }
      }
    } else {
      // Clear all stuck in-progress entries with no official result
      for (const [id, st] of Object.entries(states)) {
        if (inProgress.has((st as any).status) && !playedIds.has(id)) {
          delete states[id]; cleared.push(id)
        }
      }
    }

    return { ...db, liveMatchStates: states }
  })

  return NextResponse.json({ ok: true, cleared })
}
