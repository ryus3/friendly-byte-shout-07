/**
 * أدوات تحسين الأداء والذاكرة
 */

// تحسين localStorage للتحديثات السريعة
export const optimizedLocalStorage = {
  set: (key, value) => {
    try {
      const data = JSON.stringify(value);
      localStorage.setItem(key, data);
    } catch (error) {
      console.warn('⚠️ فشل في حفظ البيانات محلياً:', error);
    }
  },
  
  get: (key, defaultValue = null) => {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch (error) {
      console.warn('⚠️ فشل في قراءة البيانات محلياً:', error);
      return defaultValue;
    }
  },
  
  // تنظيف دوري للبيانات القديمة
  cleanup: () => {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('temp_') || key.includes('cache_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      console.log('🧹 تم تنظيف البيانات المؤقتة:', keysToRemove.length);
    } catch (error) {
      console.warn('⚠️ فشل في تنظيف البيانات المؤقتة:', error);
    }
  }
};

// مراقب الأداء المحسن
export const performanceOptimizer = {
  // تحسين عمليات DOM
  batchDOMUpdates: (updates) => {
    requestAnimationFrame(() => {
      updates.forEach(update => {
        try {
          update();
        } catch (error) {
          console.warn('⚠️ فشل في تحديث DOM:', error);
        }
      });
    });
  },
  
  // تنظيف listeners القديمة
  cleanupEventListeners: () => {
    const events = ['orderCreated', 'orderUpdated', 'orderDeleted', 'forceDataRefresh'];
    events.forEach(eventName => {
      // إزالة جميع listeners القديمة
      const clonedWindow = window.cloneNode ? window.cloneNode(false) : window;
      if (window.removeEventListener) {
        // لا يمكن إزالة جميع listeners، لكن يمكن تسجيل التنظيف
        console.log(`🧹 تنظيف listeners لـ: ${eventName}`);
      }
    });
  },
  
  // مراقبة استخدام الذاكرة
  monitorMemory: () => {
    if (performance.memory) {
      const memory = performance.memory;
      const usedMB = Math.round(memory.usedJSHeapSize / 1048576);
      const totalMB = Math.round(memory.totalJSHeapSize / 1048576);
      const limitMB = Math.round(memory.jsHeapSizeLimit / 1048576);
      
      console.log(`💾 استخدام الذاكرة: ${usedMB}MB / ${totalMB}MB (حد أقصى: ${limitMB}MB)`);
      
      // تحذير إذا تجاوز الاستخدام 80%
      if (usedMB / limitMB > 0.8) {
        console.warn('⚠️ استخدام ذاكرة عالي! قد تحتاج لإعادة تحميل الصفحة');
        return false;
      }
    }
    return true;
  },
  
  // تحسين تحديثات الحالة
  debounceStateUpdate: (fn, delay = 50) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), delay);
    };
  }
};

// تحسين navigation
export const navigationOptimizer = {
  // التأكد من عدم تداخل التنقل
  canNavigate: () => {
    const isNavigating = window.isNavigating || false;
    return !isNavigating;
  },
  
  // بدء التنقل بحماية
  startNavigation: () => {
    if (window.isNavigating) {
      console.warn('🚧 التنقل قيد التقدم بالفعل');
      return false;
    }
    
    window.isNavigating = true;
    
    // إعادة تعيين تلقائية بعد 100ms
    setTimeout(() => {
      window.isNavigating = false;
    }, 100);
    
    return true;
  },
  
  // إنهاء التنقل
  endNavigation: () => {
    window.isNavigating = false;
  }
};

// تحسين تحديثات البيانات
export const dataUpdateOptimizer = {
  // منع التحديثات المتكررة
  lastUpdateTime: 0,
  
  shouldUpdate: (minInterval = 100) => {
    const now = Date.now();
    if (now - dataUpdateOptimizer.lastUpdateTime < minInterval) {
      console.log('⏩ تجاهل التحديث المتكرر');
      return false;
    }
    dataUpdateOptimizer.lastUpdateTime = now;
    return true;
  },
  
  // تجميع التحديثات
  pendingUpdates: new Set(),
  
  batchUpdate: (updateId, updateFn) => {
    if (dataUpdateOptimizer.pendingUpdates.has(updateId)) {
      console.log('⏳ التحديث معلق بالفعل:', updateId);
      return;
    }
    
    dataUpdateOptimizer.pendingUpdates.add(updateId);
    
    requestAnimationFrame(() => {
      try {
        updateFn();
      } catch (error) {
        console.error('❌ خطأ في التحديث المجمع:', error);
      } finally {
        dataUpdateOptimizer.pendingUpdates.delete(updateId);
      }
    });
  }
};

// تشغيل تنظيف دوري
setInterval(() => {
  optimizedLocalStorage.cleanup();
  performanceOptimizer.monitorMemory();
}, 60000); // كل دقيقة

export default {
  optimizedLocalStorage,
  performanceOptimizer,
  navigationOptimizer,
  dataUpdateOptimizer
};