const CACHE = 'habit-v4';
const FILES = ['./', './index.html', './manifest.json', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then(clients => clients.forEach(c => c.postMessage({ type: 'SW_UPDATED' })))
  );
});

self.addEventListener('fetch', e => {
  // HTMLはネットワーク優先（常に最新を取得）、失敗時はキャッシュ
  if (e.request.mode === 'navigate' || e.request.destination === 'document') {
    e.respondWith(
      fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  // その他はキャッシュ優先
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

// ── Notification scheduling ───────────────────────────
let notifTimer = null;

self.addEventListener('message', e => {
  if (e.data?.type !== 'SCHEDULE') return;
  const { enabled, time } = e.data;

  if (notifTimer) clearTimeout(notifTimer);
  if (!enabled || !time) return;

  scheduleNext(time);
});

function scheduleNext(time) {
  const ms = msUntilTime(time);
  notifTimer = setTimeout(() => {
    showNotif();
    scheduleNext(time);
  }, ms);
}

function msUntilTime(time) {
  const [h, m] = time.split(':').map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(h, m, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return target - now;
}

function showNotif() {
  self.registration.showNotification('習慣', {
    body: '今日の習慣を確認しましょう',
    icon: './icon.svg',
    badge: './icon.svg',
    tag: 'daily-habit',
    renotify: false
  });
}

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      if (list.length) return list[0].focus();
      return clients.openWindow('./');
    })
  );
});
