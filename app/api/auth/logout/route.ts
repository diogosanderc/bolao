import { NextRequest, NextResponse } from 'next/server'
import { readDB, updateDB } from '@/lib/db'

export async function POST(req: NextRequest) {
  const sessionToken = req.cookies.get('session')?.value
  if (sessionToken) {
    await updateDB(db => ({
      ...db,
      participants: db.participants.map(p =>
        p.sessionToken === sessionToken ? { ...p, sessionToken: undefined, sessionExpiry: undefined } : p
      ),
    }))
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.delete('session')
  return res
}
