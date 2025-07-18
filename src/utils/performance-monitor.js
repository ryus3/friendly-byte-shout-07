/**
 * أدوات مراقبة الأداء لتطبيق RYUS
 * مصممة خصيصاً لتتبع استهلاك البيانات والأداء
 */

class PerformanceMonitor {
  constructor() {
    this.dataUsage = {
      total: 0,
      byComponent: new Map(),
      byTimeSlot: []
    };
    
    this.startTime = performance.now();
    this.metrics = new Map();
    this.isMonitoring = false;
  }

  // بدء مراقبة الأداء
  startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.startTime = performance.now();
    
    // مراقبة استهلاك الشبكة
    if ('connection' in navigator) {
      this.networkInfo = navigator.connection;
      this.logNetworkInfo();
    }
    
    // مراقبة استهلاك الذاكرة
    if ('memory' in performance) {
      this.startMemoryMonitoring();
    }
    
    console.log('🚀 Performance Monitor Started - RYUS System');
  }

  // تسجيل معلومات الشبكة
  logNetworkInfo() {
    if (!this.networkInfo) return;
    
    const info = {
      effectiveType: this.networkInfo.effectiveType,
      downlink: this.networkInfo.downlink,
      rtt: this.networkInfo.rtt,
      saveData: this.networkInfo.saveData
    };
    
    console.log('📡 Network Info:', info);
    
    // إذا كان الاتصال بطيئاً، اقترح تحسينات
    if (this.networkInfo.effectiveType === 'slow-2g' || this.networkInfo.effectiveType === '2g') {
      console.warn('⚠️ Slow connection detected. Optimizing for low bandwidth...');
      this.enableDataSavingMode();
    }
  }

  // مراقبة استهلاك الذاكرة
  startMemoryMonitoring() {
    setInterval(() => {
      if (!this.isMonitoring) return;
      
      const memory = performance.memory;
      const usage = {
        used: Math.round(memory.usedJSHeapSize / 1048576), // MB
        total: Math.round(memory.totalJSHeapSize / 1048576), // MB
        limit: Math.round(memory.jsHeapSizeLimit / 1048576) // MB
      };
      
      this.metrics.set('memory', usage);
      
      // تحذير عند استهلاك ذاكرة عالي
      if (usage.used > usage.limit * 0.8) {
        console.warn('⚠️ High memory usage detected:', usage);
      }
    }, 10000); // كل 10 ثوان
  }

  // تسجيل استهلاك البيانات لمكون معين
  logDataUsage(component, size, type = 'api') {
    this.dataUsage.total += size;
    
    const current = this.dataUsage.byComponent.get(component) || { total: 0, calls: 0 };
    current.total += size;
    current.calls += 1;
    
    this.dataUsage.byComponent.set(component, current);
    
    // تسجيل حسب الوقت
    this.dataUsage.byTimeSlot.push({
      component,
      size,
      type,
      timestamp: Date.now()
    });
    
    // الاحتفاظ بآخر 100 عملية فقط
    if (this.dataUsage.byTimeSlot.length > 100) {
      this.dataUsage.byTimeSlot = this.dataUsage.byTimeSlot.slice(-100);
    }
  }

  // تمكين وضع توفير البيانات
  enableDataSavingMode() {
    // إشارة للمكونات لتقليل البيانات
    window.dispatchEvent(new CustomEvent('enable-data-saving-mode'));
    
    // تقليل تحديث الكاش
    window.dispatchEvent(new CustomEvent('reduce-cache-frequency'));
    
    console.log('💾 Data saving mode enabled');
  }

  // الحصول على تقرير الأداء
  getPerformanceReport() {
    const runtime = (performance.now() - this.startTime) / 1000; // بالثواني
    
    return {
      runtime: `${runtime.toFixed(2)}s`,
      dataUsage: {
        total: `${(this.dataUsage.total / 1024).toFixed(2)} KB`,
        byComponent: Object.fromEntries(
          Array.from(this.dataUsage.byComponent.entries()).map(([key, value]) => [
            key,
            `${(value.total / 1024).toFixed(2)} KB (${value.calls} calls)`
          ])
        )
      },
      memory: this.metrics.get('memory'),
      recommendations: this.getRecommendations()
    };
  }

  // اقتراحات التحسين
  getRecommendations() {
    const recommendations = [];
    
    // فحص استهلاك البيانات
    if (this.dataUsage.total > 1024 * 1024) { // أكثر من 1 ميجا
      recommendations.push('📊 High data usage detected. Consider implementing pagination or lazy loading.');
    }
    
    // فحص المكونات الأكثر استهلاكاً
    const topConsumer = Array.from(this.dataUsage.byComponent.entries())
      .sort((a, b) => b[1].total - a[1].total)[0];
    
    if (topConsumer && topConsumer[1].total > 500 * 1024) { // أكثر من 500 كيلو
      recommendations.push(`🎯 Component "${topConsumer[0]}" is using ${(topConsumer[1].total / 1024).toFixed(2)} KB. Consider optimization.`);
    }
    
    // فحص الذاكرة
    const memory = this.metrics.get('memory');
    if (memory && memory.used > memory.limit * 0.7) {
      recommendations.push('🧠 High memory usage. Consider component cleanup and optimization.');
    }
    
    return recommendations;
  }

  // إيقاف المراقبة
  stopMonitoring() {
    this.isMonitoring = false;
    console.log('📊 Performance Monitor Report:', this.getPerformanceReport());
  }
}

// إنشاء مثيل واحد للنظام
export const performanceMonitor = new PerformanceMonitor();

// بدء المراقبة تلقائياً في بيئة التطوير
if (process.env.NODE_ENV === 'development') {
  performanceMonitor.startMonitoring();
}

export default performanceMonitor;