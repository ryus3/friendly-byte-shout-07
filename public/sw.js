// Service Worker للإشعارات الخلفية
console.log('🔄 Service Worker loaded');

// Cache names
const CACHE_NAME = 'notifications-cache-v1';

// أحداث التثبيت
self.addEventListener('install', (event) => {
  console.log('✅ Service Worker installed');
  self.skipWaiting();
});

// أحداث التفعيل
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker activated');
  event.waitUntil(self.clients.claim());
});

// التعامل مع الرسائل من التطبيق الرئيسي
self.addEventListener('message', (event) => {
  console.log('📨 SW received message:', event.data);
  
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

// التعامل مع النقر على الإشعارات
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked:', event.notification.data);
  
  event.notification.close();
  
  const data = event.notification.data || {};
  
  if (event.action === 'dismiss') {
    return;
  }
  
  // فتح التطبيق والانتقال للصفحة المناسبة
  event.waitUntil(
    self.clients.matchAll().then((clients) => {
      // البحث عن نافذة مفتوحة
      const client = clients.find(c => c.visibilityState === 'visible');
      
      if (client) {
        // إرسال رسالة للتطبيق للانتقال للصفحة المناسبة
        client.postMessage({
          type: 'NOTIFICATION_CLICKED',
          data: data
        });
        return client.focus();
      } else {
        // فتح نافذة جديدة
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

// التعامل مع إغلاق الإشعارات
self.addEventListener('notificationclose', (event) => {
  console.log('🔕 Notification closed:', event.notification.tag);
});

// Push notifications (للمستقبل)
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