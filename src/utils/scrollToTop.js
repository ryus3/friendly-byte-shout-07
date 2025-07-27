import React from 'react';

/**
 * أداة لانتقال الصفحة لأعلى عند فتح صفحة جديدة
 */
export const scrollToTop = () => {
  window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
};

/**
 * استخدام useEffect لانتقال لأعلى الصفحة عند التحميل
 */
export const useScrollToTop = () => {
  React.useEffect(() => {
    scrollToTop();
  }, []);
};