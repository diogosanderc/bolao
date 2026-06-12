import { NextRequest, NextResponse } from 'next/server'

const ADMIN_KEY = process.env.ADMIN_KEY ?? 'admin123'

export async function POST(req: NextRequest) {
  const { adminKey } = await req.json()
  if (adminKey !== ADMIN_KEY) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  return NextResponse.json({ ok: true })
}
