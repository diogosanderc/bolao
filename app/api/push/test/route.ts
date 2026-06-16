import { NextRequest, NextResponse } from 'next/server'
import { sendPushToAll } from '@/lib/push'
import { readDB } from '@/lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const adminKey = body.adminKey ?? req.headers.get('x-admin-key') ?? ''
  if (adminKey !== (process.env.ADMIN_KEY ?? 'admin123')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = await readDB()
  const count = db.pushSubscriptions?.length ?? 0

  await sendPushToAll({
    title: '🔔 Teste de notificação',
    body: `Bolão Copa 2026 — ${count} assinante(s) configurado(s)`,
    icon: '/icon-192.png',
  })

  return NextResponse.json({ ok: true, subscribers: count })
}
