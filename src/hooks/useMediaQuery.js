import React, { useState, useEffect } from 'react';

export const useMediaQuery = (query) => {
  // Defensive check to ensure React hooks are available
  if (!React || typeof useState !== 'function') {
    console.error('React hooks not available in useMediaQuery');
    return false;
  }

  // Safe fallback for server-side rendering
  const getMatches = (query) => {
    if (typeof window === 'undefined') return false;
    
    try {
      return window.matchMedia ? window.matchMedia(query).matches : false;
    } catch (error) {
      console.warn('MediaQuery error:', error);
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
      console.warn('MediaQuery useEffect error:', error);
      return;
    }
    
    const updateMatches = () => {
      try {
        setMatches(media.matches);
      } catch (error) {
        console.warn('MediaQuery setMatches error:', error);
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