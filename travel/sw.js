/* 여행지도 오프라인 캐시 (maydly · 260913)
 *
 * 왜: 명진 지적 — "열 때마다 다운받으니까 무거운 거 아니야?"
 *   GitHub Pages는 max-age=600(10분)만 주므로, 10분이 지나면 파일마다 "바뀐 거 있냐"를
 *   묻는 왕복이 생기고(13개 파일이면 13번), 폰 브라우저가 캐시를 비우면 본문을 다시 받는다.
 *   촬영지 4.2MB·추천지 4.9MB·도시사진 2.4MB를 여행지에서 다시 받는 건 아깝다.
 *
 * 방식: stale-while-revalidate — 캐시에 있으면 **즉시** 내주고(네트워크 0),
 *   그 사이 뒤에서 새로 받아 캐시를 갈아둔다. 데이터를 갱신해도 다음 방문에 자동 반영된다.
 *   같은 출처 파일만 다룬다(CDN 라이브러리는 건드리지 않는다).
 */
const CACHE = 'maydly-travel-v2';   // 갱신 감지 추가(260913)
const CACHEABLE = /\.(js|json|css|html|png|jpg|jpeg|webp|svg)$/i;

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    // 옛 버전 캐시는 정리한다
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith('maydly-travel-') && n !== CACHE)
      .map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

/* 자료가 실제로 바뀌었을 때만 화면에 알린다 — 명진: "변동이 있는지 없는지는 어떻게 확인하는데?" */
const WATCH = /\/data\/(scenes_kr|scenes_jp|spots|myplaces)\.js$/;

async function notifyUpdated(path) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
  clients.forEach((c) => c.postMessage({ type: 'maydly-data-updated', path }));
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;         // 외부 CDN·타일은 그대로 둔다
  if (!CACHEABLE.test(url.pathname)) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // ?v=3 · ?nc=… 같은 꼬리표가 달라도 같은 파일로 본다
    const hit = await cache.match(req, { ignoreSearch: true });
    const fresh = fetch(req).then(async (res) => {
      if (res && res.ok) {
        // 바뀐 자료인지 태그(etag)·길이로 견주어 본다
        if (hit && WATCH.test(url.pathname)) {
          const a = hit.headers.get('etag') || hit.headers.get('content-length');
          const b = res.headers.get('etag') || res.headers.get('content-length');
          if (a && b && a !== b) notifyUpdated(url.pathname);
        }
        cache.put(req, res.clone()).catch(() => {});
      }
      return res;
    }).catch(() => null);

    if (hit) {
      e.waitUntil(fresh);            // 즉시 캐시로 답하고, 갱신은 뒤에서
      return hit;
    }
    const res = await fresh;
    return res || new Response('', { status: 504, statusText: 'offline' });
  })());
});
