import { useState, useEffect } from 'react';

export const useMediaQuery = (query) => {
  // التحقق من وجود window في البيئة
  const isClient = typeof window !== 'undefined';
  
  const [matches, setMatches] = useState(() => {
    if (!isClient || !window.matchMedia) {
      return false;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (!isClient || !window.matchMedia) {
      return;
    }

    const media = window.matchMedia(query);
    
    // تحديث الحالة إذا كانت مختلفة
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    
    const listener = (event) => {
      setMatches(event.matches);
    };
    
    // استخدام addEventListener بدلاً من addListener
    if (media.addEventListener) {
      media.addEventListener('change', listener);
    } else {
      // للمتصفحات القديمة
      media.addListener(listener);
    }
    
    return () => {
      if (media.removeEventListener) {
        media.removeEventListener('change', listener);
      } else {
        media.removeListener(listener);
      }
    };
  }, [query, isClient, matches]);

  return matches;
};