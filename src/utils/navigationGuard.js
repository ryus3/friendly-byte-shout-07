/**
 * Navigation guard to ensure app stability during navigation
 */

let isNavigating = false;
let navigationTimeout = null;

export const navigationGuard = {
  // Check if navigation is safe
  canNavigate: () => {
    return !isNavigating;
  },

  // Start navigation process
  startNavigation: () => {
    if (isNavigating) {
      console.warn('🚧 Navigation already in progress, blocking duplicate navigation');
      return false;
    }
    
    isNavigating = true;
    
    // Auto-reset after 10ms for faster response
    navigationTimeout = setTimeout(() => {
      isNavigating = false;
      console.log('✅ Navigation timeout reset');
    }, 10);
    
    return true;
  },

  // End navigation process
  endNavigation: () => {
    isNavigating = false;
    if (navigationTimeout) {
      clearTimeout(navigationTimeout);
      navigationTimeout = null;
    }
  },

  // Force reset navigation state
  forceReset: () => {
    isNavigating = false;
    if (navigationTimeout) {
      clearTimeout(navigationTimeout);
      navigationTimeout = null;
    }
    console.log('🔄 Navigation state force reset');
  }
};

// Performance monitoring
export const performanceMonitor = {
  memory: () => {
    if (performance.memory) {
      const memory = performance.memory;
      console.log('💾 Memory usage:', {
        used: Math.round(memory.usedJSHeapSize / 1048576) + ' MB',
        total: Math.round(memory.totalJSHeapSize / 1048576) + ' MB',
        limit: Math.round(memory.jsHeapSizeLimit / 1048576) + ' MB'
      });
      
      // Warning if memory usage is high
      if (memory.usedJSHeapSize / memory.jsHeapSizeLimit > 0.8) {
        console.warn('⚠️ High memory usage detected');
        return false;
      }
    }
    return true;
  },

  cleanup: () => {
    // Force garbage collection if available (Chrome DevTools)
    if (window.gc) {
      window.gc();
      console.log('🗑️ Forced garbage collection');
    }
  }
};