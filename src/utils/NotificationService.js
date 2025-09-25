// خدمة الإشعارات الموحدة مع Service Worker
class NotificationService {
  constructor() {
    this.isSupported = 'Notification' in window && 'serviceWorker' in navigator;
    this.permission = Notification.permission;
    this.worker = null;
    
    // تهيئة فورية
    this.init();
  }

  async init() {
    if (!this.isSupported) {
      console.log('❌ Browser notifications not supported');
      return;
    }

    try {
      // تسجيل Service Worker
      if ('serviceWorker' in navigator) {
        this.worker = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });
        
        console.log('✅ Service Worker registered successfully');
        
        // انتظار تشغيل Service Worker إذا لم يكن نشطاً
        if (!this.worker.active) {
          await new Promise((resolve) => {
            this.worker.addEventListener('statechange', () => {
              if (this.worker.state === 'activated') {
                console.log('✅ Service Worker activated');
                resolve();
              }
            });
          });
        }
        
        // استقبال الرسائل من Service Worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          const { type, data } = event.data;
          
          if (type === 'NOTIFICATION_CLICKED') {
            this.handleNotificationClick(data);
          }
        });
        
        // طلب إذن الإشعارات مباشرة
        await this.requestPermission();
        
        console.log('🔔 NotificationService fully initialized');
      }
    } catch (error) {
      console.error('❌ Service Worker registration failed:', error);
    }
  }

  async requestPermission() {
    if (!this.isSupported) {
      console.log('❌ Notifications not supported');
      return false;
    }

    try {
      if (this.permission === 'granted') {
        console.log('✅ Notification permission already granted');
        return true;
      }

      if (this.permission === 'denied') {
        console.log('❌ Notification permission denied');
        return false;
      }

      console.log('🔔 Requesting notification permission...');
      const permission = await Notification.requestPermission();
      this.permission = permission;
      
      if (permission === 'granted') {
        console.log('✅ Notification permission granted');
        return true;
      } else {
        console.log('❌ Notification permission denied by user');
        return false;
      }
    } catch (error) {
      console.error('❌ Error requesting notification permission:', error);
      return false;
    }
  }

  async showNotification(data) {
    const hasPermission = await this.requestPermission();
    
    if (!hasPermission) {
      console.log('❌ Cannot show notification: permission not granted');
      return;
    }

    if (!this.worker) {
      console.log('❌ Cannot show notification: service worker not available');
      return;
    }

    const notificationData = {
      title: data.title || 'إشعار جديد',
      body: data.message || data.body || '',
      icon: '/favicon.ico',
      tag: data.type || 'default',
      data: {
        type: data.type,
        id: data.id || data.ai_order_id,
        url: data.url || '/dashboard'
      }
    };

    console.log('🔔 Sending notification to Service Worker:', notificationData);

    // إرسال بيانات الإشعار إلى Service Worker مع انتظار التحقق
    try {
      const worker = this.worker.active || this.worker.installing || this.worker.waiting;
      if (worker) {
        worker.postMessage({
          type: 'SHOW_NOTIFICATION',
          data: notificationData
        });
        console.log('✅ Notification sent to Service Worker');
      } else {
        console.log('❌ No active Service Worker found');
        
        // إشعار احتياطي مباشر
        if (Notification.permission === 'granted') {
          new Notification(notificationData.title, {
            body: notificationData.body,
            icon: notificationData.icon,
            tag: notificationData.tag
          });
          console.log('✅ Fallback notification shown directly');
        }
      }
    } catch (error) {
      console.error('❌ Error sending notification to Service Worker:', error);
      
      // إشعار احتياطي مباشر في حالة الخطأ
      if (Notification.permission === 'granted') {
        try {
          new Notification(notificationData.title, {
            body: notificationData.body,
            icon: notificationData.icon,
            tag: notificationData.tag
          });
          console.log('✅ Fallback notification shown after error');
        } catch (fallbackError) {
          console.error('❌ Fallback notification also failed:', fallbackError);
        }
      }
    }
  }

  handleNotificationClick(data) {
    console.log('🔔 Notification clicked:', data);
    
    if (data.type === 'new_ai_order') {
      // فتح نافذة الطلبات الذكية
      window.dispatchEvent(new CustomEvent('navigateToAiOrders', { 
        detail: { aiOrderId: data.id } 
      }));
    } else if (data.type === 'order_created' || data.type === 'order_status_update') {
      // فتح تفاصيل الطلب
      window.dispatchEvent(new CustomEvent('navigateToOrder', { 
        detail: { orderId: data.id } 
      }));
    }
  }

  // إشعار للطلبات الذكية
  async notifyAiOrder(orderData) {
    console.log('🔔 Sending AI order notification:', orderData);
    
    const notificationData = {
      title: 'طلب ذكي جديد',
      message: `تم استلام طلب جديد من ${orderData.source === 'telegram' ? 'التليغرام' : 'الذكاء الاصطناعي'}`,
      type: 'new_ai_order',
      ai_order_id: orderData.id
    };

    await this.showNotification(notificationData);
  }

  // إشعار عام
  async notify(title, message, type = 'default', data = {}) {
    console.log('🔔 Sending general notification:', { title, message, type });
    
    const notificationData = {
      title,
      message,
      type,
      ...data
    };

    await this.showNotification(notificationData);
  }
  
  // أداة تشخيص لحالة النظام
  getStatus() {
    return {
      isSupported: this.isSupported,
      permission: this.permission,
      hasWorker: !!this.worker,
      workerState: this.worker?.state || 'not available'
    };
  }
}

// إنشاء instance واحد للتطبيق
export const notificationService = new NotificationService();

// تصدير الكلاس للاستخدام المباشر
export default NotificationService;

// إضافة دالة تشخيص شاملة
window.checkNotificationStatus = () => {
  console.log('🔍 Notification System Status:', notificationService.getStatus());
  console.log('🔍 Browser Support:', {
    notifications: 'Notification' in window,
    serviceWorker: 'serviceWorker' in navigator,
    permission: Notification.permission
  });
};