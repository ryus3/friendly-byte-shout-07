// Performance optimization configuration
// This file contains global performance settings

export const PERFORMANCE_CONFIG = {
  // Disable all console logs in production
  DISABLE_CONSOLE_IN_PRODUCTION: true,
  
  // React optimization flags
  USE_MEMO_FOR_HEAVY_CALCULATIONS: true,
  USE_CALLBACK_FOR_EVENT_HANDLERS: true,
  LAZY_LOAD_IMAGES: true,
  
  // Animation performance
  REDUCE_MOTION_IN_LOW_PERFORMANCE: true,
  ANIMATION_DELAY_INCREMENT: 0.05, // seconds
  
  // Data fetching optimization
  DEBOUNCE_SEARCH_MS: 300,
  THROTTLE_SCROLL_MS: 100,
  
  // Component rendering optimization
  VIRTUAL_LIST_THRESHOLD: 50, // Use virtual scrolling when items > 50
  LAZY_LOAD_THRESHOLD: 20, // Lazy load components when items > 20
};

export default PERFORMANCE_CONFIG;
