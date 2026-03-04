// DocGuard Maritime Pro — Service Worker v2.0
const CACHE_NAME = 'docguard-maritime-v2';
const OFFLINE_URL = 'index.html';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
];

// ===========================
// INSTALL — Cache aset utama
// ===========================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching app shell...');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// ===========================
// ACTIVATE — Hapus cache lama
// ===========================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) =>
      Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Menghapus cache lama:', key);
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// ===========================
// FETCH — Offline-first strategy
// ===========================
self.addEventListener('fetch', (event) => {
  // Skip non-GET dan request ke luar origin
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Kembalikan dari cache, lalu update di background
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse.clone());
            });
          }
        }).catch(() => {});
        return cachedResponse;
      }
      // Tidak ada di cache, ambil dari network
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) return networkResponse;
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        return networkResponse;
      }).catch(() => {
        // Fallback ke index.html kalau offline
        return caches.match(OFFLINE_URL);
      });
    })
  );
});

// ===========================
// PUSH NOTIFICATION
// ===========================
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'DocGuard Maritime';
  const options = {
    body: data.body || 'Ada dokumen yang perlu diperhatikan!',
    icon: data.icon || '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: '📂 Buka Aplikasi' },
      { action: 'dismiss', title: 'Tutup' }
    ]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// ===========================
// NOTIFICATION CLICK
// ===========================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});

// ===========================
// BACKGROUND SYNC (opsional)
// ===========================
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-docs') {
    console.log('[SW] Background sync triggered');
  }
});
