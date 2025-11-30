// ✅ Service Worker متقدم للعمل Offline - RYUS System
console.log('🔄 Enhanced Service Worker loaded');

const VERSION = 'v2.0.0';
const STATIC_CACHE = `ryus-static-${VERSION}`;
const DYNAMIC_CACHE = `ryus-dynamic-${VERSION}`;
const API_CACHE = `ryus-api-${VERSION}`;
const IMAGE_CACHE = `ryus-images-${VERSION}`;

// ✅ الملفات الثابتة للتخزين المسبق (App Shell)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
];

// ✅ التثبيت - تخزين App Shell
self.addEventListener('install', (event) => {
  console.log('✅ Service Worker installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('📦 Caching app shell');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch(err => console.error('❌ Cache installation failed:', err))
  );
});

// ✅ التفعيل - حذف Cache القديمة
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker activating...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name.startsWith('ryus-') && !name.includes(VERSION))
            .map(name => {
              console.log('🗑️ Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// ✅ Fetch - استراتيجيات Caching الذكية
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // تجاهل طلبات Chrome Extension
  if (url.protocol === 'chrome-extension:') return;

  // ✅ استراتيجية 1: Cache First للملفات الثابتة (JS, CSS, Fonts)
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font' ||
    url.pathname.match(/\.(js|css|woff2?|ttf|eot)$/)
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // ✅ استراتيجية 2: Stale While Revalidate للصور
  if (
    request.destination === 'image' ||
    url.pathname.match(/\.(jpg|jpeg|png|gif|svg|webp|ico)$/)
  ) {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE));
    return;
  }

  // ✅ استراتيجية 3: Network First للـ API مع Offline Fallback
  if (
    url.hostname.includes('supabase.co') ||
    url.pathname.startsWith('/api/')
  ) {
    event.respondWith(networkFirstWithCache(request, API_CACHE));
    return;
  }

  // ✅ استراتيجية 4: Network First لباقي الطلبات
  event.respondWith(networkFirstWithCache(request, DYNAMIC_CACHE));
});

// ✅ Cache First Strategy
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('❌ Fetch failed:', error);
    throw error;
  }
}

// ✅ Network First with Cache Fallback Strategy
async function networkFirstWithCache(request, cacheName) {
  const cache = await caches.open(cacheName);
  
  try {
    const response = await fetch(request);
    
    // ✅ تخزين الاستجابات الناجحة فقط
    if (response.ok && request.method === 'GET') {
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('📡 Network failed, trying cache...');
    const cached = await cache.match(request);
    
    if (cached) {
      return cached;
    }
    
    // ✅ إذا لم يوجد في Cache، إرجاع offline page
    return new Response(
      JSON.stringify({
        error: 'offline',
        message: 'لا يوجد اتصال بالإنترنت',
        offline: true
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// ✅ Stale While Revalidate Strategy
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  const fetchPromise = fetch(request)
    .then(response => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

// ✅ Background Sync للطلبات المعلقة
self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync triggered:', event.tag);
  
  if (event.tag === 'sync-orders') {
    event.waitUntil(syncPendingOrders());
  }
});

// ✅ مزامنة الطلبات المعلقة
async function syncPendingOrders() {
  try {
    console.log('📤 Syncing pending orders...');
    
    // ✅ إرسال رسالة للتطبيق لبدء المزامنة
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_PENDING_ORDERS',
        timestamp: Date.now()
      });
    });
    
    return Promise.resolve();
  } catch (error) {
    console.error('❌ Sync failed:', error);
    return Promise.reject(error);
  }
}

// ✅ التعامل مع الرسائل من التطبيق الرئيسي
self.addEventListener('message', (event) => {
  console.log('📨 SW received message:', event.data);
  
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
        {
          action: 'view',
          title: 'عرض',
          icon: '/icon-192x192.png'
        },
        {
          action: 'dismiss',
          title: 'تجاهل'
        }
      ]
    });
  }
});

// ✅ التعامل مع النقر على الإشعارات
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked:', event.notification.data);
  
  event.notification.close();
  
  const data = event.notification.data || {};
  
  if (event.action === 'dismiss') {
    return;
  }
  
  event.waitUntil(
    self.clients.matchAll().then((clients) => {
      const client = clients.find(c => c.visibilityState === 'visible');
      
      if (client) {
        client.postMessage({
          type: 'NOTIFICATION_CLICKED',
          data: data
        });
        return client.focus();
      } else {
        let url = '/';
        if (data.type === 'new_ai_order') {
          url = '/ai-orders';
        } else if (data.type === 'new_order') {
          url = '/orders';
        } else if (data.type === 'low_stock') {
          url = '/products';
        }
        
        return self.clients.openWindow(url);
      }
    })
  );
});

// ✅ التعامل مع إغلاق الإشعارات
self.addEventListener('notificationclose', (event) => {
  console.log('🔕 Notification closed:', event.notification.tag);
});

// ✅ Push notifications
self.addEventListener('push', (event) => {
  console.log('📬 Push notification received:', event.data);
  
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

console.log('✅ Enhanced Service Worker ready!');