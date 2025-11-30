// ⚡ Offline Manager - إدارة العمليات أثناء عدم الاتصال
// يعمل مع Service Worker لحفظ العمليات ومزامنتها عند الاتصال

class OfflineManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.syncInProgress = false;
    this.listeners = new Set();
    
    // مراقبة حالة الاتصال
    this.initNetworkListeners();
    
    // مراقبة رسائل Service Worker
    this.initServiceWorkerListeners();
  }
  
  // ============= مراقبة حالة الاتصال =============
  
  initNetworkListeners() {
    window.addEventListener('online', () => {
      console.log('✅ Offline Manager: Network connected');
      this.isOnline = true;
      this.notifyListeners('online');
      this.syncPendingOperations();
    });
    
    window.addEventListener('offline', () => {
      console.log('📡 Offline Manager: Network disconnected');
      this.isOnline = false;
      this.notifyListeners('offline');
    });
  }
  
  // ============= Service Worker Communication =============
  
  initServiceWorkerListeners() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        const { type, data } = event.data;
        
        if (type === 'SYNC_SUCCESS') {
          console.log('✅ Offline Manager: Sync success:', data);
          this.notifyListeners('sync-success', data);
        }
        
        if (type === 'CACHE_CLEARED') {
          console.log('🗑️ Offline Manager: Cache cleared');
          this.notifyListeners('cache-cleared');
        }
      });
    }
  }
  
  // ============= إدارة العمليات المؤجلة =============
  
  async syncPendingOperations() {
    if (this.syncInProgress || !this.isOnline) {
      return;
    }
    
    this.syncInProgress = true;
    console.log('🔄 Offline Manager: Starting sync...');
    
    try {
      // طلب Background Sync من Service Worker
      if ('serviceWorker' in navigator && 'sync' in self.registration) {
        await self.registration.sync.register('sync-orders');
        console.log('✅ Offline Manager: Background sync registered');
      } else {
        console.warn('⚠️ Offline Manager: Background Sync not supported');
      }
      
      this.notifyListeners('sync-complete');
    } catch (error) {
      console.error('❌ Offline Manager: Sync failed:', error);
      this.notifyListeners('sync-error', error);
    } finally {
      this.syncInProgress = false;
    }
  }
  
  // ============= إدارة المستمعين =============
  
  addListener(callback) {
    this.listeners.add(callback);
    
    // إرجاع دالة لإلغاء الاشتراك
    return () => {
      this.listeners.delete(callback);
    };
  }
  
  notifyListeners(event, data = null) {
    this.listeners.forEach(callback => {
      try {
        callback({ event, data, isOnline: this.isOnline });
      } catch (error) {
        console.error('❌ Offline Manager: Listener error:', error);
      }
    });
  }
  
  // ============= حفظ عملية للمزامنة لاحقاً =============
  
  async queueOperation(operation) {
    console.log('📦 Offline Manager: Queueing operation:', operation.type);
    
    // حفظ في IndexedDB عبر Service Worker
    try {
      const response = await fetch('/api/queue-operation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(operation),
      });
      
      if (response.status === 202) {
        console.log('✅ Offline Manager: Operation queued successfully');
        this.notifyListeners('operation-queued', operation);
        return true;
      }
    } catch (error) {
      console.error('❌ Offline Manager: Failed to queue operation:', error);
      return false;
    }
  }
  
  // ============= تنظيف الذاكرة المؤقتة =============
  
  async clearCache() {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      console.log('🗑️ Offline Manager: Requesting cache clear...');
      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
    }
  }
  
  // ============= معلومات عن الذاكرة المؤقتة =============
  
  async getCacheSize() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage,
        quota: estimate.quota,
        usageInMB: (estimate.usage / (1024 * 1024)).toFixed(2),
        quotaInMB: (estimate.quota / (1024 * 1024)).toFixed(2),
        percentage: ((estimate.usage / estimate.quota) * 100).toFixed(2),
      };
    }
    return null;
  }
  
  // ============= حالة الاتصال =============
  
  getNetworkStatus() {
    return {
      isOnline: this.isOnline,
      syncInProgress: this.syncInProgress,
      effectiveType: navigator.connection?.effectiveType || 'unknown',
      downlink: navigator.connection?.downlink || 0,
      rtt: navigator.connection?.rtt || 0,
    };
  }
}

// إنشاء instance واحد
const offlineManager = new OfflineManager();

export default offlineManager;

// تصدير React Hook لسهولة الاستخدام
export function useOfflineManager() {
  const [status, setStatus] = React.useState({
    isOnline: offlineManager.isOnline,
    syncInProgress: offlineManager.syncInProgress,
  });
  
  React.useEffect(() => {
    const unsubscribe = offlineManager.addListener(({ event, isOnline }) => {
      setStatus({
        isOnline,
        syncInProgress: offlineManager.syncInProgress,
        lastEvent: event,
      });
    });
    
    return unsubscribe;
  }, []);
  
  return {
    ...status,
    queueOperation: (op) => offlineManager.queueOperation(op),
    syncNow: () => offlineManager.syncPendingOperations(),
    clearCache: () => offlineManager.clearCache(),
    getCacheSize: () => offlineManager.getCacheSize(),
    getNetworkStatus: () => offlineManager.getNetworkStatus(),
  };
}
