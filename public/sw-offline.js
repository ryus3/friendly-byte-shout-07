// ⚡ Advanced Service Worker للعمل Offline - RYUS System
// Version: 2.0.0 - Full Offline Support with Background Sync

const CACHE_VERSION = 'ryus-v2.0.0';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const API_CACHE = `${CACHE_VERSION}-api`;

// الموارد الحرجة التي يجب تخزينها مسبقاً
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
];

// استراتيجية التخزين المؤقت
const CACHE_STRATEGIES = {
  networkFirst: 'network-first',
  cacheFirst: 'cache-first',
  staleWhileRevalidate: 'stale-while-revalidate',
};

// ============= التثبيت والتفعيل =============

self.addEventListener('install', (event) => {
  console.log('✅ Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('📦 Service Worker: Precaching assets');
      return cache.addAll(PRECACHE_ASSETS.map(url => new Request(url, { cache: 'reload' })));
    }).then(() => {
      console.log('✅ Service Worker: Installation complete');
      return self.skipWaiting(); // تفعيل فوري
    }).catch(err => {
      console.error('❌ Service Worker: Installation failed:', err);
    })
  );
});

self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      // حذف الـ caches القديمة
      return Promise.all(
        cacheNames
          .filter(cacheName => cacheName.startsWith('ryus-') && cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE && cacheName !== API_CACHE)
          .map(cacheName => {
            console.log('🗑️ Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    }).then(() => {
      console.log('✅ Service Worker: Activated');
      return self.clients.claim(); // السيطرة الفورية على الصفحات
    })
  );
});

// ============= استراتيجيات التخزين المؤقت =============

// Network First - للـ API requests (جلب من الشبكة أولاً، ثم من Cache)
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    // تخزين الاستجابة الناجحة في Cache
    if (networkResponse.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('📡 Service Worker: Network failed, trying cache for:', request.url);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // إذا فشل كلاهما، إرجاع offline page
    return new Response(
      JSON.stringify({ 
        offline: true, 
        message: 'أنت غير متصل بالإنترنت. البيانات المعروضة من الذاكرة المؤقتة.' 
      }),
      { 
        headers: { 'Content-Type': 'application/json' },
        status: 503
      }
    );
  }
}

// Cache First - للموارد الثابتة (صور، خطوط، CSS، JS)
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('❌ Service Worker: Failed to fetch:', request.url, error);
    return new Response('Resource not available offline', { status: 503 });
  }
}

// Stale While Revalidate - للبيانات التي يمكن عرضها من Cache وتحديثها في الخلفية
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = fetch(request).then(networkResponse => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => cachedResponse);
  
  return cachedResponse || fetchPromise;
}

// ============= معالجة الطلبات =============

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // تجاهل chrome extensions و devtools
  if (url.protocol === 'chrome-extension:' || url.protocol === 'devtools:') {
    return;
  }
  
  // تحديد الاستراتيجية بناءً على نوع الطلب
  if (request.method !== 'GET') {
    // POST/PUT/DELETE - إرسال مباشر أو حفظ للـ Background Sync
    event.respondWith(
      fetch(request).catch(() => {
        // حفظ الطلب للـ Background Sync
        return saveForSync(request).then(() => {
          return new Response(
            JSON.stringify({ 
              queued: true, 
              message: 'تم حفظ العملية. سيتم رفعها عند الاتصال بالإنترنت.' 
            }),
            { 
              headers: { 'Content-Type': 'application/json' },
              status: 202
            }
          );
        });
      })
    );
    return;
  }
  
  // GET requests
  if (url.origin === location.origin) {
    // API requests من Supabase
    if (url.pathname.includes('/rest/v1/') || url.pathname.includes('/auth/v1/')) {
      event.respondWith(networkFirst(request));
    }
    // HTML/JS/CSS/Images
    else if (
      request.destination === 'document' ||
      request.destination === 'script' ||
      request.destination === 'style' ||
      request.destination === 'image' ||
      request.destination === 'font'
    ) {
      event.respondWith(cacheFirst(request));
    }
    // باقي الطلبات
    else {
      event.respondWith(staleWhileRevalidate(request));
    }
  } else {
    // External resources (CDN, APIs)
    event.respondWith(staleWhileRevalidate(request));
  }
});

// ============= Background Sync =============

// حفظ الطلبات للـ Background Sync
async function saveForSync(request) {
  const db = await openSyncDatabase();
  
  const requestData = {
    url: request.url,
    method: request.method,
    headers: [...request.headers.entries()],
    body: await request.clone().text(),
    timestamp: Date.now(),
  };
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['sync-queue'], 'readwrite');
    const store = transaction.objectStore('sync-queue');
    const addRequest = store.add(requestData);
    
    addRequest.onsuccess = () => {
      console.log('✅ Service Worker: Request saved for sync');
      resolve();
    };
    
    addRequest.onerror = () => {
      console.error('❌ Service Worker: Failed to save request for sync');
      reject(addRequest.error);
    };
  });
}

// فتح قاعدة بيانات IndexedDB للـ Background Sync
function openSyncDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ryus-sync-db', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('sync-queue')) {
        const objectStore = db.createObjectStore('sync-queue', { 
          keyPath: 'id', 
          autoIncrement: true 
        });
        objectStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

// Background Sync Event
self.addEventListener('sync', (event) => {
  console.log('🔄 Service Worker: Background sync triggered:', event.tag);
  
  if (event.tag === 'sync-orders') {
    event.waitUntil(syncPendingRequests());
  }
});

// مزامنة الطلبات المحفوظة
async function syncPendingRequests() {
  const db = await openSyncDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['sync-queue'], 'readonly');
    const store = transaction.objectStore('sync-queue');
    const getAllRequest = store.getAll();
    
    getAllRequest.onsuccess = async () => {
      const requests = getAllRequest.result;
      
      console.log(`🔄 Service Worker: Syncing ${requests.length} pending requests`);
      
      for (const requestData of requests) {
        try {
          // إعادة إنشاء الطلب
          const request = new Request(requestData.url, {
            method: requestData.method,
            headers: new Headers(requestData.headers),
            body: requestData.body,
          });
          
          // إرسال الطلب
          const response = await fetch(request);
          
          if (response.ok) {
            // حذف الطلب من قاعدة البيانات
            const deleteTransaction = db.transaction(['sync-queue'], 'readwrite');
            const deleteStore = deleteTransaction.objectStore('sync-queue');
            await deleteStore.delete(requestData.id);
            
            console.log('✅ Service Worker: Request synced successfully:', requestData.url);
            
            // إشعار التطبيق بالمزامنة الناجحة
            self.clients.matchAll().then(clients => {
              clients.forEach(client => {
                client.postMessage({
                  type: 'SYNC_SUCCESS',
                  data: { url: requestData.url, timestamp: Date.now() }
                });
              });
            });
          }
        } catch (error) {
          console.error('❌ Service Worker: Sync failed for:', requestData.url, error);
        }
      }
      
      resolve();
    };
    
    getAllRequest.onerror = () => reject(getAllRequest.error);
  });
}

// ============= رسائل من التطبيق =============

self.addEventListener('message', (event) => {
  console.log('📨 Service Worker: Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(cacheName => cacheName.startsWith('ryus-'))
            .map(cacheName => caches.delete(cacheName))
        );
      }).then(() => {
        console.log('✅ Service Worker: All caches cleared');
        return self.clients.matchAll();
      }).then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'CACHE_CLEARED' });
        });
      })
    );
  }
});

console.log('🎉 Service Worker: Loaded successfully - Version', CACHE_VERSION);
