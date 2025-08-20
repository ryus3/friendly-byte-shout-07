/**
 * Memory cleanup utilities to prevent memory leaks
 */
import React from 'react';

// Global state cleanup registry
const cleanupTasks = new Set();

export const memoryCleanup = {
  // Register a cleanup task
  register: (task) => {
    if (typeof task === 'function') {
      cleanupTasks.add(task);
    }
  },

  // Unregister a cleanup task
  unregister: (task) => {
    cleanupTasks.delete(task);
  },

  // Execute all cleanup tasks
  executeAll: () => {
    console.log('🧹 Executing memory cleanup tasks...');
    let executed = 0;
    
    cleanupTasks.forEach(task => {
      try {
        task();
        executed++;
      } catch (error) {
        console.error('❌ Cleanup task failed:', error);
      }
    });
    
    console.log(`✅ Executed ${executed} cleanup tasks`);
    return executed;
  },

  // Clear all registered tasks
  clear: () => {
    cleanupTasks.clear();
    console.log('🗑️ Cleared all cleanup tasks');
  },

  // Get current task count
  count: () => cleanupTasks.size
};

// Automatic cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    memoryCleanup.executeAll();
  });

  // Cleanup on navigation (React Router)
  window.addEventListener('popstate', () => {
    setTimeout(() => {
      memoryCleanup.executeAll();
    }, 100);
  });
}

// React component cleanup helper
export const useMemoryCleanup = (cleanupFn) => {
  React.useEffect(() => {
    if (cleanupFn) {
      memoryCleanup.register(cleanupFn);
      
      return () => {
        memoryCleanup.unregister(cleanupFn);
      };
    }
  }, [cleanupFn]);
};

// Safe state update helper
export const safeSetState = (setState, newState) => {
  try {
    setState(newState);
  } catch (error) {
    console.error('❌ Safe setState failed:', error);
  }
};