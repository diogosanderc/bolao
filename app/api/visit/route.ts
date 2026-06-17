import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

// Separate file so visit writes never race with DB writes
const VISITS_PATH = path.join(
  process.env.DATA_DIR || path.join(process.cwd(), 'data'),
  'visits.json'
)

function todayBRT() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

export async function POST() {
  try {
    const today = todayBRT()
    let visits: Record<string, number> = {}
    try {
      visits = JSON.parse(await fs.readFile(VISITS_PATH, 'utf-8'))
    } catch {}
    visits[today] = (visits[today] ?? 0) + 1
    await fs.mkdir(path.dirname(VISITS_PATH), { recursive: true })
    await fs.writeFile(VISITS_PATH, JSON.stringify(visits))
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
