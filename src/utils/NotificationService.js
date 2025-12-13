// خدمة الإشعارات المطورة
class NotificationService {
  constructor() {
    this.isSupported = 'Notification' in window && 'serviceWorker' in navigator;
    this.permission = this.isSupported ? Notification.permission : 'denied';
    this.worker = null;
    this.init();
  }

  async init() {
    if (!this.isSupported) {
      return;
    }

    try {
      // تسجيل Service Worker
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });
        
        // الانتظار حتى يصبح Service Worker جاهزاً
        if (registration.installing) {
          registration.installing.addEventListener('statechange', (e) => {
            if (e.target.state === 'activated') {
              this.worker = registration;
            }
          });
        } else if (registration.active) {
          this.worker = registration;
        }

        // استقبال الرسائل من Service Worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          const { type, data } = event.data;
          
          if (type === 'NOTIFICATION_CLICKED') {
            this.handleNotificationClick(data);
          }
        });
      }
    } catch (error) {
      // Silent fail
    }
  }

  async requestPermission() {
    if (!this.isSupported) {
      return false;
    }

    if (this.permission === 'granted') {
      return true;
    }

    if (this.permission === 'denied') {
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      return permission === 'granted';
    } catch (error) {
      return false;
    }
  }

  async showNotification(data) {
    const hasPermission = await this.requestPermission();
    
    if (!hasPermission) {
      return;
    }

    // إذا لم يكن Service Worker متاحاً، استخدم Notification API المباشر
    if (!this.worker || !this.worker.active) {
      try {
        const notification = new Notification(data.title || 'إشعار جديد', {
          body: data.message || data.body || '',
          icon: '/favicon.ico',
          tag: data.type || 'default',
          requireInteraction: true
        });

        notification.onclick = () => {
          this.handleNotificationClick({
            type: data.type,
            id: data.id || data.ai_order_id
          });
          notification.close();
        };

        return;
      } catch (error) {
        return;
      }
    }

    const notificationData = {
      title: data.title || 'إشعار جديد',
      body: data.message || data.body || '',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: data.type || 'default',
      data: {
        type: data.type,
        id: data.id || data.ai_order_id,
        url: data.url || '/dashboard'
      }
    };

    // إرسال بيانات الإشعار إلى Service Worker
    this.worker.active.postMessage({
      type: 'SHOW_NOTIFICATION',
      payload: notificationData
    });
  }

  handleNotificationClick(data) {
    // توجيه المستخدم بناءً على نوع الإشعار
    if (data.type === 'new_ai_order') {
      // الانتقال إلى الطلبات الذكية
      window.dispatchEvent(new CustomEvent('navigateToAiOrders', { 
        detail: { orderId: data.id } 
      }));
    } else if (data.type === 'order_status_update') {
      // الانتقال إلى تفاصيل الطلب
      window.dispatchEvent(new CustomEvent('navigateToOrder', { 
        detail: { orderId: data.id } 
      }));
    }
  }

  // إشعار للطلبات الذكية
  async notifyAiOrder(orderData) {
    const notificationData = {
      title: 'طلب ذكي جديد',
      message: `استلام طلب جديد من التليغرام يحتاج للمراجعة`,
      type: 'new_ai_order',
      ai_order_id: orderData.id
    };

    await this.showNotification(notificationData);
  }

  // إشعار عام
  async notify(title, message, type = 'default', data = {}) {
    const notificationData = {
      title,
      message,
      type,
      ...data
    };

    await this.showNotification(notificationData);
  }
}

// إنشاء instance واحد للتطبيق
export const notificationService = new NotificationService();

// تصدير الكلاس للاستخدام المباشر
export default NotificationService;