import { NextRequest, NextResponse } from 'next/server'
import { updateDB } from '@/lib/db'

// POST — save a new push subscription
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
  }

  await updateDB(db => {
    const subs = db.pushSubscriptions ?? []
    const exists = subs.some(s => s.endpoint === body.endpoint)
    if (exists) return db
    return {
      ...db,
      pushSubscriptions: [...subs, {
        endpoint: body.endpoint,
        keys: { p256dh: body.keys.p256dh, auth: body.keys.auth },
        createdAt: new Date().toISOString(),
      }],
    }
  })

  return NextResponse.json({ ok: true })
}

// DELETE — remove a subscription (unsubscribe)
export async function DELETE(req: NextRequest) {
  const { endpoint } = await req.json().catch(() => ({}))
  if (!endpoint) return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })

  await updateDB(db => ({
    ...db,
    pushSubscriptions: (db.pushSubscriptions ?? []).filter(s => s.endpoint !== endpoint),
  }))

  return NextResponse.json({ ok: true })
}
