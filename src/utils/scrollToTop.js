import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * دالة للانتقال إلى أعلى الصفحة عند تغيير المسار
 */
export const scrollToTop = () => {
  // انتقال سلس إلى أعلى الصفحة
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: 'instant'
  });
  
  // تأكد من الانتقال حتى لو لم يعمل scrollTo
  document.body.scrollTop = 0;
  document.documentElement.scrollTop = 0;
};

// Hook لاستخدام التأثير عند تغيير المسار
export const useScrollToTop = () => {
  const { pathname } = useLocation();
  
  useEffect(() => {
    scrollToTop();
  }, [pathname]);
};