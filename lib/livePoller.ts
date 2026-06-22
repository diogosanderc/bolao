import { runLiveSync } from './liveSync'

let started = false

export function startLivePoller() {
  if (started) return
  started = true

  const INTERVAL_MS = 10_000

  async function tick() {
    try {
      const result = await runLiveSync()
      if (!result.skipped && (result.notifications ?? 0) > 0) {
        console.log(`[livePoller] ${result.notifications} notification(s) sent`)
      }
    } catch (err) {
      console.error('[livePoller] Sync error:', err)
    }
  }

  console.log(`[livePoller] Started — polling ESPN every ${INTERVAL_MS / 1000}s`)
  setTimeout(tick, 3_000)        // first run after server settles
  setInterval(tick, INTERVAL_MS) // then every 10s
}
