export async function register() {
  // Only run in the Node.js runtime (not Edge), and not during build
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startLivePoller } = await import('./lib/livePoller')
    startLivePoller()
  }
}
