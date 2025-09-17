// Service Worker للإشعارات الفورية
const CACHE_NAME = 'ryus-notifications-v1';

// تثبيت Service Worker
self.addEventListener('install', (event) => {
  console.log('📦 Service Worker installed');
  self.skipWaiting();
});

// تفعيل Service Worker
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker activated');
  event.waitUntil(self.clients.claim());
});

// معالجة الرسائل من التطبيق الرئيسي
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  if (type === 'SHOW_NOTIFICATION') {
    showNotification(data);
  }
});

// عرض الإشعارات
async function showNotification(notificationData) {
  const { title, body, icon, tag, data } = notificationData;
  
  // التحقق من إذن الإشعارات
  if (Notification.permission !== 'granted') {
    console.log('❌ Notification permission not granted');
    return;
  }
  
  const options = {
    body,
    icon: icon || '/favicon.ico',
    badge: '/favicon.ico',
    tag: tag || 'default',
    data: data || {},
    actions: [
      {
        action: 'view',
        title: 'عرض',
        icon: '/favicon.ico'
      },
      {
        action: 'dismiss',
        title: 'إغلاق'
      }
    ],
    requireInteraction: true,
    vibrate: [200, 100, 200]
  };
  
  try {
    await self.registration.showNotification(title, options);
    console.log('✅ Notification shown:', title);
  } catch (error) {
    console.error('❌ Error showing notification:', error);
  }
}

// معالجة النقر على الإشعارات
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked:', event.notification.tag);
  
  event.notification.close();
  
  const action = event.action;
  const data = event.notification.data;
  
  if (action === 'dismiss') {
    return;
  }
  
  // فتح التطبيق أو التركيز عليه
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      // البحث عن نافذة مفتوحة للتطبيق
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          // التركيز على النافذة الموجودة
          client.focus();
          
          // إرسال بيانات الإشعار للتطبيق
          client.postMessage({
            type: 'NOTIFICATION_CLICKED',
            data: data
          });
          
          return;
        }
      }
      
      // فتح نافذة جديدة إذا لم توجد نافذة مفتوحة
      self.clients.openWindow('/dashboard');
    })
  );
});

// معالجة إغلاق الإشعارات
self.addEventListener('notificationclose', (event) => {
  console.log('🔕 Notification closed:', event.notification.tag);
});

// استقبال Push Messages (للمستقبل)
self.addEventListener('push', (event) => {
  console.log('📨 Push message received');
  
  if (event.data) {
    const pushData = event.data.json();
    event.waitUntil(showNotification(pushData));
  }
});