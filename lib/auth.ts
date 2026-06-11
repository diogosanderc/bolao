import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'

export function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return Promise.resolve(`${salt}:${hash}`)
}

export function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [salt, hash] = stored.split(':')
    if (!salt || !hash) return Promise.resolve(false)
    const hashBuf = Buffer.from(hash, 'hex')
    const derived = scryptSync(password, salt, 64)
    return Promise.resolve(timingSafeEqual(hashBuf, derived))
  } catch {
    return Promise.resolve(false)
  }
}

export const generateToken = () => randomBytes(32).toString('hex')

export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000
export const RESET_DURATION_MS   = 60 * 60 * 1000
