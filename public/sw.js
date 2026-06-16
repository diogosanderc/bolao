const CACHE = 'bolao-v1'
const SHELL = ['/', '/manifest.json']

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  if (e.request.url.includes('/api/')) return

  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone()
        caches.open(CACHE).then(c => c.put(e.request, clone))
        return res
      })
      .catch(() => caches.match(e.request))
  )
})

self.addEventListener('push', e => {
  if (!e.data) return
  let payload = { title: 'Bolão Copa 2026', body: '', icon: '/icon-192.png' }
  try { Object.assign(payload, e.data.json()) } catch { payload.body = e.data.text() }
  e.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon ?? '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      tag: 'bolao-event',
      renotify: true,
    })
  )
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  e.waitUntil(clients.openWindow('/'))
})
