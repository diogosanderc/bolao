import { runLiveSync } from './liveSync'

let started = false
let tickCount = 0
let lastTickAt: string | null = null
let lastSyncAt: string | null = null

export function getPollerStatus() {
  return { started, tickCount, lastTickAt, lastSyncAt }
}

export function startLivePoller() {
  if (started) return
  started = true

  const INTERVAL_MS = 10_000

  async function tick() {
    tickCount++
    lastTickAt = new Date().toISOString()
    try {
      const result = await runLiveSync()
      if (!result.skipped) {
        lastSyncAt = new Date().toISOString()
        if ((result.notifications ?? 0) > 0) {
          console.log(`[livePoller] ${result.notifications} notification(s) sent`)
        }
      }
    } catch (err) {
      console.error('[livePoller] Sync error:', err)
    }
  }

  console.log(`[livePoller] Started — polling ESPN every ${INTERVAL_MS / 1000}s (NEXT_RUNTIME=${process.env.NEXT_RUNTIME ?? 'undefined'})`)
  setTimeout(tick, 3_000)
  setInterval(tick, INTERVAL_MS)
}
