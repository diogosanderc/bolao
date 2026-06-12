import fs from 'fs/promises'
import path from 'path'
import { Database } from './types'

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data')
const DB_PATH = path.join(DATA_DIR, 'db.json')

const DEFAULT_DB: Database = {
  participants: [],
  matchPredictions: [],
  groupPredictions: [],
  results: [],
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

export async function updateDB(updater: (db: Database) => Database): Promise<Database> {
  const db = await readDB()
  const next = updater(db)
  await writeDB(next)
  return next
}
