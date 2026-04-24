import { useState, useEffect } from 'react';
import devLog from '@/lib/devLogger';

export const useMediaQuery = (query) => {
  // Safe fallback for server-side rendering
  const getMatches = (query) => {
    if (typeof window === 'undefined') return false;
    
    try {
      return window.matchMedia ? window.matchMedia(query).matches : false;
    } catch (error) {
      devLog.warn('MediaQuery error:', error);
      return false;
    }
  };

  const [matches, setMatches] = useState(() => getMatches(query));

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let media;
    try {
      media = window.matchMedia(query);
    } catch (error) {
      devLog.warn('MediaQuery useEffect error:', error);
      return;
    }
    
    const updateMatches = () => {
      try {
        setMatches(media.matches);
      } catch (error) {
        devLog.warn('MediaQuery setMatches error:', error);
      }
    };
    
    // Initial check
    updateMatches();
    
    // Add listener
    if (media.addEventListener) {
      media.addEventListener('change', updateMatches);
      return () => media.removeEventListener('change', updateMatches);
    } else if (media.addListener) {
      media.addListener(updateMatches);
      return () => media.removeListener(updateMatches);
    }
  }, [query]);

  return matches;
};