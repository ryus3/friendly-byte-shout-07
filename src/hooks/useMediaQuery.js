import { useState, useEffect } from 'react';

export const useMediaQuery = (query) => {
  // التحقق من وجود React context قبل استدعاء useState
  let matches;
  let setMatches;
  
  try {
    [matches, setMatches] = useState(() => {
      // التحقق من وجود window و matchMedia
      if (typeof window !== 'undefined' && window.matchMedia) {
        return window.matchMedia(query).matches;
      }
      return false;
    });
  } catch (error) {
    console.warn('useMediaQuery hook called outside React context, using fallback');
    return false;
  }

  useEffect(() => {
    // التحقق من وجود window و matchMedia
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }

    const media = window.matchMedia(query);
    
    // تحديث الحالة إذا كانت مختلفة
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    
    const listener = () => {
      if (setMatches) {
        setMatches(media.matches);
      }
    };
    
    media.addEventListener('change', listener);
    
    return () => {
      media.removeEventListener('change', listener);
    };
  }, [matches, query, setMatches]);

  return matches || false;
};