import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

const PRESENCE_PATH = path.join(
  process.env.DATA_DIR || path.join(process.cwd(), 'data'),
  'presence.json'
)

const TTL_MS = 3 * 60 * 1000 // 3 minutes

async function readPresence(): Promise<Record<string, number>> {
  try {
    return JSON.parse(await fs.readFile(PRESENCE_PATH, 'utf-8'))
  } catch {
    return {}
  }
}

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json()
    if (!id || typeof id !== 'string' || id.length > 64) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }
    const now = Date.now()
    const presence = await readPresence()
    // Purge stale entries while we're here
    for (const [k, ts] of Object.entries(presence)) {
      if (now - ts > TTL_MS) delete presence[k]
    }
    presence[id] = now
    await fs.mkdir(path.dirname(PRESENCE_PATH), { recursive: true })
    await fs.writeFile(PRESENCE_PATH, JSON.stringify(presence))
    const active = Object.keys(presence).length
    return NextResponse.json({ ok: true, active })
  } catch {
    return NextResponse.json({ ok: false })
  }
}

export async function GET() {
  const now = Date.now()
  const presence = await readPresence()
  const active = Object.values(presence).filter(ts => now - ts <= TTL_MS).length
  return NextResponse.json({ active })
}
