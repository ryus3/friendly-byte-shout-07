import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { navigationGuard, performanceMonitor } from '@/utils/navigationGuard';
import { memoryCleanup } from '@/utils/memoryCleanup';
import { performanceOptimizer, navigationOptimizer } from '@/utils/performance-optimizer';

const NavigationMemoryGuard = ({ children }) => {
  const location = useLocation();

  useEffect(() => {
    // Check if navigation is safe
    if (!navigationGuard.canNavigate()) {
      console.warn('🚧 Navigation blocked - system stabilizing');
      return;
    }

    // Start navigation process
    if (!navigationGuard.startNavigation()) {
      console.warn('🚧 Navigation blocked - already in progress');
      return;
    }

    // Monitor memory usage
    const hasGoodMemory = performanceMonitor.memory();
    if (!hasGoodMemory) {
      console.warn('⚠️ High memory usage during navigation');
      performanceMonitor.cleanup();
    }

    // تنظيف محسن وسريع
    const cleanupTimer = setTimeout(() => {
      navigationGuard.endNavigation();
      navigationOptimizer.endNavigation();
      memoryCleanup.executeAll();
      performanceOptimizer.monitorMemory();
    }, 50);

    // Cleanup function
    return () => {
      clearTimeout(cleanupTimer);
      navigationGuard.endNavigation();
    };
  }, [location.pathname]);

  // Auto reset navigation guard after order creation
  useEffect(() => {
    const handleOrderCreated = () => {
      console.log('🔄 Order created - resetting navigation guard');
      setTimeout(() => {
        navigationGuard.forceReset();
      }, 50);
    };

    const handleOrderCreationComplete = () => {
      console.log('✅ Order creation complete - forcing navigation reset');
      navigationGuard.forceReset();
      memoryCleanup.executeAll();
    };

    const handleResetNavigationGuard = () => {
      console.log('🔄 Manual navigation guard reset');
      navigationGuard.forceReset();
    };

    window.addEventListener('orderCreated', handleOrderCreated);
    window.addEventListener('orderCreationComplete', handleOrderCreationComplete);
    window.addEventListener('resetNavigationGuard', handleResetNavigationGuard);
    
    return () => {
      window.removeEventListener('orderCreated', handleOrderCreated);
      window.removeEventListener('orderCreationComplete', handleOrderCreationComplete);
      window.removeEventListener('resetNavigationGuard', handleResetNavigationGuard);
    };
  }, []);

  return children;
};

export default NavigationMemoryGuard;