import webpush from 'web-push'
import { readDB } from './db'

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY ?? ''
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? ''

function getWebPush() {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return null
  webpush.setVapidDetails('mailto:diogosanderc@gmail.com', VAPID_PUBLIC, VAPID_PRIVATE)
  return webpush
}

export async function sendPushToAll(payload: { title: string; body: string; icon?: string }) {
  const wp = getWebPush()
  if (!wp) return

  const db = await readDB()
  const subs = db.pushSubscriptions ?? []
  if (subs.length === 0) return

  const message = JSON.stringify(payload)
  await Promise.allSettled(
    subs.map(sub =>
      wp.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        message
      )
    )
  )
}
