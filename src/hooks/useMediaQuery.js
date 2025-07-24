import { useState, useEffect } from 'react';

export const useMediaQuery = (query) => {
  // إنشاء الـ state مباشرة مع fallback بسيط
  const [matches, setMatches] = useState(() => {
    // التحقق من وجود window و matchMedia
    if (typeof window !== 'undefined' && window.matchMedia) {
      try {
        return window.matchMedia(query).matches;
      } catch (error) {
        console.warn('useMediaQuery hook called outside React context, using fallback');
        return false;
      }
    }
    return false;
  });

  useEffect(() => {
    // التحقق من وجود window و matchMedia
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }

    try {
      const media = window.matchMedia(query);
      
      // تحديث الحالة إذا كانت مختلفة
      if (media.matches !== matches) {
        setMatches(media.matches);
      }
      
      const listener = (e) => {
        setMatches(e.matches);
      };
      
      // استخدام addListener للتوافق مع المتصفحات القديمة
      if (media.addListener) {
        media.addListener(listener);
      } else {
        media.addEventListener('change', listener);
      }
      
      return () => {
        if (media.removeListener) {
          media.removeListener(listener);
        } else {
          media.removeEventListener('change', listener);
        }
      };
    } catch (error) {
      console.warn('Error setting up media query listener:', error);
    }
  }, [query]);

  return matches;
};