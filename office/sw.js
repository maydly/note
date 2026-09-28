'use strict';
// maydly 사무실 온라인 허브 — 서비스 워커(알림 받기 전용)
// - 알림(push)을 받으면 보여 주고, 알림을 누르면 허브 결재함·보고함을 연다.
// - 화면 파일을 저장해 두지 않는다(캐시 없음) — 옛 화면이 고착되지 않게 항상 새로 받는다.
// - 캐시 저장소(Cache API)는 읽지도 지우지도 않는다: 같은 주소(maydly.github.io)의 다른 앱들이 쓰는 캐시가 있으므로 절대 건드리지 않는다.

self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : '' }; }
  const title = typeof d.title === 'string' && d.title ? d.title.slice(0, 60) : 'maydly 사무실';
  const body = typeof d.body === 'string' ? d.body.slice(0, 200) : '';
  const url = typeof d.url === 'string' && /^\.\/(#[^\s]*)?$/.test(d.url) ? d.url : './#approvals';
  e.waitUntil(self.registration.showNotification(title, {
    body, tag: typeof d.tag === 'string' ? d.tag.slice(0, 64) : undefined, renotify: !!d.tag,
    icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const rel = (e.notification.data && e.notification.data.url) || './#approvals';
  const target = new URL(rel, self.registration.scope).href;
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) {
      if (c.url.startsWith(self.registration.scope)) {
        try { c.postMessage({ type: 'open', url: target }); } catch (_) { /* 무시 */ }
        if ('focus' in c) return c.focus();
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(target);
    return undefined;
  })());
});
