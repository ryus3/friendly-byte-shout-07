import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { navigationGuard, performanceMonitor } from '@/utils/navigationGuard';
import { memoryCleanup } from '@/utils/memoryCleanup';

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

    // Cleanup timer
    const cleanupTimer = setTimeout(() => {
      navigationGuard.endNavigation();
      memoryCleanup.executeAll();
    }, 100);

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
      }, 100);
    };

    window.addEventListener('orderCreated', handleOrderCreated);
    return () => window.removeEventListener('orderCreated', handleOrderCreated);
  }, []);

  return children;
};

export default NavigationMemoryGuard;