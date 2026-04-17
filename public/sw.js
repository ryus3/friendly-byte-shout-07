// ✅ Service Worker v3.0.0 - يستثني Supabase تماماً لضمان عمل Realtime على المنشور
const VERSION = 'v3.0.0';
const STATIC_CACHE = `ryus-static-${VERSION}`;
const DYNAMIC_CACHE = `ryus-dynamic-${VERSION}`;
const IMAGE_CACHE = `ryus-images-${VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// ✅ التفعيل - حذف كل الـ caches القديمة (مهما كان اسمها)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => Promise.all(
        cacheNames
          .filter(name => !name.endsWith(VERSION))
          .map(name => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

// ✅ Fetch - يتجاهل Supabase تماماً لضمان عمل Realtime/Auth بدون اعتراض
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.protocol === 'chrome-extension:') return;

  // 🚫 لا تعترض Supabase أبداً (REST/Realtime/Auth/Storage/Functions)
  if (
    url.hostname.endsWith('.supabase.co') ||
    url.hostname.endsWith('.supabase.in') ||
    url.hostname.includes('supabase')
  ) {
    return; // مرور مباشر للشبكة
  }

  // 🚫 لا تعترض WebSocket
  if (request.headers.get('upgrade') === 'websocket') {
    return;
  }

  // 🚫 لا تعترض غير GET
  if (request.method !== 'GET') return;

  // ✅ صور: Stale-While-Revalidate
  if (
    request.destination === 'image' ||
    url.pathname.match(/\.(jpg|jpeg|png|gif|svg|webp|ico)$/)
  ) {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE));
    return;
  }

  // ✅ JS/CSS/Fonts: Network First (لتجنب bundles قديمة على المنشور)
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font' ||
    url.pathname.match(/\.(js|css|woff2?|ttf|eot)$/)
  ) {
    event.respondWith(networkFirst(request, STATIC_CACHE));
    return;
  }

  // ✅ الباقي: Network First
  event.respondWith(networkFirst(request, DYNAMIC_CACHE));
});

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (error) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then(response => {
      if (response.ok) cache.put(request, response.clone()).catch(() => {});
      return response;
    })
    .catch(() => cached);
  return cached || fetchPromise;
}

// ✅ Background Sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-orders') {
    event.waitUntil(syncPendingOrders());
  }
});

async function syncPendingOrders() {
  try {
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type: 'SYNC_PENDING_ORDERS', timestamp: Date.now() });
    });
  } catch (error) {
    return Promise.reject(error);
  }
}

// ✅ رسائل من التطبيق
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, icon, badge, tag, data } = event.data.payload;
    self.registration.showNotification(title, {
      body,
      icon: icon || '/icon-192x192.png',
      badge: badge || '/icon-192x192.png',
      tag: tag || 'default',
      data: data || {},
      requireInteraction: true,
      actions: [
        { action: 'view', title: 'عرض', icon: '/icon-192x192.png' },
        { action: 'dismiss', title: 'تجاهل' }
      ]
    });
  }
});

// ✅ النقر على الإشعار
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  if (event.action === 'dismiss') return;
  event.waitUntil(
    self.clients.matchAll().then((clients) => {
      const client = clients.find(c => c.visibilityState === 'visible');
      if (client) {
        client.postMessage({ type: 'NOTIFICATION_CLICKED', data });
        return client.focus();
      } else {
        let url = '/';
        if (data.type === 'new_ai_order') url = '/ai-orders';
        else if (data.type === 'new_order') url = '/orders';
        else if (data.type === 'low_stock') url = '/products';
        return self.clients.openWindow(url);
      }
    })
  );
});

self.addEventListener('notificationclose', () => {});

// ✅ Push
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: data.icon || '/icon-192x192.png',
        badge: '/icon-192x192.png',
        tag: data.tag || 'push',
        data: data.data || {},
        requireInteraction: true
      })
    );
  }
});
