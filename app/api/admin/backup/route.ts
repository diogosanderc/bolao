import { NextRequest, NextResponse } from 'next/server'
import { readDB } from '@/lib/db'

export async function GET(req: NextRequest) {
  const adminKey = req.headers.get('x-admin-key') ?? ''
  if (adminKey !== (process.env.ADMIN_KEY ?? 'admin123')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const db = await readDB()
  const filename = `bolao-backup-${new Date().toISOString().slice(0, 10)}.json`
  return new NextResponse(JSON.stringify(db, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
