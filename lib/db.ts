import fs from 'fs/promises'
import path from 'path'
import { Database } from './types'

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data')
const DB_PATH = path.join(DATA_DIR, 'db.json')
const LOCK_PATH = DB_PATH + '.lock'

const DEFAULT_DB: Database = {
  participants: [],
  matchPredictions: [],
  groupPredictions: [],
  results: [],
  matchDates: {},
}

export async function readDB(): Promise<Database> {
  try {
    const raw = await fs.readFile(DB_PATH, 'utf-8')
    return { ...DEFAULT_DB, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_DB }
  }
}

export async function writeDB(db: Database): Promise<void> {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true })
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), 'utf-8')
}

// Acquire a simple file-based lock, retrying up to ~3 seconds
async function acquireLock(): Promise<void> {
  const timeout = Date.now() + 3000
  while (Date.now() < timeout) {
    try {
      // O_EXCL ensures only one process creates the file
      const fd = await fs.open(LOCK_PATH, 'wx')
      await fd.close()
      return
    } catch {
      await new Promise(r => setTimeout(r, 50))
    }
  }
  // Timed out — remove stale lock and proceed
  await fs.unlink(LOCK_PATH).catch(() => {})
}

async function releaseLock(): Promise<void> {
  await fs.unlink(LOCK_PATH).catch(() => {})
}

export async function updateDB(updater: (db: Database) => Database): Promise<Database> {
  await acquireLock()
  try {
    const db = await readDB()
    const next = updater(db)
    await writeDB(next)
    return next
  } finally {
    await releaseLock()
  }
}
