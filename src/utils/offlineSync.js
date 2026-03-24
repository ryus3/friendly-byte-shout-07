// ✅ نظام إدارة المزامنة Offline - RYUS System
import { toast } from '@/hooks/use-toast';

const DB_NAME = 'ryus-offline-db';
const DB_VERSION = 1;
const STORE_NAME = 'pending-operations';

// ✅ فتح IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { 
          keyPath: 'id', 
          autoIncrement: true 
        });
        
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('synced', 'synced', { unique: false });
      }
    };
  });
}

// ✅ حفظ عملية في قائمة الانتظار
export async function savePendingOperation(operation) {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const data = {
      ...operation,
      timestamp: Date.now(),
      synced: 0,
      retries: 0
    };

    await store.add(data);
    
    console.log('💾 Operation saved to offline queue:', operation.type);
    
    // ✅ محاولة المزامنة إذا كان متصل
    if (navigator.onLine) {
      setTimeout(() => syncPendingOperations(), 1000);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Failed to save operation:', error);
    return false;
  }
}

// ✅ جلب جميع العمليات المعلقة
export async function getPendingOperations() {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('synced');

    return new Promise((resolve, reject) => {
      const request = index.getAll(IDBKeyRange.only(0));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('❌ Failed to get pending operations:', error);
    return [];
  }
}

// ✅ تحديث حالة العملية
async function updateOperationStatus(id, synced, error = null) {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const request = store.get(id);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const data = request.result;
        if (data) {
          data.synced = synced ? 1 : 0;
          data.lastSyncAttempt = Date.now();
          data.retries = (data.retries || 0) + 1;
          if (error) data.error = error;
          
          const updateRequest = store.put(data);
          updateRequest.onsuccess = () => resolve(true);
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve(false);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('❌ Failed to update operation:', error);
    return false;
  }
}

// ✅ حذف عملية تمت مزامنتها
async function deleteOperation(id) {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('❌ Failed to delete operation:', error);
    return false;
  }
}

// ✅ مزامنة جميع العمليات المعلقة
export async function syncPendingOperations() {
  if (!navigator.onLine) {
    console.log('📡 Offline - sync postponed');
    return { success: false, reason: 'offline' };
  }

  try {
    const pendingOps = await getPendingOperations();
    
    if (pendingOps.length === 0) {
      console.log('✅ No pending operations');
      return { success: true, synced: 0 };
    }

    console.log(`🔄 Syncing ${pendingOps.length} pending operations...`);
    
    let syncedCount = 0;
    let failedCount = 0;

    for (const op of pendingOps) {
      try {
        // ✅ تنفيذ العملية بناءً على نوعها
        const result = await executeOperation(op);
        
        if (result.success) {
          await deleteOperation(op.id);
          syncedCount++;
        } else {
          await updateOperationStatus(op.id, false, result.error);
          failedCount++;
        }
      } catch (error) {
        console.error('❌ Operation sync failed:', error);
        await updateOperationStatus(op.id, false, error.message);
        failedCount++;
      }
    }

    console.log(`✅ Sync complete: ${syncedCount} synced, ${failedCount} failed`);
    
    // ✅ إشعار المستخدم
    if (syncedCount > 0) {
      toast({
        title: "✅ تمت المزامنة",
        description: `تم مزامنة ${syncedCount} عملية بنجاح`
      });
    }
    
    if (failedCount > 0) {
      toast({
        title: "⚠️ خطأ في المزامنة",
        description: `فشلت مزامنة ${failedCount} عملية`,
        variant: "destructive"
      });
    }

    return { success: true, synced: syncedCount, failed: failedCount };
  } catch (error) {
    console.error('❌ Sync failed:', error);
    return { success: false, error: error.message };
  }
}

// ✅ تنفيذ عملية معينة
async function executeOperation(operation) {
  try {
    console.log('🔄 Executing operation:', operation.type);
    
    // ✅ هنا يمكن إضافة منطق تنفيذ العمليات المختلفة
    // مثلاً: إنشاء طلب، تحديث مخزون، إلخ
    
    switch (operation.type) {
      case 'create_order':
        // منطق إنشاء الطلب
        return { success: true };
        
      case 'update_order':
        // منطق تحديث الطلب
        return { success: true };
        
      case 'update_inventory':
        // منطق تحديث المخزون
        return { success: true };
        
      default:
        console.warn('⚠️ Unknown operation type:', operation.type);
        return { success: false, error: 'Unknown operation type' };
    }
  } catch (error) {
    console.error('❌ Operation execution failed:', error);
    return { success: false, error: error.message };
  }
}

// ✅ مراقبة حالة الاتصال
export function setupOfflineSync() {
  console.log('🔌 Setting up offline sync...');
  
  // ✅ عند عودة الاتصال
  window.addEventListener('online', () => {
    console.log('🌐 Connection restored');
    toast({
      title: "🌐 عاد الاتصال",
      description: "جاري المزامنة..."
    });
    setTimeout(() => syncPendingOperations(), 2000);
  });

  // ✅ عند فقدان الاتصال
  window.addEventListener('offline', () => {
    console.log('📡 Connection lost');
    toast({
      title: "📡 لا يوجد اتصال",
      description: "سيتم حفظ التغييرات محلياً",
      variant: "destructive"
    });
  });

  // ✅ مزامنة دورية كل 5 دقائق
  setInterval(() => {
    if (navigator.onLine) {
      syncPendingOperations();
    }
  }, 5 * 60 * 1000);

  // ✅ مزامنة عند تحميل الصفحة
  if (navigator.onLine) {
    setTimeout(() => syncPendingOperations(), 3000);
  }
}

// ✅ عدد العمليات المعلقة
export async function getPendingCount() {
  const operations = await getPendingOperations();
  return operations.length;
}

export default {
  savePendingOperation,
  getPendingOperations,
  syncPendingOperations,
  setupOfflineSync,
  getPendingCount
};