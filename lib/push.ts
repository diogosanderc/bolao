import webpush from 'web-push'
import { readDB, updateDB } from './db'

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY ?? ''
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? ''

function getWebPush() {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return null
  webpush.setVapidDetails('mailto:diogosanderc@gmail.com', VAPID_PUBLIC, VAPID_PRIVATE)
  return webpush
}

type PushSub = { endpoint: string; keys: { p256dh: string; auth: string } }

async function sendToSubs(subs: PushSub[], payload: { title: string; body: string; icon?: string }) {
  const wp = getWebPush()
  if (!wp || subs.length === 0) return
  const message = JSON.stringify(payload)
  const results = await Promise.allSettled(
    subs.map(sub => wp.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, message))
  )
  const stale = new Set<string>()
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      const code = (r.reason as any)?.statusCode
      if (code === 410 || code === 404) stale.add(subs[i].endpoint)
    }
  })
  if (stale.size > 0) {
    await updateDB(db => ({
      ...db,
      pushSubscriptions: (db.pushSubscriptions ?? []).filter(s => !stale.has(s.endpoint)),
    }))
  }
}

// Send a push only to the device(s) that follow a given participant ("sou eu").
export async function sendPushToParticipant(participantId: string, payload: { title: string; body: string; icon?: string }) {
  const db = await readDB()
  const subs = (db.pushSubscriptions ?? []).filter(s => s.participantId === participantId)
  await sendToSubs(subs, payload)
}

export async function sendPushToAll(payload: { title: string; body: string; icon?: string }) {
  const wp = getWebPush()
  if (!wp) return

  const db = await readDB()
  const subs = db.pushSubscriptions ?? []
  if (subs.length === 0) return

  const message = JSON.stringify(payload)
  const results = await Promise.allSettled(
    subs.map(sub =>
      wp.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        message
      )
    )
  )

  // Remove subscriptions the push service has revoked (410 Gone) or can't find (404).
  // This happens when the browser unregistered the subscription or it expired.
  const stale = new Set<string>()
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      const code = (r.reason as any)?.statusCode
      if (code === 410 || code === 404) stale.add(subs[i].endpoint)
    }
  })

  if (stale.size > 0) {
    await updateDB(db => ({
      ...db,
      pushSubscriptions: (db.pushSubscriptions ?? []).filter(s => !stale.has(s.endpoint)),
    }))
    console.log(`[push] Removidas ${stale.size} subscription(s) expirada(s)`)
  }
}
