import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'

export const hashPassword = (password: string) => bcrypt.hash(password, 10)
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash)
export const generateToken = () => randomBytes(32).toString('hex')

export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000  // 7 dias
export const RESET_DURATION_MS   = 60 * 60 * 1000            // 1 hora
