import React, { useState, useEffect } from 'react';

export const useMediaQuery = (query) => {
  // Use a simple fallback approach for media queries
  const getMatches = (query) => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      try {
        return window.matchMedia(query).matches;
      } catch (error) {
        return false;
      }
    }
    return false;
  };

  const [matches, setMatches] = useState(getMatches(query));

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }

    const media = window.matchMedia(query);
    
    // Update state if different
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    
    const listener = (e) => setMatches(e.matches);
    
    // Use addListener for compatibility with older browsers
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
  }, [query, matches]);

  return matches;
};