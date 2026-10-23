// 오프라인 지원: 한 번 열어 두면 인터넷 없이도 열린다.
// 안내 내용(index.html·app.enc)은 '인터넷 먼저, 안 되면 저장본' — 업데이트가 바로 반영되게.
// 글꼴·아이콘은 '저장본 먼저'.
const CACHE = 'wemeet-2026-10-23 16:30'
const SHELL = ['./', 'index.html', 'app.enc', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png']
const FONT = 'fonts/PretendardVariable.woff2'

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE)
    await Promise.all(SHELL.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => {})))
    await c.add(FONT).catch(() => {})
    self.skipWaiting()
  })())
})

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('wemeet-') && k !== CACHE) {
      // 이전 버전 저장본의 글꼴은 새 저장소로 옮겨 다시 받지 않게
      const old = await caches.open(k); const f = await old.match(FONT)
      const cur = await caches.open(CACHE)
      if (f && !(await cur.match(FONT))) await cur.put(FONT, f)
      await caches.delete(k)
    }
    await self.clients.claim()
  })())
})

const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  // 서버(공지·귀가보고) 요청은 건드리지 않는다
  if (url.hostname.endsWith('supabase.co')) return

  if (url.origin === location.origin && (req.mode === 'navigate' || /\/(index\.html|app\.enc)?$/.test(url.pathname) || url.pathname.endsWith('app.enc'))) {
    e.respondWith((async () => {
      const c = await caches.open(CACHE)
      try {
        const res = await Promise.race([fetch(req, { cache: 'no-cache' }), timeout(4000)])
        if (res.ok) c.put(req.mode === 'navigate' ? 'index.html' : req, res.clone())
        return res
      } catch {
        return (await c.match(req.mode === 'navigate' ? 'index.html' : req, { ignoreSearch: true })) ||
               (await c.match('index.html')) || Response.error()
      }
    })())
    return
  }

  e.respondWith((async () => {
    const c = await caches.open(CACHE)
    const hit = await c.match(req, { ignoreSearch: url.origin === location.origin })
    if (hit) return hit
    try {
      const res = await fetch(req)
      if (res.ok || res.type === 'opaque') c.put(req, res.clone())
      return res
    } catch { return Response.error() }
  })())
})
