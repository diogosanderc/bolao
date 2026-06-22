export async function register() {
  // Start background poller in Node.js runtime only (not Edge).
  // We check !== 'edge' rather than === 'nodejs' because Railway may leave
  // NEXT_RUNTIME undefined while still running the standard Node.js server.
  if (process.env.NEXT_RUNTIME !== 'edge') {
    const { startLivePoller } = await import('./lib/livePoller')
    startLivePoller()
  }
}
